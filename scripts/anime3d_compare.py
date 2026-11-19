#!/usr/bin/env python3
"""CPU-only, fail-closed comparison of Image-to-3D candidate GLBs.

This module NEVER installs models, starts inference, requests a GPU or approves
an asset. Generation remains the responsibility of isolated backend adapters.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from anime3d_backend_adapter import BackendError, validate_glb

BACKENDS = ("pixal3d", "trellis2", "hunyuan3d21")
CRITERIA = {
    "face": 30, "hair": 20, "clothing": 20,
    "accessories": 15, "texture": 10, "mesh": 5,
}


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def safe_id(value: str) -> str:
    if not value or value in {".", ".."} or any(c not in
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_" for c in value):
        raise ValueError("Invalid asset ID")
    return value


def candidate_path(root: Path, asset_id: str, backend: str) -> Path:
    if backend not in BACKENDS:
        raise ValueError("Unsupported candidate backend: " + backend)
    return root / "02_3d" / "colab" / safe_id(asset_id) / "candidates" / backend / "source.glb"


def compare(root: Path, asset_id: str, backends: list[str]) -> dict:
    """Read-only comparison inventory; no scores are fabricated."""
    if not backends or len(backends) != len(set(backends)):
        raise ValueError("Backends must be a nonempty unique list")
    root = root.resolve()
    result = {
        "spec": "cosmimera-image3d-comparison/1",
        "asset_id": safe_id(asset_id),
        "status": "REVIEW_REQUIRED",
        "quality_weights": CRITERIA,
        "selected_backend": None,
        "human_approved": False,
        "candidates": {},
    }
    for backend in backends:
        path = candidate_path(root, asset_id, backend)
        if not path.is_file() or path.is_symlink():
            result["candidates"][backend] = {"status": "MISSING", "reason": "No candidate GLB"}
            continue
        try:
            glb = validate_glb(path)
            result["candidates"][backend] = {
                "status": "QA_PENDING",
                "path": path.relative_to(root).as_posix(),
                "sha256": digest(path),
                "glb_structure": glb,
                "visual_scores": None,
                "rig_compatible": None,
            }
        except (OSError, ValueError, RuntimeError, BackendError) as exc:
            result["candidates"][backend] = {
                "status": "INVALID", "reason": str(exc),
            }
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--asset-id", required=True)
    parser.add_argument("--backends", nargs="+", choices=BACKENDS, default=list(BACKENDS))
    parser.add_argument("--report", type=Path, help="Optional JSON output; never overwrites approved assets")
    args = parser.parse_args()
    result = compare(args.root, args.asset_id, args.backends)
    payload = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.report:
        target = args.report.resolve()
        approved_root = (args.root.resolve() / "02_3d" / "colab" / safe_id(args.asset_id)).resolve()
        if not target.is_relative_to(approved_root):
            parser.error("--report must be inside the comparison asset directory")
        if target.name != "comparison.json":
            parser.error("--report filename must be comparison.json")
        if target.is_symlink():
            parser.error("--report must not be a symlink")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(payload, encoding="utf-8")
    print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
