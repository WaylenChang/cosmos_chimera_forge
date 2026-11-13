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
from anime3d_profiles import classify, PROCEDURAL
from anime3d_backend_adapter import run as run_official_backend, validate_glb, BackendError
from anime3d_rig_adapter import run as run_skintokens, validate_skin


def read(path):
    return json.loads(Path(path).read_text(encoding="utf8"))


def write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    tmp.replace(path)


def encyclopedia_path(root, spec, profile):
    subject = spec.get("subject_id") or ""
    if not subject or any(x in subject for x in ("/", "\\", "..")):
        return ""
    creature = str(spec.get("category") or spec.get("subject_type") or "") == "creature" or str(spec.get("task_type") or "").startswith("creature") or profile["asset_class"] != "humanoid"
    stage = spec.get("stage") or "adult"
    if any(x in str(stage) for x in ("/", "\\", "..")):
        raise ValueError("Unsafe creature stage")
    paths = ([f"wiki/creatures/{subject}_{stage}_wiki.md",
              f"04_encyclopedia/creatures/{subject}_wiki.md"] if creature else
             [f"wiki/characters/{subject}_wiki.md"])
    return next((p for p in paths if (root / p).is_file() and (root / p).read_text(encoding="utf8").strip()), "")



def write_asset_manifest(out, asset_id, spec, profile, state):
    """Index an actual typed job for the existing Drive review UI.

    A manifest records only files that exist. It never marks a generated
    asset complete or replaces the separate human-approved review record.
    """
    source_pack = spec.get("source_pack") or ""
    category = str(spec.get("category") or spec.get("subject_type") or "")
    kind = spec.get("task_type") or (
        "character-model-rig" if category == "character" or profile["asset_class"] == "humanoid"
        else "creature-model-rig"
    )
    files = []
    for folder in ("models", "source", "rig", "animations", "previews", "qa", "parts"):
        base = out / folder
        if not base.is_dir():
            continue
        for file in sorted(base.rglob("*")):
            if file.is_file() and not file.is_symlink():
                rel = file.relative_to(out).as_posix()
                level = "L1" if rel in {f"models/{asset_id}.glb", f"models/{asset_id}.blend"} else "L2"
                files.append({"path": rel, "kind": "model" if file.suffix.lower() in {".glb", ".blend"} else "report", "level": level})
    for name in ("profile.json", "typed_state.json", "agent_backend_spec.json", "material_profile.json", "bestiary.md"):
        if (out / name).is_file():
            files.append({"path": name, "kind": "spec", "level": "L2"})
    missing = []
    for ext in ("glb", "blend"):
        if not (out / "models" / f"{asset_id}.{ext}").is_file():
            missing.append({"item": f"models/{asset_id}.{ext}", "level": "L1", "reason": "Not produced or QA failed"})
    if not source_pack:
        missing.append({"item": "approved source portrait", "level": "L1",
                        "reason": "Prompt-to-3D requires a post-model approved portrait; bind source_pack before completion"})
    subject_id = spec.get("subject_id") or ""
    result_wiki = encyclopedia_path(out.parents[2], spec, profile)
    if profile["input_mode"] == "text" and (
        category == "creature" or str(kind).startswith("creature")
    ) and not (out / "bestiary.md").is_file() and not result_wiki:
        missing.append({"item": "bestiary.md", "level": "L1",
                        "reason": "Original bestiary required for text-to-3D creatures"})
    result = {
        "spec": "cosmimera-art-task/1",
        "task_header": spec.get("task_header", ""),
        "task_id": asset_id,
        "task_type": kind,
        "subject_id": spec.get("subject_id") or asset_id,
        "stage": spec.get("stage"),
        "source_pack": source_pack,
        "produced_by": "Anime3D typed runner",
        "input_mode": profile["input_mode"],
        "anatomy": profile["anatomy"],
        "pipeline": state.get("pipeline"),
        "qa_status": state["status"],
        "encyclopedia_path": result_wiki,
        "files": files,
        "missing": missing,
        "notes": "Typed execution output; automatic QA is not final artistic approval."
    }
    write(out / "manifest.json", result)
    return result


def run_checked(args, timeout):
    try:
        return subprocess.run(args, check=False, text=True, capture_output=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired) as exc:
        # Callers persist this process result, rather than leaving RUNNING
        # forever when Blender/a custom adapter cannot start or times out.
        return subprocess.CompletedProcess(args, 124 if isinstance(exc, subprocess.TimeoutExpired) else 127,
                                           stdout="", stderr=str(exc))


def execution_profile(profile, backend):
    """Vendor presets exist only on the vendor path; never promise them locally."""
    profile = json.loads(json.dumps(profile))
    if backend != "tripo":
        for item in profile["motion_plan"]:
            if item["method"] == "tripo_preset":
                item["method"] = "blender_procedural" if item["clip"] in PROCEDURAL[profile["anatomy"]] else "review_required"
                item["preset"] = None
        profile["tripo_clips"] = []
        profile["procedural_clips"] = [x["clip"] for x in profile["motion_plan"] if x["method"] == "blender_procedural"]
        profile["unsupported"] = [x["clip"] for x in profile["motion_plan"] if x["method"] == "review_required"]
    return profile


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--root", required=True)
    p.add_argument("--asset-id", required=True)
    p.add_argument("--spec", required=True)
    p.add_argument("--execute", action="store_true", help="Run actual backend (paid calls remain separate opt-in)")
    p.add_argument("--allow-paid-tripo", action="store_true", help="Authorize charges through Tripo")
    p.add_argument("--backend", choices=["auto", "tripo", "anigen", "pixal3d", "partcrafter", "blender_text", "existing"], default="auto")
    p.add_argument("--pipeline", choices=["auto", "colab", "ai_blender"], default="auto",
                   help="Drive model route; image supports Colab or AI+Blender, text always uses AI+Blender")
    p.add_argument("--generator-executable", help="Custom executable accepting --input --spec --output")
    p.add_argument("--rig-backend", choices=["none", "skintokens"], default="none",
                   help="Optional real mesh-to-skin stage in an isolated runtime")
    p.add_argument("--backend-config", help="JSON paths to installed official AniGen/Pixal3D/PartCrafter environments")
    p.add_argument("--input-model", help="Existing real GLB to process without generating a new model")
    p.add_argument("--blender", default=shutil.which("blender"))
    p.add_argument("--stage", choices=["all", "pre_gpu", "gpu", "post_gpu"], default="all",
                   help="Pipeline stage slice (strictly ordered N00-N01 -> N02-N04 -> N05-N08)")
    a = p.parse_args()
    try:
        return run(a)
    except (OSError, ValueError, RuntimeError, BackendError, subprocess.TimeoutExpired) as e:
        print("ERROR:", e, file=sys.stderr)
        return 2


def run(a):
    spec = read(a.spec)
    profile = classify(spec)
    rig_backend = getattr(a, "rig_backend", "none")
    safe = a.asset_id and all(ch.isalnum() or ch in "-_" for ch in a.asset_id)
    if not safe or ".." in a.asset_id:
        raise ValueError("Invalid asset ID")
    root = Path(a.root).resolve()
    pipeline = getattr(a, "pipeline", "auto") or "auto"
    if pipeline not in {"auto", "colab", "ai_blender"}:
        raise ValueError("Unsupported pipeline route")
    if pipeline == "auto":
        pipeline = "colab" if profile["input_mode"] == "image" else "ai_blender"
    if pipeline == "colab" and profile["input_mode"] != "image":
        raise ValueError("Prompt-to-3D is an AI+Blender route, not an image Colab job")
    out = root / "02_3d" / pipeline / a.asset_id
    state_path = out / "typed_state.json"
    profile_path = out / "profile.json"
    backend = a.backend
    if backend == "auto":
        # Choose a configured local runtime instead of silently choosing an
        # uninstalled expensive model. Tripo remains explicit-cost opt-in.
        backend = profile["backend_priority"][0]
        cfg = read(a.backend_config) if getattr(a, "backend_config", None) else {}
        if profile["input_mode"] == "image":
            installed = [x for x in profile["backend_priority"]
                         if x in {"anigen", "pixal3d", "partcrafter"}
                         and isinstance(cfg.get(x), dict) and
                         Path(str(cfg[x].get("repo", ""))).is_dir() and
                         Path(str(cfg[x].get("python", ""))).is_file()]
            if installed:
                backend = installed[0]
            elif a.allow_paid_tripo:
                backend = "tripo"
        # Text jobs require the explicitly provided original-generation adapter.
    if backend not in set(profile["backend_priority"]) | {"tripo", "existing"}:
        raise ValueError("Backend incompatible with profile: " + backend)
    if backend == "tripo" and profile["input_mode"] != "image":
        raise ValueError("Tripo adapter supports only image input")
    if backend == "tripo" and pipeline != "colab":
        raise ValueError("Tripo adapter writes its original output under 02_3d/colab; use the Colab route")
    if a.input_model and backend != "existing":
        raise ValueError("--input-model requires --backend existing")
    if backend == "existing" and not a.input_model:
        raise ValueError("--backend existing requires --input-model")
    if a.generator_executable and backend in {"existing", "tripo"}:
        raise ValueError("Adapter command is only for standalone GPU / text backends")
    if a.allow_paid_tripo and backend != "tripo":
        raise ValueError("Paid Tripo consent is only meaningful with --backend tripo")
    if rig_backend != "none" and (backend == "tripo" or profile["surface_mode"] == "rigid"):
        raise ValueError("SkinTokens is for a standalone organic mesh, not Tripo/rigid machinery")
    if rig_backend == "skintokens" and not getattr(a, "backend_config", None):
        raise ValueError("SkinTokens requires --backend-config for its isolated runtime")
    profile = execution_profile(profile, backend)
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
    if a.input_model:
        model_source = Path(a.input_model)
        if model_source.is_file():
            source_sha += hashlib.sha256(model_source.read_bytes()).hexdigest()
    config_sha = hashlib.sha256(Path(a.backend_config).read_bytes()).hexdigest() if getattr(a, "backend_config", None) else ""
    fingerprint = hashlib.sha256((json.dumps(spec, sort_keys=True, ensure_ascii=False)
                                  + backend + pipeline + (a.input_model or "") + source_sha + config_sha +
                                  str(a.generator_executable or "") +
                                  (rig_backend if rig_backend != "none" else "")).encode("utf8")).hexdigest()
    if state_path.is_file():
        state = read(state_path)
        if state.get("fingerprint") != fingerprint:
            raise ValueError("Input or backend changed: use a new asset ID")
    else:
        state = {"asset_id": a.asset_id, "fingerprint": fingerprint, "backend": backend,
                 "pipeline": pipeline, "status": "QUEUED", "steps": {}, "warnings": profile["warnings"]}
    write(profile_path, profile)
    model = out / "source" / (a.asset_id + ".glb")
    write(state_path, state)
    # Reuse only a successful source whose bytes still match this job's record.
    recorded = state["steps"].get("source_glb", {})
    resume_source = bool(model.is_file() and recorded.get("sha256") and
                         hashlib.sha256(model.read_bytes()).hexdigest() == recorded["sha256"])
    if model.is_file() and recorded.get("sha256") and not resume_source:
        raise ValueError("Cached source changed: preserve the original and use a new asset ID")
    stage = getattr(a, "stage", "all") or "all"
    if stage == "pre_gpu":
        if state.get("stage_completed") not in {"gpu", "post_gpu"}:
            state["stage_completed"] = "pre_gpu"
        write(state_path, state)
        print(json.dumps({"mode": "pre_gpu", "asset_id": a.asset_id, "backend": backend,
                          "pipeline": pipeline, "stage_completed": state["stage_completed"],
                          "output": str(out)}, ensure_ascii=False, indent=2))
        return 0
    if not a.execute:
        print(json.dumps({"mode": "plan", "backend": backend, "pipeline": pipeline, "profile": profile,
                          "output": str(out), "requires_generator": backend not in {"existing", "tripo"} and not getattr(a, "backend_config", None),
                          "paid_tripo_authorized": False}, ensure_ascii=False, indent=2))
        return 0
    if stage == "post_gpu":
        if not resume_source and backend != "existing":
            raise ValueError("Stage post_gpu requires completed N02 source GLB from gpu stage")
        if rig_backend == "skintokens":
            rigged = out / "rig" / model.name
            prior_rig = state["steps"].get("rigging", {})
            if prior_rig.get("status") != "generated" or not prior_rig.get("sha256"):
                raise ValueError("Stage post_gpu requires completed N04 rigging from gpu stage")
            if not rigged.is_file() or hashlib.sha256(rigged.read_bytes()).hexdigest() != prior_rig["sha256"]:
                raise BackendError("Cached rig changed or disappeared; preserve this job and use a new asset ID")
    state["status"] = "RUNNING"
    write(state_path, state)
    if resume_source:
        validate_glb(model)
    elif backend == "existing":
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
        generated = out / "models" / (a.asset_id + ".glb")
        if child.returncode != 0 or not generated.exists():
            state["status"] = "REVIEW_REQUIRED"
            write(state_path, state)
            return 2
        model.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(generated, model)
    else:
        # Model-specific runtimes have incompatible Torch/CUDA requirements.
        # External adapters isolate them; no subprocess shell or guessed APIs.
        model.parent.mkdir(parents=True, exist_ok=True)
        if backend in {"anigen", "pixal3d", "partcrafter"} and getattr(a, "backend_config", None) and not a.generator_executable:
            try:
                result = run_official_backend(backend, Path(a.backend_config), image, Path(a.spec), model)
                state["steps"]["generation"] = {"status": "generated", "result": result}
            except (BackendError, OSError, subprocess.TimeoutExpired) as exc:
                state["status"] = "REVIEW_REQUIRED"
                state["steps"]["generation"] = {"status": "failed", "error": str(exc)[-2000:]}
                write(state_path, state)
                return 2
        else:
            if not a.generator_executable:
                state["status"] = "REVIEW_REQUIRED"
                state["warnings"].append(f"{backend} runtime missing; configure --backend-config or --generator-executable")
                write(state_path, state)
                return 2
            exe = Path(a.generator_executable).resolve()
            if not exe.is_file() or not os.access(exe, os.X_OK):
                state["status"] = "REVIEW_REQUIRED"
                state["warnings"].append("Generator adapter is missing or not executable")
                write(state_path, state)
                return 2
            source = str(image) if profile["input_mode"] == "image" else str(a.spec)
            # Never accept stale results after a child fails or produces nothing.
            model.unlink(missing_ok=True)
            child = run_checked([str(exe), "--input", source, "--spec", str(a.spec),
                                 "--output", str(model)], 7200)
            state["steps"]["generation"] = {"returncode": child.returncode, "stderr": child.stderr[-4000:]}
            if child.returncode != 0:
                state["status"] = "REVIEW_REQUIRED"
                write(state_path, state)
                return 2
        try:
            state["steps"]["generated_glb"] = validate_glb(model)
        except BackendError as exc:
            state["status"] = "REVIEW_REQUIRED"
            state["warnings"].append(f"Invalid GLB from generator: {exc}")
            write(state_path, state)
            return 2
        write(state_path, state)
    try:
        state["steps"]["source_glb"] = validate_glb(model)
        state["steps"]["source_glb"]["sha256"] = hashlib.sha256(model.read_bytes()).hexdigest()
        write(state_path, state)
    except BackendError as exc:
        state["status"] = "REVIEW_REQUIRED"
        state["warnings"].append(f"Source GLB invalid: {exc}")
        write(state_path, state)
        write_asset_manifest(out, a.asset_id, spec, profile, state)
        return 2
    if rig_backend == "skintokens":
        rigged = out / "rig" / model.name
        prior = state["steps"].get("rigging", {})
        try:
            if prior.get("status") == "generated" and prior.get("sha256"):
                if not rigged.is_file() or hashlib.sha256(rigged.read_bytes()).hexdigest() != prior["sha256"]:
                    raise BackendError("Cached rig changed or disappeared; preserve this job and use a new asset ID")
                validate_skin(rigged)
            else:
                result = run_skintokens(Path(a.backend_config), model, rigged)
                state["steps"]["rigging"] = dict(result, status="generated")
            model = rigged
            write(state_path, state)
        except (BackendError, OSError, subprocess.TimeoutExpired) as exc:
            state["status"] = "QA_PENDING"
            # Do not discard a successful rig receipt after a cache mismatch.
            if prior.get("status") != "generated":
                state["steps"]["rigging"] = {"status": "failed", "error": str(exc)[-2000:]}
            state["warnings"].append("SkinTokens: " + str(exc)[-2000:])
            write(state_path, state)
            write_asset_manifest(out, a.asset_id, spec, profile, state)
            return 2
    if stage == "gpu":
        state["stage_completed"] = "gpu"
        state["status"] = "GPU_COMPLETED"
        write(state_path, state)
        write_asset_manifest(out, a.asset_id, spec, profile, state)
        return 0
    # Text-only creature modeling owns the original bestiary; image-to-3D
    # and characters must not inherit an unrelated previous bestiary.
    subject_kind = str(spec.get("category") or spec.get("subject_type") or "")
    task_kind = str(spec.get("task_type") or "")
    requires_bestiary = profile["input_mode"] == "text" and (
        subject_kind == "creature" or task_kind.startswith("creature"))
    bestiary = out / "bestiary.md"
    wiki_exists = bool(encyclopedia_path(root, spec, profile))
    if requires_bestiary and not wiki_exists and (not bestiary.is_file() or not bestiary.read_text(encoding="utf8").strip()):
        state["warnings"].append("Text-to-3D creature requires wiki/creatures/<subject_id>_<stage>_wiki.md or legacy bestiary.md")
    if not a.blender or not Path(a.blender).is_file():
        state["status"] = "QA_PENDING"
        state["warnings"].append("Blender binary unavailable; geometry and export QA not run")
        write(state_path, state)
        write_asset_manifest(out, a.asset_id, spec, profile, state)
        return 2
    write(out / "material_profile.json", {
        "name": spec.get("toon_profile", "anime_cel_2band"), "shadow_bands": 2,
        "palette_hex": spec.get("palette_hex", []), "target_engine": spec.get("target_engine", "unity"),
        "shader_applied": False, "note": "Material metadata only; apply and review Toon shader in the target engine"
    })
    # Remove only this attempt's QA receipt: an old report cannot validate a
    # later Blender process that failed before writing its own report.
    (out / "qa" / "typed_metrics.json").unlink(missing_ok=True)
    state["automated_pass"] = False
    write(state_path, state)
    child = run_checked([a.blender, "-b", "--factory-startup", "--python-exit-code", "3",
                         "--python", str(Path(__file__).with_name("anime3d_typed_blender.py")),
                         "--", str(model), str(out), str(profile_path), str(a.spec)], 3600)
    state["steps"]["blender"] = {"returncode": child.returncode, "stderr": child.stderr[-4000:], "stdout_tail": child.stdout[-4000:]}
    metrics = out / "qa" / "typed_metrics.json"
    state["status"] = "QA_PENDING"
    if metrics.is_file():
        qa = read(metrics)
        state["automated_pass"] = qa.get("automated_pass", False)
        if child.returncode == 0 and state["automated_pass"]:
            state["status"] = "REVIEW_REQUIRED"
            state["stage_completed"] = "post_gpu"
        state["warnings"] += qa.get("warnings", [])
    if requires_bestiary and not wiki_exists and (not bestiary.is_file() or not bestiary.read_text(encoding="utf8").strip()):
        state["status"] = "REVIEW_REQUIRED"
        write(state_path, state)
        write_asset_manifest(out, a.asset_id, spec, profile, state)
        return 2
    write(state_path, state)
    write_asset_manifest(out, a.asset_id, spec, profile, state)
    return 0 if child.returncode == 0 and state.get("automated_pass") else 2


if __name__ == "__main__":
    sys.exit(main())
