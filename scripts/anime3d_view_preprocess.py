#!/usr/bin/env python3
"""CPU-only, non-destructive preparation of approved character view images.

This creates image files for a future multi-image adapter, NOT calibrated camera
poses, source approval, automated artwork QA, or model invocation.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re

from PIL import Image, ImageOps

SCHEMA = "cosmimera-character-view-preprocess/1"
FORMATS = {".png", ".jpg", ".jpeg", ".webp"}
ROLES = ("front", "side", "back")


class ViewError(ValueError):
    pass


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def source_file(root: Path, relative: str) -> Path:
    if not isinstance(relative, str) or not relative or Path(relative).is_absolute() or "\\" in relative:
        raise ViewError("Input path must be a nonempty relative path")
    path = (root / relative).resolve()
    if not path.is_relative_to(root) or not path.is_file() or path.is_symlink():
        raise ViewError("Missing or unsafe input path: " + relative)
    if path.suffix.lower() not in FORMATS or not (0 < path.stat().st_size <= 20 * 1024 * 1024):
        raise ViewError("Input must be a nonempty PNG/JPEG/WebP <=20MiB")
    return path


def load_image(path: Path) -> Image.Image:
    try:
        with Image.open(path) as img:
            img = ImageOps.exif_transpose(img)
            img.load()
            if not (128 <= img.width <= 8192 and 128 <= img.height <= 8192):
                raise ViewError("Image dimensions must be 128..8192 px")
            if img.width * img.height > 32_000_000:
                raise ViewError("Image exceeds 32 megapixels")
            return img.convert("RGBA")
    except (OSError, ValueError) as exc:
        raise ViewError("Unusable image " + str(path.name) + ": " + str(exc)) from exc


def sheet_regions(sheet: Image.Image, settings: dict) -> dict:
    if not isinstance(settings, dict):
        raise ViewError("turnaround sheet requires view_preprocess.sheet")
    order = settings.get("order")
    if not isinstance(order, list) or sorted(order) != sorted(ROLES):
        raise ViewError("sheet.order must explicitly identify front, side, back")
    regions = settings.get("regions")
    if regions is None:
        if settings.get("layout") != "equal_columns":
            raise ViewError("Unknown sheet geometry: set regions or layout=equal_columns")
        # A declared equal-columns layout is a user-verified geometry contract,
        # not a visual guess by the preprocessing script.
        regions = {name: [i / 3, 0, (i + 1) / 3, 1]
                   for i, name in enumerate(order)}
    if not isinstance(regions, dict) or set(regions) != set(ROLES):
        raise ViewError("sheet.regions must provide exactly front, side, back")
    boxes = {}
    for role, region in regions.items():
        if (not isinstance(region, list) or len(region) != 4 or
                any(isinstance(v, bool) or not isinstance(v, (int, float)) for v in region)):
            raise ViewError("Each sheet region requires [left, top, right, bottom]")
        left, top, right, bottom = region
        if not (0 <= left < right <= 1 and 0 <= top < bottom <= 1):
            raise ViewError("Sheet region bounds must be normalized and nonempty")
        pixel = (round(left * sheet.width), round(top * sheet.height),
                 round(right * sheet.width), round(bottom * sheet.height))
        if pixel[2] - pixel[0] < 128 or pixel[3] - pixel[1] < 128:
            raise ViewError("Sheet panel too small")
        boxes[role] = pixel
    for role in ROLES:
        for other in ROLES:
            if role >= other:
                continue
            a, b = boxes[role], boxes[other]
            overlap = (min(a[2], b[2]) - max(a[0], b[0]) > 1 and
                       min(a[3], b[3]) - max(a[1], b[1]) > 1)
            if overlap:
                raise ViewError("Sheet regions overlap")
    return boxes


def rgba_background(image: Image.Image, cfg: dict, role: str, root: Path) -> tuple[Image.Image, list[str]]:
    mode = cfg.get("mode")
    warnings = []
    if mode == "existing_alpha":
        a = image.getchannel("A")
        lo, hi = a.getextrema()
        if lo == 255 or hi == 0:
            raise ViewError("existing_alpha requires a nonempty alpha foreground/background")
    elif mode == "solid_color":
        color = cfg.get("color")
        tol = cfg.get("tolerance", 12)
        if (not isinstance(color, str) or not re.fullmatch(r"#[0-9A-Fa-f]{6}", color) or
                isinstance(tol, bool) or not isinstance(tol, int) or not 0 <= tol <= 32):
            raise ViewError("solid_color requires #RRGGBB and integer tolerance 0..32")
        rgb = tuple(int(color[i:i + 2], 16) for i in (1, 3, 5))
        # Explicit uniform-key removal is conservative about no inferred color;
        # it can erase same-color clothes and always requires visual review.
        pixels = image.get_flattened_data() if hasattr(image, "get_flattened_data") else image.getdata()
        alpha = Image.new("L", image.size)
        alpha.putdata([0 if max(abs(p[i] - rgb[i]) for i in range(3)) <= tol else p[3]
                       for p in pixels])
        image.putalpha(alpha)
        warnings.append("Uniform-color key may erase similarly colored clothing or leave edge halos")
    elif mode == "mask_file":
        masks = cfg.get("masks") or {}
        path = source_file(root, masks.get(role))
        with Image.open(path) as m:
            m.load()
            if m.size != image.size:
                raise ViewError("Mask dimensions must match its cropped view: " + role)
            image.putalpha(m.convert("L"))
    else:
        raise ViewError("Background mode must be existing_alpha, solid_color, or mask_file")
    return image, warnings


def normalise(image: Image.Image, size: int, role: str) -> tuple[Image.Image, dict]:
    alpha = image.getchannel("A")
    bbox = alpha.point(lambda x: 255 if x >= 32 else 0).getbbox()
    if bbox is None:
        raise ViewError("Foreground empty after masking: " + role)
    left, top, right, bottom = bbox
    touches = left < 2 or top < 2 or right > image.width - 2 or bottom > image.height - 2
    subject = image.crop(bbox)
    scale = min(size * 0.88 / subject.width, size * 0.86 / subject.height)
    width = max(1, round(subject.width * scale))
    height = max(1, round(subject.height * scale))
    subject = subject.resize((width, height), Image.Resampling.LANCZOS)
    target = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - width) // 2
    y = round(size * .94) - height
    target.alpha_composite(subject, (x, y))
    return target, {"source_size": list(image.size), "foreground_bbox": list(bbox),
                    "output_size": [size, size], "touched_source_edge": touches}


def prepare(root: Path, spec: dict, output: Path, size: int = 1024) -> dict:
    root = Path(root).resolve()
    output = Path(output).resolve()
    if not root.is_dir() or not output.is_relative_to(root):
        raise ViewError("Output must remain inside the selected character folder")
    if size not in (512, 768, 1024, 1536):
        raise ViewError("Target size must be 512, 768, 1024, or 1536")
    if spec.get("input_mode") != "image" or spec.get("category") not in ("character", "characters"):
        raise ViewError("Image character spec required")
    views = spec.get("reference_views")
    if not isinstance(views, dict) or "front" not in views or "three_quarter_45" not in views:
        raise ViewError("Approved front and independent 45-degree references required")
    if views["front"] != spec.get("source_image"):
        raise ViewError("reference_views.front must equal source_image")
    config = spec.get("view_preprocess")
    if not isinstance(config, dict):
        raise ViewError("view_preprocess config required")
    if config.get("side_orientation") not in ("left", "right"):
        raise ViewError("Explicit side_orientation=left|right required")
    background = config.get("background")
    if not isinstance(background, dict):
        raise ViewError("view_preprocess.background is required")
    used_paths = {"front": source_file(root, views["front"]),
                  "three_quarter_45": source_file(root, views["three_quarter_45"])}
    images = {"front": load_image(used_paths["front"])}
    sheet = None
    if "turnaround" in views:
        if "side" in views or "back" in views:
            raise ViewError("Select either turnaround or separate side/back files")
        used_paths["turnaround"] = source_file(root, views["turnaround"])
        sheet = load_image(used_paths["turnaround"])
        boxes = sheet_regions(sheet, config.get("sheet"))
        for role in ("side", "back"):
            images[role] = sheet.crop(boxes[role])
    else:
        for role in ("side", "back"):
            if role not in views:
                raise ViewError("Both side and back views are required")
            used_paths[role] = source_file(root, views[role])
            images[role] = load_image(used_paths[role])
        boxes = None
    receipt_path = output / "qa" / "view_preprocess.json"
    source_hashes = {role: sha256(path) for role, path in used_paths.items()}
    fingerprint = hashlib.sha256(json.dumps({"source_sha256": source_hashes, "config": config,
                                             "size": size, "schema": SCHEMA}, sort_keys=True).encode()).hexdigest()
    if receipt_path.is_file():
        previous = json.loads(receipt_path.read_text(encoding="utf8"))
        if previous.get("input_fingerprint") != fingerprint:
            raise ViewError("Inputs changed: use a fresh asset_id/output directory")
        if all((output / "inputs" / (role + ".png")).is_file() and
               sha256(output / "inputs" / (role + ".png")) == previous.get("processed", {}).get(role, {}).get("sha256")
               for role in ROLES):
            return previous
        raise ViewError("Existing preprocessing output is missing or modified")
    processed, notes = {}, ["Visual review required before 3D inference",
                             "No calibrated camera poses are generated",
                             "Preprocessing does not certify model consumption of views"]
    for role in ROLES:
        image, warnings = rgba_background(images[role], background, role, root)
        ready, data = normalise(image, size, role)
        if data["touched_source_edge"]:
            warnings.append("Foreground touches crop boundary; check missing hair, hands or feet")
        notes.extend(role + ": " + w for w in warnings)
        processed[role] = (ready, data)
    # Only write after every source and panel passes deterministic validation.
    target_dir = output / "inputs"
    target_dir.mkdir(parents=True, exist_ok=False)
    records = {}
    for role in ROLES:
        file = target_dir / (role + ".png")
        processed[role][0].save(file, format="PNG")
        records[role] = {"path": str(file.relative_to(output)), "sha256": sha256(file), **processed[role][1]}
    receipt = {"schema": SCHEMA, "status": "REVIEW_REQUIRED", "asset_id": spec.get("asset_id"),
               "subject_id": spec.get("subject_id"), "input_fingerprint": fingerprint,
               "original_sha256": source_hashes, "sheet_regions_px": {k: list(v) for k, v in boxes.items()} if boxes else None,
               "side_orientation": config["side_orientation"], "processed": records,
               "warnings": notes, "model_input_roles": list(ROLES),
               "inference_executed": False, "views_consumed_by_backend": False}
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    return receipt


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--subject-dir", type=Path, required=True)
    p.add_argument("--spec", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--size", type=int, default=1024)
    a = p.parse_args()
    try:
        spec = json.loads(a.spec.read_text(encoding="utf8"))
        result = prepare(a.subject_dir, spec, a.output, a.size)
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "BLOCKED", "reason": str(exc)}, ensure_ascii=False))
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
