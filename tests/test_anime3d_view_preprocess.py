"""CPU-only tests; no pretrained model, GPU or Drive connection required."""
from __future__ import annotations

from pathlib import Path
import sys
import tempfile
import unittest

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from anime3d_view_preprocess import ViewError, prepare, sha256


class PreprocessTests(unittest.TestCase):
    def make_image(self, path, width, height, color):
        im = Image.new("RGB", (width, height), (80, 80, 80))
        d = ImageDraw.Draw(im)
        d.rectangle((width // 3, 20, width * 2 // 3, height - 20), fill=color)
        im.save(path)

    def setup_pack(self, base):
        folder = base / "characters" / "chr_character"
        raw = folder / "_01_portrait"
        raw.mkdir(parents=True)
        self.make_image(raw / "front.png", 300, 400, (235, 150, 55))
        self.make_image(raw / "three_quarter_45.png", 300, 400, (220, 145, 60))
        sheet = Image.new("RGB", (900, 400), (80, 80, 80))
        d = ImageDraw.Draw(sheet)
        for n, color in enumerate(((235, 150, 55), (75, 170, 210), (40, 100, 220))):
            left = n * 300
            d.rectangle((left + 100, 20, left + 200, 380), fill=color)
        sheet.save(raw / "turnaround.png")
        spec = {"asset_id": "mdl_a", "subject_id": "chr_test", "category": "character",
                "input_mode": "image", "source_image": "_01_portrait/front.png",
                "reference_views": {"front": "_01_portrait/front.png",
                                    "turnaround": "_01_portrait/turnaround.png",
                                    "three_quarter_45": "_01_portrait/three_quarter_45.png"},
                "view_preprocess": {"sheet": {"layout": "equal_columns", "order": ["front", "side", "back"]},
                                    "side_orientation": "left",
                                    "background": {"mode": "solid_color", "color": "#505050", "tolerance": 4}}}
        return folder, spec

    def test_crop_alpha_normalize_hash_receipt_and_idempotence(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder, spec = self.setup_pack(Path(tmp))
            out = folder / "_03a_colab" / "mdl_a"
            record = prepare(folder, spec, out, 512)
            self.assertEqual(record["status"], "REVIEW_REQUIRED")
            self.assertFalse(record["views_consumed_by_backend"])
            self.assertEqual(set(record["processed"]), {"front", "side", "back"})
            self.assertEqual(record["sheet_regions_px"]["side"], [300, 0, 600, 400])
            with Image.open(out / "inputs" / "side.png") as im:
                self.assertEqual(im.size, (512, 512))
                self.assertEqual(im.mode, "RGBA")
                self.assertEqual(im.getpixel((0, 0))[3], 0)
                self.assertGreater(im.getpixel((256, 256))[3], 0)
            for role in ("front", "side", "back"):
                self.assertEqual(record["processed"][role]["sha256"], sha256(out / "inputs" / (role + ".png")))
            self.assertEqual(prepare(folder, spec, out, 512), record)
            with Image.open(folder / "_01_portrait" / "front.png") as im:
                self.assertEqual(im.mode, "RGB")

    def test_no_guessing_or_unsafe_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder, spec = self.setup_pack(Path(tmp))
            out = folder / "_03a_colab" / "mdl_a"
            spec["view_preprocess"]["sheet"].pop("layout")
            with self.assertRaisesRegex(ViewError, "Unknown sheet geometry"):
                prepare(folder, spec, out, 512)
            spec["view_preprocess"]["sheet"]["layout"] = "equal_columns"
            spec["view_preprocess"]["sheet"]["order"] = ["front", "side", "side"]
            with self.assertRaisesRegex(ViewError, "sheet.order"):
                prepare(folder, spec, out, 512)
            spec["view_preprocess"]["sheet"]["order"] = ["front", "side", "back"]
            spec["reference_views"]["turnaround"] = "../../not_approved.png"
            with self.assertRaisesRegex(ViewError, "unsafe"):
                prepare(folder, spec, out, 512)

    def test_changed_source_cannot_overwrite_receipt(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder, spec = self.setup_pack(Path(tmp))
            out = folder / "_03a_colab" / "mdl_a"
            prepare(folder, spec, out, 512)
            self.make_image(folder / "_01_portrait" / "front.png", 300, 400, (20, 200, 20))
            with self.assertRaisesRegex(ViewError, "fresh asset_id"):
                prepare(folder, spec, out, 512)
            self.assertTrue((out / "inputs/front.png").is_file())

    def test_already_split_images_are_supported(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder, spec = self.setup_pack(Path(tmp))
            ref = spec["reference_views"]
            del ref["turnaround"]
            for role in ("side", "back"):
                self.make_image(folder / "_01_portrait" / (role + ".png"), 300, 400, (120, 170, 100))
                ref[role] = "_01_portrait/" + role + ".png"
            del spec["view_preprocess"]["sheet"]
            record = prepare(folder, spec, folder / "_03a_colab" / "mdl_a", 512)
            self.assertIsNone(record["sheet_regions_px"])
            self.assertEqual(len(record["processed"]), 3)

if __name__ == "__main__":
    unittest.main()
