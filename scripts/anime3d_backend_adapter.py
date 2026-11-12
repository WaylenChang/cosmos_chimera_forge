#!/usr/bin/env python3
"""Official AniGen, Pixal3D and PartCrafter CLI adapters for Anime3D.

Each upstream model runs under its own installed Python environment. No weights
or unknown scripts are bundled. A fresh temporary output is parsed as glTF 2.0
before it is atomically published. All commands are execve argv, never shell.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import shutil
import struct
import subprocess
import sys
import tempfile

MODELS = ("anigen", "pixal3d", "partcrafter")
SCRIPTS = {
    "anigen": "example.py",
    "pixal3d": "inference.py",
    "partcrafter": "scripts/inference_partcrafter.py",
}


class BackendError(RuntimeError):
    pass


def read_json(path: Path) -> dict:
    obj = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(obj, dict):
        raise BackendError(f"Expected an object in {path}")
    return obj


def validate_glb(path: Path) -> dict:
    """Check GLB structure, a real mesh and exact declared file length.

    Does not imply surface quality; Blender handles geometry/rig/visual QA.
    """
    if not path.is_file():
        raise BackendError(f"Expected GLB not produced: {path}")
    size = path.stat().st_size
    if size < 40:
        raise BackendError(f"GLB too short: {path}")
    with path.open("rb") as stream:
        hdr = stream.read(12)
        if len(hdr) != 12:
            raise BackendError("Truncated GLB header")
        magic, version, declared = struct.unpack("<4sII", hdr)
        if magic != b"glTF" or version != 2 or declared != size:
            raise BackendError("Invalid GLB magic/version/length")
        chunk = stream.read(8)
        if len(chunk) != 8:
            raise BackendError("Missing GLB JSON chunk")
        json_length, chunk_type = struct.unpack("<I4s", chunk)
        if chunk_type != b"JSON" or json_length < 2 or json_length > size - 20:
            raise BackendError("Invalid GLB JSON chunk")
        try:
            data = json.loads(stream.read(json_length))
        except (UnicodeError, json.JSONDecodeError) as exc:
            raise BackendError("Invalid GLB JSON data") from exc
        if not isinstance(data, dict) or data.get("asset", {}).get("version") != "2.0":
            raise BackendError("Invalid glTF asset version")
        if not isinstance(data.get("meshes"), list) or not data["meshes"]:
            raise BackendError("GLB contains no meshes")
        if not isinstance(data.get("nodes"), list) or not data["nodes"]:
            raise BackendError("GLB contains no scene nodes")
        return {"size": size, "mesh_count": len(data["meshes"]), "node_count": len(data["nodes"])}


def runtime_config(backend: str, config_path: Path) -> dict:
    config = read_json(config_path)
    raw = config.get(backend)
    if not isinstance(raw, dict):
        raise BackendError(f"Missing '{backend}' in backend config")
    if not raw.get("repo") or not raw.get("python"):
        raise BackendError(f"{backend} requires repo and python paths")
    repo = Path(raw["repo"]).expanduser().resolve()
    python = Path(raw["python"]).expanduser().resolve()
    script = repo / SCRIPTS[backend]
    if not repo.is_dir() or not script.is_file():
        raise BackendError(f"Installed {backend} repository/script not found: {script}")
    if not python.is_file():
        raise BackendError(f"Python for {backend} not found: {python}")
    if not os.access(python, os.X_OK):
        raise BackendError(f"Python not executable: {python}")
    return {"repo": repo, "python": python, "script": script,
            "low_vram": raw.get("low_vram") is True,
            "attn_backend": "sdpa" if raw.get("attn_backend") == "sdpa" else None}


def secure_views_folder(spec: dict, source_folder: Path) -> Path | None:
    raw = spec.get("multiview_dir")
    if raw in (None, ""):
        return None
    if not isinstance(raw, str) or Path(raw).is_absolute():
        raise BackendError("multiview_dir must be relative to the approved source folder")
    source_folder = source_folder.resolve()
    path = (source_folder / raw).resolve()
    if not path.is_relative_to(source_folder):
        raise BackendError("multiview_dir escapes approved source folder")
    metadata = path / "transforms.json"
    if not metadata.is_file():
        raise BackendError("Pixal3D multi-view requires transforms.json and calibrated camera poses")
    record = read_json(metadata)
    frames = record.get("frames")
    if not isinstance(frames, list) or not 2 <= len(frames) <= 16:
        raise BackendError("Multiview frames must contain 2 to 16 calibrated views")
    for frame in frames:
        if not isinstance(frame, dict) or not isinstance(frame.get("file_path"), str):
            raise BackendError("Invalid multiview frame")
        image = (path / frame["file_path"]).resolve()
        if not image.is_relative_to(path) or not image.is_file():
            raise BackendError("Missing/unsafe multi-view image path")
        matrix = frame.get("transform_matrix")
        if not isinstance(matrix, list) or len(matrix) != 4 or any(
            not isinstance(row, list) or len(row) != 4 for row in matrix
        ):
            raise BackendError("Each view must specify a 4x4 camera transform")
        if "camera_angle_x" not in frame and "camera_angle_x" not in record:
            raise BackendError("Missing multiview camera_angle_x")
    return path


def build_command(backend: str, runtime: dict, image: Path, spec: dict, staging: Path, tag: str) -> tuple[list[str], Path]:
    """Create argv and unique expected output for upstream official CLIs."""
    if backend not in MODELS:
        raise BackendError("Unknown image backend")
    seed = spec.get("seed", 42)
    if isinstance(seed, bool) or not isinstance(seed, int) or not 0 <= seed <= 2**31 - 1:
        raise BackendError("seed must be an integer within [0, 2^31-1]")
    py, script = str(runtime["python"]), str(runtime["script"])
    if backend == "anigen":
        expected = staging / tag / "mesh.glb"
        argv = [py, script, "--image_path", str(image), "--output_dir", str(staging),
                "--output_name", tag, "--seed", str(seed)]
        density = spec.get("joints_density", 1)
        if not isinstance(density, int) or isinstance(density, bool) or density not in range(5):
            raise BackendError("AniGen joints_density must be 0..4")
        argv += ["--joints_density", str(density)]
    elif backend == "pixal3d":
        expected = staging / "pixal_result.glb"
        argv = [py, script, "--image", str(image), "--output", str(expected), "--seed", str(seed)]
        if runtime["low_vram"]:
            argv.append("--low_vram")
        views = secure_views_folder(spec, image.parent.parent if image.parent.name == "images" else image.parent)
        if views:
            argv[1] = str(runtime["repo"] / "inference_mv.py")
            if not Path(argv[1]).is_file():
                raise BackendError("Pixal3D multi-view script unavailable")
            image_arg = argv.index("--image")
            argv[image_arg:image_arg+2] = ["--views_dir", str(views)]
    else:
        expected = staging / tag / "object.glb"
        parts = spec.get("num_parts")
        if parts is None:
            part_defs = spec.get("parts") or []
            parts = len(part_defs) if isinstance(part_defs, list) and part_defs else 4
        if isinstance(parts, bool) or not isinstance(parts, int) or not 1 <= parts <= 16:
            raise BackendError("PartCrafter num_parts must be 1..16")
        argv = [py, script, "--image_path", str(image), "--num_parts", str(parts),
                "--output_dir", str(staging), "--tag", tag, "--seed", str(seed)]
        if spec.get("remove_background") is True:
            argv.append("--rmbg")
    return argv, expected


def run(backend: str, config: Path, image: Path, spec_path: Path, output: Path,
        timeout: int = 7200) -> dict:
    if backend not in MODELS:
        raise BackendError("Official adapters only support image model backends")
    if not image.is_file() or image.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
        raise BackendError("Image backend requires an existing PNG/JPG/WebP")
    spec = read_json(spec_path)
    if (spec.get("input_mode") or "image") != "image":
        raise BackendError("Image adapter cannot process prompt-to-3D")
    runtime = runtime_config(backend, config)
    output = output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    tag = "typed_" + re.sub("[^a-zA-Z0-9_]", "_", output.stem)[:64]
    with tempfile.TemporaryDirectory(prefix=f"{backend}_", dir=str(output.parent)) as workdir:
        stage = Path(workdir)
        command, expected = build_command(backend, runtime, image.resolve(), spec, stage, tag)
        env = os.environ.copy()
        if runtime["attn_backend"]:
            env["ATTN_BACKEND"] = runtime["attn_backend"]
        result = subprocess.run(command, cwd=runtime["repo"], env=env, text=True,
                                capture_output=True, check=False, timeout=timeout)
        if result.returncode != 0:
            raise BackendError(f"{backend} exited {result.returncode}: {result.stderr[-1600:]}")
        info = validate_glb(expected)
        if backend == "partcrafter":
            parts = sorted((stage / tag).glob("part_*.glb"))
            if not parts:
                raise BackendError("PartCrafter did not deliver separate part meshes")
            for part in parts:
                validate_glb(part)
            partdir = output.parent / "parts"
            partdir.mkdir(parents=True, exist_ok=True)
            # Work only on fresh results; discard stale, mismatching part files.
            for old in partdir.glob("part_*.glb"):
                old.unlink()
            for part in parts:
                shutil.copy2(part, partdir / part.name)
            info["parts"] = [str((partdir / part.name).name) for part in parts]
        staged = output.with_suffix(".partial")
        shutil.copy2(expected, staged)
        os.replace(staged, output)
        return {"backend": backend, "model": str(output), "glb": info,
                "stdout_tail": result.stdout[-2000:]}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--backend", choices=MODELS, required=True)
    p.add_argument("--config", type=Path, required=True)
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--spec", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--timeout", type=int, default=7200)
    args = p.parse_args()
    try:
        print(json.dumps(run(args.backend, args.config, args.input, args.spec, args.output,
                             args.timeout), ensure_ascii=False))
        return 0
    except (BackendError, OSError, subprocess.TimeoutExpired) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
