"""Typed anatomy routing shared by the Colab agent and Blender processing.

A visual theme (e.g. "fantasy" or "east Asian") is not an anatomical rig.
Explicit geometry/anatomy metadata always wins over catalog ancestry. Unknown or
ambiguous topology is sent to review instead of being silently treated as biped.
"""
from __future__ import annotations
import json
from typing import Any

ASSET_CLASSES = {"humanoid", "monster", "animal", "fantasy_creature", "mechanical", "robot"}
BIPED_PRESETS = frozenset({"idle", "walk", "run", "dive", "climb", "jump", "slash", "shoot", "hurt", "fall", "turn"})
API_PRESETS = {
    "biped": {clip: clip for clip in BIPED_PRESETS},
    "quadruped": {"walk": "quadruped:walk"},
    "hexapod": {"walk": "hexapod:walk"},
    "octopod": {"walk": "octopod:walk"},
    "serpentine": {"march": "serpentine:march"},
    "aquatic": {"march": "aquatic:march"},
}
# These clips have Blender procedural templates. The existence of a template
# does NOT imply good skinning / anatomical fidelity without landmark review.
PROCEDURAL = {
    "biped": {"idle", "walk", "run", "attack", "hurt"},
    "quadruped": {"idle", "walk", "run", "attack"},
    "hexapod": {"idle", "walk", "run", "attack"},
    "octopod": {"idle", "walk", "attack"},
    "serpentine": {"idle", "march", "swim", "attack"},
    "aquatic": {"idle", "march", "swim", "attack"},
    "avian": {"idle", "walk", "fly", "glide", "land", "attack"},
    "winged_quadruped": {"idle", "walk", "run", "fly", "glide", "land", "attack"},
    "winged_biped": {"idle", "walk", "fly", "glide", "land", "attack"},
    "tentacled": {"idle", "swim", "attack"},
    "plant": {"idle", "attack"},
    "amorphous": {"idle", "pulse", "attack"},
    "object": {"idle", "spin", "attack"},
    "mechanism": {"idle", "rotate", "open", "close", "extend", "retract"},
    "humanoid_mecha": {"idle", "walk", "run", "attack", "rotate"},
    "quadruped_mecha": {"idle", "walk", "run", "attack"},
    "multi_leg_mecha": {"idle", "walk", "attack"},
    "hybrid": {"idle"},
}
TOPOLOGIES = set(PROCEDURAL)
# Parent categories are catalog visual origins, not guaranteed joint counts.
PARENT_TO_TOPOLOGY = {
    "生物·哺乳類": ("animal", "quadruped", "organic"),
    "生物·鳥類": ("animal", "avian", "organic"),
    "生物·爬蟲類": ("animal", "quadruped", "organic"),
    "生物·兩棲類": ("animal", "quadruped", "organic"),
    "生物·魚類": ("animal", "aquatic", "organic"),
    "生物·昆蟲": ("animal", "hexapod", "organic"),
    "生物·甲殼類": ("animal", "octopod", "organic"),
    "生物·軟體動物": ("animal", "tentacled", "organic"),
    "古生物·獸腳恐龍": ("animal", "biped", "organic"),
    "古生物·植食恐龍": ("animal", "quadruped", "organic"),
    "古生物·翼龍/飛行爬蟲": ("animal", "avian", "organic"),
    "古生物·古海洋爬蟲/巨魚": ("animal", "aquatic", "organic"),
    "古生物·早古節肢/無脊椎": ("animal", "hexapod", "organic"),
    "古生物·新生代史前哺乳": ("animal", "quadruped", "organic"),
}
PARENT_PREFIXES = (
    ("植物·", ("fantasy_creature", "plant", "organic")),
    ("自然·", ("fantasy_creature", "amorphous", "nonrigid")),
    ("物質·", ("fantasy_creature", "object", "rigid")),
    ("造物·", ("mechanical", "mechanism", "rigid")),
    ("裝備·", ("mechanical", "mechanism", "rigid")),
    ("器械·", ("mechanical", "mechanism", "rigid")),
    ("載具·", ("mechanical", "mechanism", "rigid")),
    ("科幻機械·機甲/外骨骼", ("robot", "humanoid_mecha", "rigid")),
    ("科幻機械·仿生機獸", ("robot", "quadruped_mecha", "rigid")),
    ("科幻機械·", ("mechanical", "mechanism", "rigid")),
    ("類人奇幻·", ("monster", "biped", "organic")),
    ("幻想生物·", ("fantasy_creature", "hybrid", "organic")),
)
ALIASES = {
    "humanoid": "biped", "two_leg": "biped", "two_legs": "biped",
    "quadruped_with_wings": "winged_quadruped",
    "quad_wings": "winged_quadruped", "dragon": "winged_quadruped",
    "avian": "avian", "bird": "avian", "flying": "avian",
    "snake": "serpentine", "snake_like": "serpentine", "eel": "serpentine",
    "fish": "aquatic", "swimmer": "aquatic",
    "arthropod": "hexapod", "insect": "hexapod",
    "octopus": "tentacled", "cephalopod": "tentacled",
    "rigid_parts": "mechanism", "mechanical": "mechanism",
    "humanoid_robot": "humanoid_mecha",
    "quadruped_robot": "quadruped_mecha",
    "multi_leg_robot": "multi_leg_mecha",
    "transforming_mecha": "humanoid_mecha",
    "spectral": "amorphous", "orbital": "object", "unknown": "hybrid",
}
RIG_STRATEGIES = {
    "biped": "skinned_biped",
    "quadruped": "skinned_quadruped",
    "hexapod": "skinned_articulated",
    "octopod": "skinned_articulated",
    "serpentine": "spline_chain",
    "aquatic": "spine_fins",
    "avian": "wing_chains",
    "winged_quadruped": "wing_chains",
    "winged_biped": "wing_chains",
    "tentacled": "tentacle_chains",
    "plant": "flexible_stems",
    "amorphous": "shape_or_shader",
    "object": "object_transform",
    "mechanism": "rigid_part_hierarchy",
    "humanoid_mecha": "rigid_part_hierarchy",
    "quadruped_mecha": "rigid_part_hierarchy",
    "multi_leg_mecha": "rigid_part_hierarchy",
    "hybrid": "anatomy_landmarks",
}
DEFAULT_CLIPS = {
    "biped": ["idle", "walk", "run"],
    "quadruped": ["idle", "walk"],
    "hexapod": ["idle", "walk"],
    "octopod": ["idle", "walk"],
    "serpentine": ["idle", "march"],
    "aquatic": ["idle", "swim"],
    "avian": ["idle", "fly", "land"],
    "winged_quadruped": ["idle", "walk", "fly", "land"],
    "winged_biped": ["idle", "walk", "fly", "land"],
    "tentacled": ["idle", "swim"],
    "plant": ["idle"],
    "amorphous": ["idle", "pulse"],
    "object": ["idle", "spin"],
    "mechanism": ["idle"],
    "humanoid_mecha": ["idle", "walk"],
    "quadruped_mecha": ["idle", "walk"],
    "multi_leg_mecha": ["idle", "walk"],
    "hybrid": ["idle"],
}
QA_BY_TOPOLOGY = {
    "biped": ["feet_contact", "shoulder_knee", "face_visibility"],
    "quadruped": ["four_foot_contact", "spine_gait", "tail_clearance"],
    "hexapod": ["leg_count", "tripod_gait", "foot_contact"],
    "octopod": ["leg_count", "wave_gait", "foot_contact"],
    "serpentine": ["spine_continuity", "curve_self_intersection"],
    "aquatic": ["spine_wave", "fin_clearance"],
    "avian": ["wing_chain", "wing_pose_sweep", "wing_body_clearance"],
    "winged_quadruped": ["four_foot_contact", "wing_chain", "wing_pose_sweep"],
    "winged_biped": ["feet_contact", "wing_chain", "wing_pose_sweep"],
    "tentacled": ["appendage_count", "tentacle_self_intersection"],
    "plant": ["stem_continuity", "flexion_sweep"],
    "amorphous": ["silhouette_consistency", "material_response"],
    "object": ["object_hierarchy", "pivot_stability"],
    "mechanism": ["part_separation", "joint_limits", "collision_sweep"],
    "humanoid_mecha": ["rigid_armor", "joint_limits", "armor_intersection"],
    "quadruped_mecha": ["rigid_armor", "four_foot_contact", "joint_limits"],
    "multi_leg_mecha": ["rigid_armor", "foot_contact", "joint_limits"],
    "hybrid": ["landmark_completeness", "deformation_sweep"],
}


def _parents(spec: dict[str, Any]) -> list[str]:
    concept = spec.get("concept") or {}
    raw = spec.get("base_parents") or concept.get("base_parents") or []
    if isinstance(raw, str):
        raw = [raw]
    if not isinstance(raw, (list, tuple)):
        return []
    return [str(v.get("v", v.get("id", "")) if isinstance(v, dict) else v) for v in raw if v]


def _parse_counts(spec: dict[str, Any]) -> dict[str, int]:
    values = spec.get("limbs") or (spec.get("concept") or {}).get("limbs") or {}
    if not isinstance(values, dict):
        return {}
    clean = {}
    for part in ("legs", "arms", "wings", "tails", "tentacles", "heads", "fins"):
        value = values.get(part)
        if isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= 64:
            clean[part] = value
    return clean


def classify(spec: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(spec, dict):
        raise ValueError("asset spec must be an object")
    parents = _parents(spec)
    matches = [PARENT_TO_TOPOLOGY[p] for p in parents if p in PARENT_TO_TOPOLOGY]
    for p in parents:
        if p not in PARENT_TO_TOPOLOGY:
            matches.extend([v for prefix, v in PARENT_PREFIXES if p.startswith(prefix)][:1])
    requested_class = str(spec.get("asset_class") or "").lower()
    asset_class = requested_class if requested_class in ASSET_CLASSES else (
        matches[0][0] if matches else "humanoid" if spec.get("category") == "character" else "fantasy_creature"
    )
    counts = _parse_counts(spec)
    explicit = str(spec.get("anatomy") or spec.get("topology") or "").lower().strip()
    explicit = ALIASES.get(explicit, explicit)
    if explicit and explicit not in TOPOLOGIES:
        raise ValueError("unsupported anatomy: " + explicit)
    topologies = {v[1] for v in matches}
    inferred = (next(iter(topologies)) if len(topologies) == 1 else "hybrid" if topologies else
                "biped" if asset_class == "humanoid" else
                "mechanism" if asset_class == "mechanical" else
                "humanoid_mecha" if asset_class == "robot" else "hybrid")
    anatomy = explicit or inferred
    if not explicit:
        legs, wings, tentacles = counts.get("legs"), counts.get("wings", 0), counts.get("tentacles", 0)
        if tentacles and legs in (None, 0):
            anatomy = "tentacled"
        elif legs == 4 and wings:
            anatomy = "winged_quadruped"
        elif legs == 2 and wings:
            anatomy = "winged_biped"
        elif legs == 0 and counts.get("fins", 0):
            anatomy = "aquatic"
        elif legs == 0 and counts.get("tails", 0) and not wings:
            anatomy = "serpentine"
        elif legs == 8:
            anatomy = "octopod"
        elif legs == 6:
            anatomy = "hexapod"
        elif legs == 4 and anatomy not in {"mechanism", "humanoid_mecha", "quadruped_mecha"}:
            anatomy = "quadruped"
        elif legs == 2 and not wings and anatomy not in {"mechanism", "humanoid_mecha"}:
            anatomy = "biped"
    supplied_surface = str(spec.get("surface_mode") or "").lower()
    surfaces = {v[2] for v in matches}
    surface = supplied_surface if supplied_surface in {"organic", "rigid", "hybrid", "nonrigid"} else (
        "hybrid" if "rigid" in surfaces and "organic" in surfaces else
        "rigid" if asset_class in {"mechanical", "robot"} else
        "nonrigid" if anatomy == "amorphous" else "organic"
    )
    if asset_class == "robot" and surface == "rigid" and anatomy == "biped":
        anatomy = "humanoid_mecha"
    mode = str(spec.get("input_mode") or ("text" if spec.get("prompt_to_3d") is True else "image"))
    if mode not in {"image", "text"}:
        raise ValueError("input_mode must be image or text")
    if mode == "text":
        backends = ["blender_text"]
    elif anatomy in {"mechanism", "humanoid_mecha", "quadruped_mecha", "multi_leg_mecha", "object"}:
        backends = ["partcrafter", "tripo"]
    elif anatomy in {"quadruped", "hexapod", "octopod", "avian", "aquatic", "winged_quadruped", "winged_biped", "serpentine", "tentacled", "plant", "amorphous", "hybrid"}:
        backends = ["anigen", "pixal3d", "tripo"]
    else:
        backends = ["tripo", "pixal3d"]
    api_rig = anatomy if anatomy in API_PRESETS else None
    if anatomy == "winged_biped":
        api_rig = None  # wings must not silently disappear in human rig
    requested = spec.get("requested_clips", DEFAULT_CLIPS[anatomy])
    if not isinstance(requested, list) or any(not isinstance(x, str) for x in requested):
        raise ValueError("requested_clips must be a list of strings")
    clips = list(dict.fromkeys(requested))
    api_presets = API_PRESETS.get(api_rig, {})
    clip_plan = []
    for clip in clips:
        if clip in api_presets:
            method = "tripo_preset"
            preset = "preset:" + api_presets[clip]
        elif clip in PROCEDURAL[anatomy]:
            method = "blender_procedural"
            preset = None
        else:
            method = "review_required"
            preset = None
        clip_plan.append({"clip": clip, "method": method, "preset": preset})
    warnings = []
    if anatomy == "hybrid" and not explicit:
        warnings.append("Unresolved or mixed anatomy; supply explicit anatomy/limbs/landmarks before final approval")
    if mode == "text" and not (spec.get("appearance") or spec.get("prompt") or (spec.get("concept") or {}).get("appearance")):
        warnings.append("Text-to-3D requires an original appearance brief")
    if not spec.get("landmarks") and anatomy not in {"object", "amorphous", "mechanism"}:
        warnings.append("No authored anatomy landmarks; inferred skeletal placement requires visual review")
    return {
        "asset_class": asset_class, "anatomy": anatomy, "input_mode": mode,
        "surface_mode": surface, "limbs": counts, "base_parents": parents,
        "rig_strategy": RIG_STRATEGIES[anatomy],
        "rig_type": api_rig, "backend_priority": backends,
        "requested_clips": clips, "motion_plan": clip_plan,
        "tripo_clips": [v["clip"] for v in clip_plan if v["method"] == "tripo_preset"],
        "procedural_clips": [v["clip"] for v in clip_plan if v["method"] == "blender_procedural"],
        "unsupported": [v["clip"] for v in clip_plan if v["method"] == "review_required"],
        "qa_checks": ["source_integrity", "mesh_integrity", "materials", "export_reload", "motion_coverage"] + QA_BY_TOPOLOGY[anatomy],
        "warnings": warnings,
    }


def save_profile(path: str, spec: dict[str, Any]) -> None:
    from pathlib import Path
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(classify(spec), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
