"""Backend command and file-format tests that run without a GPU or weights."""
from __future__ import annotations
import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from anime3d_backend_adapter import BackendError, build_command, validate_glb, secure_views_folder


def fake_glb(path: Path) -> None:
    """Valid tiny glTF container. Only for command-validation tests."""
    doc = {"asset": {"version": "2.0"}, "scenes": [{"nodes": [0]}], "scene": 0,
           "nodes": [{"mesh": 0}], "meshes": [{"primitives": [{"attributes": {"POSITION": 0}}]}],
           "buffers": [{"byteLength": 0}], "bufferViews": [], "accessors": []}
    body = json.dumps(doc).encode("utf-8")
    body += b" " * ((4 - len(body) % 4) % 4)
    path.write_bytes(struct.pack("<4sII", b"glTF", 2, 20 + len(body)) +
                     struct.pack("<I4s", len(body), b"JSON") + body)


class BackendTests(unittest.TestCase):
    def setUp(self):
        self.work = tempfile.TemporaryDirectory()
        self.addCleanup(self.work.cleanup)
        self.root = Path(self.work.name)
        self.img = self.root / "approved.png"
        self.img.write_bytes(b"sample source image fixture")
        self.runtime = {"python": Path("/venv/bin/python"), "repo": self.root,
                        "script": self.root / "example.py", "low_vram": True,
                        "attn_backend": "sdpa"}

    def test_valid_and_invalid_containers(self):
        path = self.root / "good.glb"
        fake_glb(path)
        self.assertEqual(validate_glb(path)["mesh_count"], 1)
        path.write_bytes(b"glTF" + b"fake" * 100)
        with self.assertRaises(BackendError):
            validate_glb(path)

    def test_anigen_exact_upstream_flags(self):
        cmd, out = build_command("anigen", self.runtime, self.img,
                                 {"seed": 7, "joints_density": 2}, self.root, "job_1")
        self.assertEqual(out, self.root / "job_1" / "mesh.glb")
        self.assertIn("--output_name", cmd)
        self.assertEqual(cmd[cmd.index("--joints_density") + 1], "2")
        self.assertIn("--image_path", cmd)

    def test_pixal3d_low_vram(self):
        cmd, out = build_command("pixal3d", self.runtime, self.img, {},
                                 self.root, "job_1")
        self.assertIn("--low_vram", cmd)
        self.assertEqual(cmd[cmd.index("--output") + 1], str(out))

    def test_pixal_multiview_requires_real_camera_data(self):
        with self.assertRaises(BackendError):
            secure_views_folder({"multiview_dir": "../../private"}, self.root)
        views = self.root / "views"
        views.mkdir()
        self.assertIsNone(secure_views_folder({}, self.root))
        (views / "transforms.json").write_text(json.dumps({
            "camera_angle_x": .8,
            "frames": [
                {"file_path": "../private.png", "transform_matrix": [[1, 0, 0, 0]] * 4},
                {"file_path": "back.png", "transform_matrix": [[1, 0, 0, 0]] * 4}
            ]}), encoding="utf-8")
        with self.assertRaisesRegex(BackendError, "unsafe"):
            secure_views_folder({"multiview_dir": "views"}, self.root)

    def test_partcrafter_requires_parts(self):
        cmd, out = build_command("partcrafter", self.runtime, self.img,
                                 {"num_parts": 6}, self.root, "machine")
        self.assertEqual(out, self.root / "machine" / "object.glb")
        self.assertIn("--num_parts", cmd)
        self.assertEqual(cmd[cmd.index("--num_parts") + 1], "6")
        with self.assertRaises(BackendError):
            build_command("partcrafter", self.runtime, self.img,
                          {"num_parts": 200}, self.root, "machine")

    def test_refuse_invalid_seed(self):
        with self.assertRaises(BackendError):
            build_command("pixal3d", self.runtime, self.img, {"seed": "1"}, self.root, "x")


if __name__ == "__main__":
    unittest.main()
