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
        self.assertEqual(p.returncode, 0, (p.stdout + p.stderr)[-4000:] + "\\nState: " + debug)
        self.assertTrue((out / "models" / f"{name}.blend").is_file())
        self.assertTrue((out / "models" / f"{name}.glb").is_file())
        self.assertTrue((out / "source" / f"{name}.glb").is_file())
        self.assertTrue((out / "previews" / "qa_front.png").is_file())
        self.assertTrue((out / "qa" / "typed_metrics.json").is_file())
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


if __name__ == "__main__":
    unittest.main()
