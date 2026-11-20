#!/usr/bin/env python3
"""Deterministic character Colab Image-to-3D review gate (no GPU inference).

Neither a valid GLB nor generic Blender topology checks measure whether a
character's face, outfit or small accessories match reference images.
A separate human/vision evaluator must provide scored evidence, pinned to the
exact source views and generated GLB hash. Missing or stale scores never pass.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

WORKFLOW = "character-colab/2"
REVIEW_SCHEMA = "cosmimera-character-appearance-review/1"
GATE_SCHEMA = "cosmimera-character-appearance-gate/1"
THRESHOLDS = {"silhouette": 0.82, "face": 0.85, "outfit": 0.82,
              "details": 0.80, "texture": 0.76}
VIEW_FORMATS = {".png", ".jpg", ".jpeg", ".webp"}
ISSUE_TYPES = {"missing_angle", "occlusion", "geometry", "identity",
               "outfit", "details", "texture", "uncertain"}


def enabled(spec: dict, pipeline: str) -> bool:
    """Opt-in v2; old immutable character jobs remain reproducible."""
    value = spec.get("character_colab_workflow")
    if value is not None and value != WORKFLOW:
        raise ValueError("Unsupported character_colab_workflow; expected " + WORKFLOW)
    if value and (pipeline != "colab" or spec.get("input_mode", "image") != "image"
                  or str(spec.get("category") or "") not in ("character", "characters")):
        raise ValueError("character-colab/2 requires an image character Colab job")
    if value and spec.get("source_layout", "legacy") not in ("legacy", "subject_v3"):
        raise ValueError("Unsupported character source_layout")
    return value == WORKFLOW


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def subject_v3_folder(root: Path, spec: dict) -> Path:
    """Resolve the current Drive characters/<subject_id> folder, without guessing identity."""
    root = Path(root).resolve()
    subject = spec.get("subject_id")
    if (root.name != "characters" or not isinstance(subject, str) or
            not subject or not all(x.isalnum() or x in "_-" for x in subject) or ".." in subject):
        raise ValueError("subject_v3 requires a safe subject_id under the characters root")
    folder = (root / subject).resolve()
    if not folder.is_relative_to(root) or not folder.is_dir():
        raise ValueError("subject_v3 character folder not found")
    return folder


def _subject_file(folder: Path, relative: str, label: str) -> Path:
    if (not isinstance(relative, str) or not relative or
            Path(relative).is_absolute() or "\\\\" in relative):
        raise ValueError(label + " must be a safe relative path")
    file = (folder / relative).resolve()
    if not file.is_relative_to(folder) or not file.is_file():
        raise ValueError(label + " missing/unsafe file")
    return file


def validate_subject_v3(root: Path, spec: dict) -> Path:
    """Authorize a current Drive subject folder using an explicit human review.

    A file merely existing in _01_portrait never implies approval. No synthetic
    approval, inferred review path, guessed subject or fallback to another folder.
    """
    folder = subject_v3_folder(root, spec)
    source = spec.get("source_pack")
    if (not isinstance(source, str) or not source or
            not all(ch.isalnum() or ch in "-_" for ch in source) or ".." in source):
        raise ValueError("subject_v3 requires an exact source_pack ID")
    review_relative = spec.get("portrait_review")
    if not isinstance(review_relative, str) or not review_relative.startswith("_02_review_portrait/"):
        raise ValueError("subject_v3 requires an explicit _02_review_portrait/ review file")
    review = json.loads(_subject_file(folder, review_relative, "portrait_review").read_text(encoding="utf8"))
    if (not isinstance(review, dict) or review.get("status") != "ok" or
            review.get("subject_id") != spec["subject_id"] or
            source not in (review.get("source_pack"), review.get("asset_id"))):
        raise ValueError("source portrait not approved for this subject/source_pack")
    image = _subject_file(folder, spec.get("source_image"), "source_image")
    rel = image.relative_to(folder).as_posix()
    if not rel.startswith("_01_portrait/") and not (
            image.parent == folder and "_01_portrait_" in image.name):
        raise ValueError("source_image must be inside _01_portrait or the approved main portrait root")
    if image.suffix.lower() not in VIEW_FORMATS or not 0 < image.stat().st_size <= 20 * 1024 * 1024:
        raise ValueError("source_image must be a nonempty PNG/JPG/WebP within size limit")
    return image


def reference_views(root: Path, spec: dict, approved_image: Path) -> dict:
    """Allow only true image files under this approved source pack.

    The three-view turnaround may be a single sheet, but a separate 45-degree
    view is mandatory. This does not pretend those images have camera calibration
    needed by a multi-view 3D backend.
    """
    root = Path(root).resolve()
    source = spec.get("source_pack")
    if not isinstance(source, str) or not source or "/" in source or "\\" in source or source in (".", ".."):
        raise ValueError("Missing/unsafe approved source_pack")
    if spec.get("source_layout") == "subject_v3":
        folder = subject_v3_folder(root, spec)
    else:
        candidates = [root / "01_portraits" / source,
                      root / "03_completed" / "portraits" / source]
        folders = [folder.resolve() for folder in candidates if folder.is_dir()]
        if len(folders) != 1:
            raise ValueError("Expected exactly one approved portrait directory")
        folder = folders[0]
    approved_image = Path(approved_image).resolve()
    if not approved_image.is_relative_to(folder):
        raise ValueError("Approved source image lies outside source_pack")
    views = spec.get("reference_views")
    if not isinstance(views, dict) or not views:
        raise ValueError("character-colab/2 requires reference_views")
    keys = set(views)
    if not {"front", "three_quarter_45"} <= keys:
        raise ValueError("reference_views requires front and three_quarter_45")
    if not ({"side", "back"} <= keys or "turnaround" in keys):
        raise ValueError("reference_views requires side + back, or a turnaround sheet")
    if keys - {"front", "side", "back", "turnaround", "three_quarter_45"}:
        raise ValueError("Unknown reference_views key")
    found = {}
    for name, relative in sorted(views.items()):
        if not isinstance(relative, str) or not relative or Path(relative).is_absolute() or "\\" in relative:
            raise ValueError("reference_views entries must be relative image paths")
        path = (folder / relative).resolve()
        if not path.is_relative_to(folder) or not path.is_file() or path.is_symlink():
            raise ValueError("reference_views missing/unsafe path: " + name)
        if path.suffix.lower() not in VIEW_FORMATS or path.stat().st_size == 0:
            raise ValueError("reference_views requires nonempty PNG/JPG/WebP: " + name)
        if path.stat().st_size > 20 * 1024 * 1024:
            raise ValueError("reference image is too large: " + name)
        found[name] = {"path": relative.replace("\\", "/"), "sha256": sha256_file(path)}
    if (folder / views["front"]).resolve() != approved_image:
        raise ValueError("front reference must match the explicitly approved source_image")
    fingerprint = hashlib.sha256(json.dumps(found, sort_keys=True).encode()).hexdigest()
    return {"format": "turnaround_sheet" if "turnaround" in views else "separate_views",
            "views": found, "reference_sha256": fingerprint, "calibrated": False}


def _result(action: str, model_sha: str, references: dict, spec: dict,
            scores: dict | None = None, issues: list | None = None) -> dict:
    attempt = spec.get("generation_attempt", 1)
    max_attempts = spec.get("max_auto_retries", 2)
    mv_passes = spec.get("mv_adapter_passes", 0)
    for name, value, low, high in [
        ("generation_attempt", attempt, 1, 3),
        ("max_auto_retries", max_attempts, 0, 2),
        ("mv_adapter_passes", mv_passes, 0, 1),
    ]:
        if isinstance(value, bool) or not isinstance(value, int) or not low <= value <= high:
            raise ValueError(f"{name} must be an integer within {low}..{high}")
    return {"schema": GATE_SCHEMA, "status": "READY_FOR_RIG" if action == "CONTINUE_RIG" else "REVIEW_REQUIRED",
            "next_action": action, "allow_rig": action == "CONTINUE_RIG",
            "model_sha256": model_sha, "reference_sha256": references["reference_sha256"],
            "scores": scores, "issues": issues or [], "generation_attempt": attempt,
            "max_generation_attempts": max_attempts + 1, "mv_adapter_passes": mv_passes,
            "note": "Scored evaluation must come from a separate identified reviewer, not this runner."}


def assess(model: Path, report_path: Path, references: dict, spec: dict, asset_id: str) -> dict:
    """Only a revision- and file-hash-matched assessment may unblock rigging.

    No automatic MV-Adapter execution, backend switch or repeated generation is
    performed. Changes to source images, backend or model require a new asset ID
    to preserve the original GLB and traceability.
    """
    model_sha = sha256_file(Path(model))
    if not Path(report_path).is_file():
        return _result("ASSESS_FIRST_RESULT", model_sha, references, spec)
    try:
        review = json.loads(Path(report_path).read_text(encoding="utf8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError("Unreadable character appearance review") from exc
    if not isinstance(review, dict) or review.get("schema") != REVIEW_SCHEMA:
        raise ValueError("Unsupported appearance review schema")
    if review.get("asset_id") != asset_id or review.get("model_sha256") != model_sha or (
        review.get("reference_sha256") != references["reference_sha256"]
    ):
        raise ValueError("Appearance review is stale or belongs to another model/source")
    if review.get("method") not in ("human", "external_vision", "hybrid"):
        raise ValueError("Review must identify a real evaluation method")
    if not isinstance(review.get("reviewer"), str) or not review["reviewer"].strip():
        raise ValueError("Review must identify an evaluator or tool version")
    scores = review.get("scores")
    if not isinstance(scores, dict) or set(scores) != set(THRESHOLDS):
        raise ValueError("Review must score silhouette, face, outfit, details and texture")
    if any(isinstance(value, bool) or not isinstance(value, (int, float))
           or not 0 <= value <= 1 for value in scores.values()):
        raise ValueError("Appearance scores must be numeric within 0..1")
    issues = review.get("issues", [])
    if not isinstance(issues, list) or any(not isinstance(item, dict)
       or item.get("type") not in ISSUE_TYPES for item in issues):
        raise ValueError("Appearance issues must be typed objects")
    types = {item["type"] for item in issues}
    deficits = {key for key, threshold in THRESHOLDS.items() if scores[key] < threshold}
    if ("missing_angle" in types or "occlusion" in types) and spec.get("mv_adapter_passes", 0) == 0:
        action = "REQUEST_MV_ADAPTER"  # Only request the missing, useful angles.
    elif "geometry" in types:
        action = "REPAIR_GEOMETRY"
    elif deficits - {"texture"} or types & {"identity", "outfit", "details"}:
        budget = spec.get("generation_attempt", 1) < spec.get("max_auto_retries", 2) + 1
        action = "REVISE_PROMPT_OR_COMPARE_BACKEND" if budget else "HUMAN_REVIEW_MODEL"
    elif "texture" in deficits or "texture" in types:
        action = "REFINE_TEXTURE"
    elif types:
        action = "HUMAN_REVIEW_MODEL"
    else:
        action = "CONTINUE_RIG"
    return _result(action, model_sha, references, spec, scores, issues)
