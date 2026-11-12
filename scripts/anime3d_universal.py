#!/usr/bin/env python3
"""Typed Anime3D job runner for image and original text inputs.

Provides deterministic routing, resumable state, real process adapters and
Blender QA. GPU model adapters are external executables; this runner NEVER
reports a model as generated if the backend is unavailable. Paid Tripo
execution remains opt-in and delegates to the existing vetted agent.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from anime3d_profiles import classify, save_profile


def read(path):
    return json.loads(Path(path).read_text(encoding="utf8"))


def write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    tmp.replace(path)


def run_checked(args, timeout):
    return subprocess.run(args, check=False, text=True, capture_output=True, timeout=timeout)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--root", required=True)
    p.add_argument("--asset-id", required=True)
    p.add_argument("--spec", required=True)
    p.add_argument("--execute", action="store_true", help="Run actual backend (paid calls remain separate opt-in)")
    p.add_argument("--allow-paid-tripo", action="store_true", help="Authorize charges through Tripo")
    p.add_argument("--backend", choices=["auto", "tripo", "anigen", "pixal3d", "partcrafter", "blender_text", "existing"], default="auto")
    p.add_argument("--generator-executable", help="Installed local adapter executable accepting --input --spec --output")
    p.add_argument("--input-model", help="Existing real GLB to process without generating a new model")
    p.add_argument("--blender", default=shutil.which("blender"))
    a = p.parse_args()
    try:
        return run(a)
    except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired) as e:
        print("ERROR:", e, file=sys.stderr)
        return 2


def run(a):
    spec = read(a.spec)
    profile = classify(spec)
    safe = a.asset_id and all(ch.isalnum() or ch in "-_" for ch in a.asset_id)
    if not safe or ".." in a.asset_id:
        raise ValueError("Invalid asset ID")
    root = Path(a.root).resolve()
    out = root / "02_3d" / ("colab" if profile["input_mode"] == "image" else "ai_blender") / a.asset_id
    state_path = out / "typed_state.json"
    profile_path = out / "profile.json"
    backend = (profile["backend_priority"][0] if a.backend == "auto" else a.backend)
    if backend not in set(profile["backend_priority"]) | {"tripo", "existing"}:
        raise ValueError("Backend incompatible with profile: " + backend)
    if backend == "tripo" and profile["input_mode"] != "image":
        raise ValueError("Tripo adapter supports only image input")
    if a.input_model and backend != "existing":
        raise ValueError("--input-model requires --backend existing")
    if backend == "existing" and not a.input_model:
        raise ValueError("--backend existing requires --input-model")
    if a.generator_executable and backend in {"existing", "tripo"}:
        raise ValueError("Adapter command is only for standalone GPU / text backends")
    if a.allow_paid_tripo and backend != "tripo":
        raise ValueError("Paid Tripo consent is only meaningful with --backend tripo")
    if profile["input_mode"] == "image":
        # Same explicit source authorization used by older agent.
        from anime3d_agent import validate
        image = validate(root, spec, a.asset_id)
    else:
        if not (spec.get("appearance") or spec.get("prompt") or (spec.get("concept") or {}).get("appearance")):
            raise ValueError("Text-to-3D requires an explicit original design brief")
    source_sha = ""
    if profile["input_mode"] == "image":
        source_sha = hashlib.sha256(image.read_bytes()).hexdigest()
    elif a.input_model:
        model_source = Path(a.input_model)
        if model_source.is_file():
            source_sha = hashlib.sha256(model_source.read_bytes()).hexdigest()
    fingerprint = hashlib.sha256((json.dumps(spec, sort_keys=True, ensure_ascii=False)
                                  + backend + (a.input_model or "") + source_sha).encode("utf8")).hexdigest()
    if state_path.is_file():
        state = read(state_path)
        if state.get("fingerprint") != fingerprint:
            raise ValueError("Input or backend changed: use a new asset ID")
    else:
        state = {"asset_id": a.asset_id, "fingerprint": fingerprint, "backend": backend,
                 "status": "QUEUED", "steps": {}, "warnings": profile["warnings"]}
    write(profile_path, profile)
    model = out / "models" / (a.asset_id + ".glb")
    write(state_path, state)
    if not a.execute:
        print(json.dumps({"mode": "plan", "backend": backend, "profile": profile,
                          "output": str(out), "requires_generator": backend not in {"existing", "tripo"},
                          "paid_tripo_authorized": False}, ensure_ascii=False, indent=2))
        return 0
    state["status"] = "RUNNING"
    write(state_path, state)
    if backend == "existing":
        source = Path(a.input_model).resolve()
        if not source.is_file() or source.suffix.lower() != ".glb" or source.stat().st_size == 0:
            raise ValueError("Input model must be a nonempty real .glb")
        model.parent.mkdir(parents=True, exist_ok=True)
        if source != model.resolve():
            shutil.copy2(source, model)
    elif backend == "tripo":
        # Tripo's current agent only supports its preset retarget path and
        # refuses advanced rigs. Do not silently downgrade anatomy to biped.
        unsupported = profile["unsupported"]
        if profile["anatomy"] not in {"biped", "quadruped", "hexapod", "octopod", "serpentine", "aquatic"} or unsupported:
            state["status"] = "REVIEW_REQUIRED"
            state["warnings"].append("Tripo-only agent cannot safely execute this advanced anatomy/motion; choose a typed adapter")
            write(state_path, state)
            return 2
        if not a.allow_paid_tripo:
            state["status"] = "REVIEW_REQUIRED"
            state["warnings"].append("Explicit --allow-paid-tripo needed for paid API")
            write(state_path, state)
            return 2
        # The API runner accepts only published Tripo presets; supplementary
        # procedural clips are authored afterwards by Blender.
        api_spec_path = out / "agent_backend_spec.json"
        api_spec = dict(spec)
        api_spec["requested_clips"] = profile["tripo_clips"]
        write(api_spec_path, api_spec)
        child = run_checked([sys.executable, str(Path(__file__).with_name("anime3d_agent.py")),
                             "--root", str(root), "--asset-id", a.asset_id,
                             "--spec", str(api_spec_path), "--execute"] +
                            (["--blender", a.blender] if a.blender else []), 7200)
        state["steps"]["tripo"] = {"returncode": child.returncode, "stderr": child.stderr[-4000:]}
        write(state_path, state)
        if child.returncode != 0 or not model.exists():
            state["status"] = "REVIEW_REQUIRED"
            write(state_path, state)
            return 2
    else:
        # Model-specific runtimes have incompatible Torch/CUDA requirements.
        # External adapters isolate them; no subprocess shell or guessed APIs.
        if not a.generator_executable:
            state["status"] = "REVIEW_REQUIRED"
            state["warnings"].append(f"{backend} adapter missing; install and pass --generator-executable")
            write(state_path, state)
            return 2
        exe = Path(a.generator_executable).resolve()
        if not exe.is_file() or not os.access(exe, os.X_OK):
            raise ValueError("Generator adapter is missing or not executable")
        model.parent.mkdir(parents=True, exist_ok=True)
        source = str((root / "01_portraits" / spec.get("source_pack", "")).resolve()) if profile["input_mode"] == "image" else str(a.spec)
        child = run_checked([str(exe), "--input", source, "--spec", str(a.spec),
                             "--output", str(model)], 7200)
        state["steps"]["generation"] = {"returncode": child.returncode, "stderr": child.stderr[-4000:]}
        write(state_path, state)
        if child.returncode != 0 or not model.is_file() or model.stat().st_size < 100:
            state["status"] = "REVIEW_REQUIRED"
            state["warnings"].append("Backend did not produce a verified nonempty GLB")
            write(state_path, state)
            return 2
    if not a.blender or not Path(a.blender).is_file():
        state["status"] = "QA_PENDING"
        state["warnings"].append("Blender binary unavailable; geometry and export QA not run")
        write(state_path, state)
        return 2
    child = run_checked([a.blender, "-b", "--factory-startup",
                         "--python", str(Path(__file__).with_name("anime3d_typed_blender.py")),
                         "--", str(model), str(out), str(profile_path), str(a.spec)], 3600)
    state["steps"]["blender"] = {"returncode": child.returncode, "stderr": child.stderr[-4000:]}
    metrics = out / "qa" / "typed_metrics.json"
    state["status"] = "REVIEW_REQUIRED" if child.returncode == 0 and metrics.is_file() else "QA_PENDING"
    if metrics.is_file():
        qa = read(metrics)
        state["automated_pass"] = qa.get("automated_pass", False)
        state["warnings"] += qa.get("warnings", [])
    write(state_path, state)
    return 0 if child.returncode == 0 and metrics.is_file() else 2


if __name__ == "__main__":
    sys.exit(main())
