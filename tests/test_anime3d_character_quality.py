"""No-GPU tests for character img-to-3D reference and appearance gates."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from anime3d_character_quality import (WORKFLOW, REVIEW_SCHEMA, assess, enabled,
                                       reference_views, sha256_file, validate_subject_v3)


class CharacterGateTests(unittest.TestCase):
    def setup_job(self, root):
        pack = root / "01_portraits" / "approved"
        (pack / "images").mkdir(parents=True)
        for name in ("front", "side", "back", "three_quarter_45"):
            (pack / "images" / (name + ".png")).write_bytes(name.encode())
        refs = {key: "images/" + key + ".png" for key in
                ("front", "side", "back", "three_quarter_45")}
        spec = {"source_pack": "approved", "category": "character",
                "input_mode": "image", "character_colab_workflow": WORKFLOW,
                "reference_views": refs}
        model = root / "model.glb"
        model.write_bytes(b"fixture for hash binding only")
        ref = reference_views(root, spec, pack / "images/front.png")
        return spec, ref, model

    def review(self, out, spec, ref, model, **overrides):
        record = {"schema": REVIEW_SCHEMA, "asset_id": "mdl-example",
                  "model_sha256": sha256_file(model),
                  "reference_sha256": ref["reference_sha256"],
                  "reviewer": "human-reviewer", "method": "human",
                  "scores": {"silhouette": .95, "face": .95, "outfit": .95,
                             "details": .95, "texture": .95}, "issues": []}
        record.update(overrides)
        out.write_text(json.dumps(record), encoding="utf8")

    def test_source_and_missing_report_are_not_approval(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec, ref, model = self.setup_job(root)
            self.assertTrue(enabled(spec, "colab"))
            self.assertFalse(enabled({"category": "character"}, "colab"))
            with self.assertRaisesRegex(ValueError, "character-colab/2 requires"):
                enabled(spec, "ai_blender")
            self.assertEqual(len(ref["views"]), 4)
            gate = assess(model, root / "not-created.json", ref, spec, "mdl-example")
            self.assertEqual(gate["next_action"], "ASSESS_FIRST_RESULT")
            self.assertFalse(gate["allow_rig"])

    def test_refs_must_include_real_45_degree_and_no_escape(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec, _, _ = self.setup_job(root)
            image = root / "01_portraits/approved/images/front.png"
            del spec["reference_views"]["three_quarter_45"]
            with self.assertRaisesRegex(ValueError, "three_quarter_45"):
                reference_views(root, spec, image)
            spec["reference_views"]["three_quarter_45"] = "../../other.png"
            with self.assertRaisesRegex(ValueError, "missing/unsafe"):
                reference_views(root, spec, image)

    def test_valid_scored_review_allows_rig_but_stale_does_not(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec, ref, model = self.setup_job(root)
            report = root / "review.json"
            self.review(report, spec, ref, model)
            self.assertEqual(assess(model, report, ref, spec, "mdl-example")["next_action"], "CONTINUE_RIG")
            model.write_bytes(b"changed model")
            with self.assertRaisesRegex(ValueError, "stale"):
                assess(model, report, ref, spec, "mdl-example")

    def test_conditional_mv_texture_and_retry_cap(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec, ref, model = self.setup_job(root)
            report = root / "review.json"
            self.review(report, spec, ref, model, issues=[{"type": "missing_angle"}],
                        scores={"silhouette": .80, "face": .75, "outfit": .9, "details": .8, "texture": .9})
            self.assertEqual(assess(model, report, ref, spec, "mdl-example")["next_action"], "REQUEST_MV_ADAPTER")
            spec["mv_adapter_passes"] = 1
            self.assertEqual(assess(model, report, ref, spec, "mdl-example")["next_action"],
                             "REVISE_PROMPT_OR_COMPARE_BACKEND")
            self.review(report, spec, ref, model,
                        scores={"silhouette": .9, "face": .9, "outfit": .9, "details": .9, "texture": .50})
            self.assertEqual(assess(model, report, ref, spec, "mdl-example")["next_action"], "REFINE_TEXTURE")
            self.review(report, spec, ref, model,
                        scores={"silhouette": .65, "face": .65, "outfit": .9, "details": .9, "texture": .9})
            spec["generation_attempt"] = 3
            self.assertEqual(assess(model, report, ref, spec, "mdl-example")["next_action"], "HUMAN_REVIEW_MODEL")
            spec["generation_attempt"] = 4
            with self.assertRaisesRegex(ValueError, "generation_attempt"):
                assess(model, report, ref, spec, "mdl-example")



    def test_subject_v3_requires_real_review_and_preserves_category_layout(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "characters"
            folder = root / "chr_test"
            pictures = folder / "_01_portrait"
            reviews = folder / "_02_review_portrait"
            pictures.mkdir(parents=True)
            reviews.mkdir(parents=True)
            for name in ("front", "side", "back", "three_quarter_45"):
                (pictures / (name + ".png")).write_bytes(name.encode())
            review = reviews / "review.json"
            review.write_text(json.dumps({"status": "ok", "subject_id": "chr_test",
                                          "source_pack": "portrait_v1"}), encoding="utf8")
            spec = {"category": "character", "input_mode": "image", "subject_id": "chr_test",
                    "source_pack": "portrait_v1", "source_layout": "subject_v3",
                    "character_colab_workflow": WORKFLOW,
                    "portrait_review": "_02_review_portrait/review.json",
                    "source_image": "_01_portrait/front.png",
                    "reference_views": {v: "_01_portrait/" + v + ".png" for v in
                                        ("front", "side", "back", "three_quarter_45")}}
            source = validate_subject_v3(root, spec)
            self.assertEqual(source, pictures / "front.png")
            self.assertEqual(len(reference_views(root, spec, source)["views"]), 4)
            with self.assertRaisesRegex(ValueError, "relative path"):
                validate_subject_v3(root, dict(spec, source_image="..\\\\front.png"))
            review.write_text(json.dumps({"status": "reject", "subject_id": "chr_test",
                                          "source_pack": "portrait_v1"}), encoding="utf8")
            with self.assertRaisesRegex(ValueError, "not approved"):
                validate_subject_v3(root, spec)
            review.write_text(json.dumps({"status": "ok", "subject_id": "chr_other",
                                          "source_pack": "portrait_v1"}), encoding="utf8")
            with self.assertRaisesRegex(ValueError, "not approved"):
                validate_subject_v3(root, spec)

if __name__ == "__main__":
    unittest.main()
