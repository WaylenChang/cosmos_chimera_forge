"""Actual Blender/GLB integration smoke tests with synthetic, isolated fixtures.

Blender smoke tests do not require a generative GPU, third-party weights, paid
API credentials, or any user's images. Each test exercises real GLB import,
native animation, export/re-import and QA reporting through the typed runner.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


BLENDER = shutil.which("blender")
SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "anime3d_universal.py"

# The script writes one real textured GLB fixture. Test-only geometry is clearly
# labeled; production adapters never fabricate source files.
CREATE_FIXTURE = r'''
import bpy
import sys
target = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
try:
    import addon_utils
    addon_utils.enable("io_scene_gltf2", default_set=False, persistent=True)
except Exception:
    pass
bpy.ops.mesh.primitive_cube_add(size=2)
obj = bpy.context.object
obj.name = "Hatch"
obj.data.name = "SyntheticTestMesh"
mat = bpy.data.materials.new("SyntheticTestMaterial")
mat.diffuse_color = (0.28, 0.63, 0.81, 1.0)
obj.data.materials.append(mat)
bpy.ops.export_scene.gltf(filepath=target, export_format="GLB")
'''


@unittest.skipUnless(BLENDER, "Blender must be installed for mesh/animation integration tests")
class BlenderSmoke(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.input = self.root / "fixture.glb"
        fixture_script = self.root / "make_fixture.py"
        fixture_script.write_text(CREATE_FIXTURE, encoding="utf8")
        p = subprocess.run([BLENDER, "-b", "--factory-startup", "--python-exit-code", "3",
                            "--python", str(fixture_script), "--", str(self.input)],
                           capture_output=True, text=True, timeout=150)
        self.assertEqual(p.returncode, 0, p.stdout[-1500:] + p.stderr[-1500:])
        self.assertTrue(self.input.is_file(), p.stdout[-6000:] + p.stderr[-6000:])
        self.assertGreater(self.input.stat().st_size, 100)

    def process(self, name, spec):
        cfg = self.root / f"{name}.json"
        cfg.write_text(json.dumps(spec), encoding="utf8")
        p = subprocess.run([sys.executable, str(SCRIPT), "--root", str(self.root),
                            "--asset-id", name, "--spec", str(cfg), "--backend", "existing",
                            "--input-model", str(self.input), "--blender", BLENDER, "--execute"],
                           capture_output=True, text=True, timeout=240)
        out = self.root / "02_3d" / "ai_blender" / name
        state_path = self.root / "02_3d" / "ai_blender" / name / "typed_state.json"
        debug = state_path.read_text(encoding="utf8")[-6000:] if state_path.is_file() else "missing state"
        metrics_path = out / "qa/typed_metrics.json"
        if metrics_path.is_file():
            debug += "\nQA: " + metrics_path.read_text(encoding="utf8")[-6000:]
        self.assertEqual(p.returncode, 0, (p.stdout + p.stderr)[-4000:] + "\\nState: " + debug)
        self.assertTrue((out / "models" / f"{name}.blend").is_file())
        self.assertTrue((out / "models" / f"{name}.glb").is_file())
        self.assertTrue((out / "source" / f"{name}.glb").is_file())
        self.assertTrue((out / "previews" / "qa_front.png").is_file())
        self.assertTrue((out / "qa" / "typed_metrics.json").is_file())
        self.assertTrue((out / "manifest.json").is_file())
        manifest = json.loads((out / "manifest.json").read_text(encoding="utf8"))
        self.assertEqual(manifest["qa_status"], "REVIEW_REQUIRED")
        self.assertEqual(manifest["pipeline"], "ai_blender")
        self.assertIn(f"models/{name}.glb", [f["path"] for f in manifest["files"]])
        qa = json.loads((out / "qa" / "typed_metrics.json").read_text(encoding="utf8"))
        self.assertTrue(qa["hard_checks"]["export_reload"])
        self.assertEqual(qa["passed"], False, "Automated review must not approve synthetic assets")
        return qa

    def test_nonrigid_object_spin_survives_gltf(self):
        qa = self.process("fixture-object", {"input_mode": "text", "asset_class": "fantasy_creature",
                           "appearance": "Synthetic QA object; no real character",
                           "anatomy": "object", "requested_clips": ["spin"]})
        self.assertIn("spin", qa["covered_clips"])
        self.assertTrue(qa["hard_checks"]["animation_roundtrip"], qa.get("exported_actions"))

    def test_mechanical_hinge_native_animations(self):
        qa = self.process("fixture-hatch", {
            "input_mode": "text", "asset_class": "mechanical", "anatomy": "mechanism",
            "appearance": "Synthetic mechanically hinged hatch for QA",
            "parts": [{"object": "Hatch", "pivot": [0, 0, 0],
                       "joint": "hinge", "axis": [0, 1, 0], "min": 0, "max": 0.6}],
            "requested_clips": ["rotate"]})
        self.assertIn("rotate", qa["covered_clips"])
        self.assertTrue(qa["hard_checks"]["animation_roundtrip"], qa.get("exported_actions"))

    def test_mechanical_slider_native_animations(self):
        qa = self.process("fixture-slider", {
            "input_mode": "text", "asset_class": "mechanical", "anatomy": "mechanism",
            "appearance": "Synthetic sliding panel for QA",
            "parts": [{"object": "Hatch", "pivot": [0, 0, 0],
                       "joint": "slider", "axis": [1, 0, 0], "min": 0, "max": 0.4}],
            "requested_clips": ["extend"]})
        self.assertIn("extend", qa["covered_clips"])
        self.assertTrue(qa["hard_checks"]["animation_roundtrip"], qa.get("exported_actions"))

    def test_biped_skin_and_three_clips_survive_roundtrip(self):
        fixture_script = self.root / "make_biped.py"
        fixture_script.write_text(CREATE_FIXTURE + r'''
mesh = obj
bpy.ops.object.armature_add()
rig = bpy.context.object
rig.name = "SyntheticBipedRig"
bpy.ops.object.mode_set(mode="EDIT")
spine = rig.data.edit_bones[0]
spine.name = "Spine"
leg = rig.data.edit_bones.new("Leg_0_upper")
leg.head = (0, 0, 0)
leg.tail = (0, 0, -1)
leg.parent = spine
bpy.ops.object.mode_set(mode="OBJECT")
mesh.parent = rig
mod = mesh.modifiers.new("SyntheticSkin", "ARMATURE")
mod.object = rig
for name, indexes in [("Spine", [v.index for v in mesh.data.vertices if v.co.z >= 0]),
                      ("Leg_0_upper", [v.index for v in mesh.data.vertices if v.co.z < 0])]:
    group = mesh.vertex_groups.new(name=name)
    group.add(indexes, 1.0, "REPLACE")
bpy.ops.export_scene.gltf(filepath=target, export_format="GLB")
''', encoding="utf8")
        p = subprocess.run([BLENDER, "-b", "--factory-startup", "--python-exit-code", "3",
                            "--python", str(fixture_script), "--", str(self.input)],
                           capture_output=True, text=True, timeout=150)
        self.assertEqual(p.returncode, 0, (p.stdout + p.stderr)[-3000:])
        qa = self.process("fixture-biped", {
            "input_mode": "text", "asset_class": "humanoid", "anatomy": "biped",
            "appearance": "Synthetic skinned geometry for integration testing; not Chengxi",
            "requested_clips": ["idle", "walk", "run"]})
        self.assertEqual(qa["covered_clips"], ["idle", "run", "walk"])
        self.assertTrue(qa["hard_checks"]["skinning"])
        self.assertTrue(qa["hard_checks"]["animation_roundtrip"], qa.get("exported_actions"))
        # Feed the actual animated export through the Tripo-specific profile.
        # This checks preservation, without sending any vendor request.
        out = self.root / "02_3d/ai_blender/fixture-biped"
        profile = json.loads((out / "profile.json").read_text(encoding="utf8"))
        for item in profile["motion_plan"]:
            item["method"] = "tripo_preset"
        profile_path = self.root / "vendor-profile.json"
        profile_path.write_text(json.dumps(profile), encoding="utf8")
        preserved = self.root / "preserved"
        p = subprocess.run([BLENDER, "-b", "--factory-startup", "--python-exit-code", "3",
                            "--python", str(SCRIPT.with_name("anime3d_typed_blender.py")), "--",
                            str(out / "models/fixture-biped.glb"), str(preserved), str(profile_path)],
                           capture_output=True, text=True, timeout=240)
        self.assertEqual(p.returncode, 0, (p.stdout + p.stderr)[-3000:])
        result = json.loads((preserved / "qa/typed_metrics.json").read_text(encoding="utf8"))
        self.assertTrue(result["hard_checks"]["animation_roundtrip"], result.get("exported_actions"))
        self.assertTrue(all(clip["status"] == "preserved" for clip in result["motions"]))

    def test_unrigged_biped_remains_qa_pending_and_fails_command(self):
        cfg = self.root / "unrigged.json"
        cfg.write_text(json.dumps({"input_mode": "text", "asset_class": "humanoid",
                                   "appearance": "Synthetic unrigged fixture", "anatomy": "biped",
                                   "requested_clips": ["idle", "walk", "run"]}), encoding="utf8")
        p = subprocess.run([sys.executable, str(SCRIPT), "--root", str(self.root),
                            "--asset-id", "unrigged", "--spec", str(cfg), "--backend", "existing",
                            "--input-model", str(self.input), "--blender", BLENDER, "--execute"],
                           capture_output=True, text=True, timeout=240)
        self.assertEqual(p.returncode, 2, (p.stdout + p.stderr)[-3000:])
        out = self.root / "02_3d/ai_blender/unrigged"
        state = json.loads((out / "typed_state.json").read_text(encoding="utf8"))
        qa = json.loads((out / "qa/typed_metrics.json").read_text(encoding="utf8"))
        self.assertEqual(state["status"], "QA_PENDING")
        self.assertFalse(qa["hard_checks"]["skinning"])
        self.assertFalse(qa["hard_checks"]["animation_roundtrip"])
        self.assertTrue((out / "manifest.json").is_file())


if __name__ == "__main__":
    unittest.main()
