#!/usr/bin/env python3
"""Run the official SkinTokens CLI in its own installed environment.

This is a rigging adapter, not a replacement geometry generator. The original
mesh is never overwritten, and mesh-only/stale output is never accepted as a rig.
Actual deformation quality still requires Blender and visual review.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import struct
import subprocess
import tempfile

from anime3d_backend_adapter import BackendError, read_json, validate_glb


def runtime_config(config_path: Path) -> dict:
    raw = read_json(config_path).get("skintokens")
    if not isinstance(raw, dict) or not raw.get("repo") or not raw.get("python"):
        raise BackendError("SkinTokens requires its own repo and python in backend config")
    repo = Path(raw["repo"]).expanduser().resolve()
    # Keep the venv launcher path, including its symlink, for pyvenv.cfg lookup.
    python = Path(raw["python"]).expanduser().absolute()
    checkpoint = Path(raw.get("checkpoint") or
                      "experiments/articulation_xl_quantization_256_token_4/grpo_1400.ckpt")
    if not checkpoint.is_absolute():
        checkpoint = repo / checkpoint
    if not all((repo / name).is_file() for name in ("demo.py", "bpy_server.py")):
        raise BackendError("Installed SkinTokens demo.py/bpy_server.py not found")
    if not python.is_file() or not os.access(python, os.X_OK):
        raise BackendError("SkinTokens isolated Python missing or not executable")
    if not checkpoint.is_file():
        raise BackendError("SkinTokens checkpoint missing; run its official download.py --model")
    return {"repo": repo, "python": python, "checkpoint": checkpoint.resolve()}


def validate_skin(path: Path) -> dict:
    """Require glTF joints and skin attributes on an actual mesh node.

    Structural validation only. Blender additionally verifies effective vertex
    weights; this cannot establish anatomy, poses, or skinning quality.
    """
    info = validate_glb(path)
    with path.open("rb") as stream:
        stream.seek(12)
        size, _ = struct.unpack("<I4s", stream.read(8))
        doc = json.loads(stream.read(size))
    skins, nodes = doc.get("skins", []), doc["nodes"]
    bound = []
    for node in nodes:
        skin_id, mesh_id = node.get("skin"), node.get("mesh")
        if not isinstance(skin_id, int) or isinstance(skin_id, bool):
            continue
        if not isinstance(mesh_id, int) or isinstance(mesh_id, bool):
            continue
        if not 0 <= skin_id < len(skins) or not 0 <= mesh_id < len(doc["meshes"]):
            raise BackendError("SkinTokens produced an invalid mesh/skin reference")
        joints = skins[skin_id].get("joints", [])
        if not joints or any(not isinstance(j, int) or isinstance(j, bool) or
                             not 0 <= j < len(nodes) for j in joints):
            raise BackendError("SkinTokens produced an invalid/empty joint hierarchy")
        primitives = doc["meshes"][mesh_id].get("primitives", [])
        if not primitives or any(not {"JOINTS_0", "WEIGHTS_0"} <=
                                 set(p.get("attributes", {})) for p in primitives):
            raise BackendError("SkinTokens output mesh has no joint/weight attributes")
        bound.append(mesh_id)
    if not bound:
        raise BackendError("SkinTokens output has no skinned mesh; refusing mesh-only output")
    return dict(info, skinned_mesh_count=len(set(bound)), skin_count=len(skins))


def run(config: Path, source: Path, output: Path, timeout: int = 7200) -> dict:
    source, output = source.resolve(), output.resolve()
    if source == output:
        raise BackendError("Rig output must not overwrite original source mesh")
    validate_glb(source)
    runtime = runtime_config(config)
    source_sha = hashlib.sha256(source.read_bytes()).hexdigest()
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="skintokens_", dir=str(output.parent)) as tmp:
        candidate = Path(tmp) / output.name
        # --use_transfer is the upstream option preserving source textures/scale.
        command = [str(runtime["python"]), str(runtime["repo"] / "demo.py"),
                   "--input", str(source), "--output", str(candidate),
                   "--model_ckpt", str(runtime["checkpoint"]), "--use_transfer"]
        log = output.parent / "skintokens.log"
        # Stream to disk: inference progress survives Colab disconnection and
        # errors cannot be hidden by an empty/stale output from an earlier run.
        with log.open("w", encoding="utf8") as stream:
            process = subprocess.Popen(command, cwd=runtime["repo"], stdout=stream,
                                       stderr=subprocess.STDOUT)
            try:
                code = process.wait(timeout=timeout)
            except (subprocess.TimeoutExpired, KeyboardInterrupt):
                # Upstream registers its bpy server cleanup with atexit. SIGINT
                # lets Python run it, unlike subprocess.run's immediate SIGKILL.
                if os.name == "posix":
                    process.send_signal(signal.SIGINT)
                else:
                    process.terminate()
                try:
                    process.wait(timeout=30)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
                raise
        if code:
            raise BackendError(f"SkinTokens exited {code}; see {log}")
        info = validate_skin(candidate)
        if hashlib.sha256(source.read_bytes()).hexdigest() != source_sha:
            raise BackendError("Source mesh changed during SkinTokens execution")
        staged = output.with_suffix(".partial")
        shutil.copy2(candidate, staged)
        os.replace(staged, output)
    return {"backend": "skintokens", "model": str(output), "glb": info,
            "source_sha256": source_sha,
            "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
            "log": str(log), "use_transfer": True}
