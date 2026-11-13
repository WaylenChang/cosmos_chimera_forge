#!/usr/bin/env python3
"""Read-only readiness checks; never creates approvals or calls paid APIs."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
from anime3d_agent import validate, digest
from anime3d_profiles import classify
from anime3d_backend_adapter import runtime_config
from anime3d_universal import execution_profile
from anime3d_rig_adapter import runtime_config as rig_runtime_config


def inspect(root, spec, asset_id, backend="pixal3d", config=None, blender=None, generator_executable=None,
            rig_backend="none"):
    root = Path(root).resolve()
    checks, blockers = {}, []
    try:
        profile = execution_profile(classify(spec), backend)
        checks["profile"] = profile
    except ValueError as exc:
        blockers.append(str(exc))
    try:
        image = validate(root, spec, asset_id)
        from PIL import Image
        with Image.open(image) as source:
            source.verify()
        with Image.open(image) as source:
            checks["source"] = {"path": str(image.relative_to(root)), "sha256": digest(image),
                                "size": list(source.size), "format": source.format}
    except (ValueError, OSError, ImportError) as exc:
        blockers.append("source: " + str(exc))
    blender = blender or shutil.which("blender")
    checks["blender"] = str(blender) if blender and Path(blender).is_file() else None
    if not checks["blender"]:
        blockers.append("Blender binary unavailable")
    if rig_backend == "skintokens":
        try:
            if not config:
                raise ValueError("SkinTokens isolated config required")
            runtime = rig_runtime_config(Path(config))
            checks["rig_runtime"] = {key: str(value) for key, value in runtime.items()}
        except (ValueError, OSError, RuntimeError) as exc:
            blockers.append("rig: " + str(exc))
    if backend == "tripo":
        checks["api_key_present"] = bool(os.environ.get("TRIPO_API_KEY"))
        if not checks["api_key_present"]:
            blockers.append("TRIPO_API_KEY unavailable; no API calls made")
        checks["paid_execution_authorized"] = False
    else:
        try:
            if generator_executable:
                exe = Path(generator_executable)
                if not exe.is_file() or not os.access(exe, os.X_OK):
                    raise ValueError("Generator adapter missing or not executable")
                checks["runtime"] = {"generator_executable": str(exe)}
            else:
                if not config:
                    raise ValueError("Isolated backend config required")
                runtime = runtime_config(backend, Path(config))
                checks["runtime"] = {key: str(runtime[key]) for key in ("repo", "python", "script")}
        except (ValueError, OSError, RuntimeError) as exc:
            blockers.append("backend: " + str(exc))
        gpu = shutil.which("nvidia-smi")
        if gpu:
            result = subprocess.run([gpu, "--query-gpu=name,memory.total", "--format=csv,noheader"],
                                    text=True, capture_output=True, timeout=20)
            checks["gpu"] = result.stdout.strip() if result.returncode == 0 else None
        else:
            checks["gpu"] = None
        if not checks["gpu"]:
            blockers.append("NVIDIA GPU runtime not available")
    return {"asset_id": asset_id, "subject_id": spec.get("subject_id"), "backend": backend,
            "status": "READY_FOR_EXECUTION" if not blockers else "BLOCKED",
            "checks": checks, "blockers": blockers,
            "inference_executed": False, "colab_verified": False, "passed": False}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--root", required=True)
    p.add_argument("--spec", required=True)
    p.add_argument("--asset-id", required=True)
    p.add_argument("--backend", choices=["pixal3d", "anigen", "partcrafter", "tripo"], default="pixal3d")
    p.add_argument("--backend-config")
    p.add_argument("--blender")
    p.add_argument("--generator-executable")
    p.add_argument("--rig-backend", choices=["none", "skintokens"], default="none")
    p.add_argument("--report")
    args = p.parse_args()
    spec = json.loads(Path(args.spec).read_text(encoding="utf8"))
    result = inspect(args.root, spec, args.asset_id, args.backend, args.backend_config, args.blender,
                     args.generator_executable, args.rig_backend)
    text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.report:
        target = Path(args.report)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf8")
    print(text)
    return 0 if result["status"] == "READY_FOR_EXECUTION" else 2


if __name__ == "__main__":
    raise SystemExit(main())
