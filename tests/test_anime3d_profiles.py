import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

BASE = Path(__file__).resolve().parents[1] / "scripts"
import sys
sys.path.insert(0, str(BASE))
from anime3d_profiles import classify, QA_BY_TOPOLOGY, PROCEDURAL


class TypedRoutingTests(unittest.TestCase):
    def test_every_topology_has_qa_and_motion(self):
        for topology, motion in PROCEDURAL.items():
            with self.subTest(topology=topology):
                result = classify({"asset_class": "fantasy_creature", "anatomy": topology})
                self.assertEqual(result["anatomy"], topology)
                self.assertTrue(QA_BY_TOPOLOGY[topology])
                self.assertTrue(result["rig_strategy"])
                self.assertTrue(result["backend_priority"])
                self.assertTrue(result["qa_checks"])
                self.assertTrue(motion)

    def test_catalog_parent_coverage(self):
        catalog = (BASE.parent / "catalog.js").read_text(encoding="utf8")
        start = catalog.index("base_parents: [")
        end = catalog.index("base_count:", start)
        import re
        parents = re.findall(r'\{\s*v:\s*"([^"]+)"', catalog[start:end])
        self.assertGreaterEqual(len(parents), 40)
        for parent in parents:
            if parent == "未知":
                continue
            profile = classify({"base_parents": [parent]})
            self.assertIn(profile["anatomy"], PROCEDURAL, parent)
            if parent.startswith(("科幻機械·", "載具·", "器械·", "裝備·")):
                self.assertEqual(profile["surface_mode"], "rigid", parent)

    def test_organic_hybrid_is_not_biped(self):
        v = classify({"asset_class": "fantasy_creature", "limbs": {"legs": 4, "wings": 2, "tails": 1}})
        self.assertEqual(v["anatomy"], "winged_quadruped")
        self.assertIsNone(v["rig_type"])
        self.assertIn("wing_pose_sweep", v["qa_checks"])
        self.assertIn("fly", v["procedural_clips"])
        self.assertEqual(v["unsupported"], [])

    def test_six_legged_and_serpentine(self):
        bug = classify({"asset_class": "animal", "limbs": {"legs": 6}})
        self.assertEqual(bug["anatomy"], "hexapod")
        self.assertIn("tripo", bug["backend_priority"])
        snake = classify({"anatomy": "snake", "requested_clips": ["march", "attack", "unknown"]})
        self.assertEqual(snake["anatomy"], "serpentine")
        self.assertEqual(snake["tripo_clips"], ["march"])
        self.assertEqual(snake["procedural_clips"], ["attack"])
        self.assertEqual(snake["unsupported"], ["unknown"])

    def test_multiple_origins_do_not_force_incorrect_rig(self):
        v = classify({"base_parents": ["生物·哺乳類", "科幻機械·仿生機獸"]})
        self.assertEqual(v["surface_mode"], "hybrid")
        self.assertEqual(v["anatomy"], "hybrid")
        self.assertIn("landmark_completeness", v["qa_checks"])
        self.assertTrue(v["warnings"])

    def test_robot_leg_count_keeps_rigid_kinematics(self):
        expected = {2: "humanoid_mecha", 4: "quadruped_mecha", 6: "multi_leg_mecha", 8: "multi_leg_mecha"}
        for legs, anatomy in expected.items():
            with self.subTest(legs=legs):
                profile = classify({"asset_class": "robot", "limbs": {"legs": legs}})
                self.assertEqual(profile["anatomy"], anatomy)
                self.assertEqual(profile["rig_strategy"], "rigid_part_hierarchy")
                self.assertEqual(profile["surface_mode"], "rigid")
        explicit = classify({"asset_class": "robot", "anatomy": "humanoid_mecha", "limbs": {"legs": 4}})
        self.assertEqual(explicit["anatomy"], "humanoid_mecha")

    def test_mechanical_not_skin_mapped(self):
        for topology in ["mechanism", "humanoid_mecha", "quadruped_mecha", "multi_leg_mecha"]:
            v = classify({"asset_class": "robot", "anatomy": topology, "requested_clips": ["rotate"]})
            self.assertEqual(v["rig_strategy"], "rigid_part_hierarchy")
            self.assertIsNone(v["rig_type"])

    def test_text_never_inherits_image(self):
        v = classify({"input_mode": "text", "appearance": "Original crystal serpent", "anatomy": "serpentine"})
        self.assertEqual(v["backend_priority"], ["blender_text"])
        self.assertEqual(v["input_mode"], "text")
        self.assertNotIn("tripo", v["backend_priority"])

    def test_unknown_anatomy_rejected(self):
        with self.assertRaisesRegex(ValueError, "unsupported anatomy"):
            classify({"anatomy": "incorrect_default_biped"})

    def test_no_fictional_motion_preset(self):
        v = classify({"anatomy": "avian", "requested_clips": ["fly", "teleport", "idle"]})
        self.assertEqual(v["tripo_clips"], [])
        self.assertEqual(v["unsupported"], ["teleport"])

    def test_runner_plan_does_not_use_paid_api_or_synthesize_mesh(self):
        from anime3d_universal import run
        from argparse import Namespace
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            spec = root / "spec.json"
            spec.write_text(json.dumps({"input_mode": "text", "appearance": "Original floating gemstone",
                                        "anatomy": "object", "asset_class": "fantasy_creature"}), encoding="utf8")
            args = Namespace(root=str(root), asset_id="mdl-test", spec=str(spec), execute=False,
                             allow_paid_tripo=False, backend="auto",
                             generator_executable=None, input_model=None, blender=None)
            self.assertEqual(run(args), 0)
            dest = root / "02_3d" / "ai_blender" / "mdl-test"
            self.assertTrue((dest / "profile.json").is_file())
            self.assertFalse((dest / "models" / "mdl-test.glb").exists())
            self.assertEqual(json.loads((dest / "typed_state.json").read_text())["status"], "QUEUED")

    def test_unconfigured_adapter_returns_review(self):
        from anime3d_universal import run
        from argparse import Namespace
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            spec = root / "spec.json"
            spec.write_text(json.dumps({"input_mode": "text", "appearance": "Original plant creature",
                                        "anatomy": "plant"}), encoding="utf8")
            args = Namespace(root=str(root), asset_id="mdl-test", spec=str(spec), execute=True,
                             allow_paid_tripo=False, backend="auto",
                             generator_executable=None, input_model=None, blender=None)
            self.assertEqual(run(args), 2)
            state = json.loads((root / "02_3d" / "ai_blender" / "mdl-test" / "typed_state.json").read_text())
            self.assertEqual(state["status"], "REVIEW_REQUIRED")


if __name__ == "__main__":
    unittest.main()
