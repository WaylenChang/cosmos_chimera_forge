"""Real Blender profile-aware rig, procedural motion and quality checks.

Invoked by the agent only on a real GLB model, never constructs a fake source
mesh. Automatic rigging is explicitly opt-in because image reconstruction alone
cannot prove true anatomy. Model/rig/animation checks are recorded independently.
Usage: blender -b --python scripts/anime3d_typed_blender.py -- input.glb output profile.json [spec.json]
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
if len(args) < 3:
    raise SystemExit("Usage: blender -b --python anime3d_typed_blender.py -- model.glb output_dir profile.json [spec.json]")
model, out, profile_path = Path(args[0]), Path(args[1]), Path(args[2])
spec = json.loads(Path(args[3]).read_text(encoding="utf8")) if len(args) > 3 else {}
profile = json.loads(profile_path.read_text(encoding="utf8"))
out.mkdir(parents=True, exist_ok=True)
(out / "models").mkdir(exist_ok=True)
(out / "qa").mkdir(exist_ok=True)
(out / "animations").mkdir(exist_ok=True)
(out / "rig").mkdir(exist_ok=True)
(out / "previews").mkdir(exist_ok=True)
if not model.is_file() or model.suffix.lower() != ".glb":
    raise SystemExit("A real source .glb is required; no placeholder geometry is generated")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(model))
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if not meshes:
    raise SystemExit("The source model contains no mesh objects")
bpy.context.view_layer.update()


def bbox():
    bounds = [o.matrix_world @ Vector(v) for o in meshes for v in o.bound_box]
    return ([min(v[i] for v in bounds) for i in range(3)],
            [max(v[i] for v in bounds) for i in range(3)])


lo, hi = bbox()
size = [max(hi[i] - lo[i], 0.00001) for i in range(3)]
center = [(lo[i] + hi[i]) / 2 for i in range(3)]
topology = profile["anatomy"]
rigs = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
rig = rigs[0] if rigs else None


def point(name, fallback):
    named = spec.get("landmarks") or {}
    p = named.get(name) if isinstance(named, dict) else None
    if isinstance(p, list) and len(p) == 3 and all(isinstance(x, (int, float)) for x in p):
        return Vector(p)
    return Vector((center[0] + fallback[0] * size[0],
                   center[1] + fallback[1] * size[1],
                   lo[2] + fallback[2] * size[2]))


def add_bone(name, a, b, parent=None):
    bone = rig.data.edit_bones.new(name)
    bone.head, bone.tail = a, b
    if (bone.head - bone.tail).length < 0.001:
        bone.tail = bone.head + Vector((0, 0, 0.05))
    if parent:
        bone.parent = rig.data.edit_bones.get(parent)
    return bone


def skeleton():
    """Build an explicit topology-specific guide rig; auto weights remain provisional."""
    global rig
    arm = bpy.data.armatures.new("AnatomyRig")
    rig = bpy.data.objects.new("AnatomyRig", arm)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    add_bone("Root", point("root", (0, 0, 0.10)), point("hips", (0, 0, 0.32)))
    add_bone("Spine", point("hips", (0, 0, 0.32)), point("chest", (0, 0, 0.70)), "Root")
    add_bone("Neck", point("chest", (0, 0, 0.70)), point("head", (0, 0, 0.93)), "Spine")
    if topology in {"biped", "winged_biped", "humanoid_mecha", "quadruped", "winged_quadruped", "quadruped_mecha", "hexapod", "octopod", "multi_leg_mecha"}:
        legs = profile.get("limbs", {}).get("legs")
        if not isinstance(legs, int):
            legs = {"biped": 2, "winged_biped": 2, "humanoid_mecha": 2,
                    "quadruped": 4, "winged_quadruped": 4, "quadruped_mecha": 4,
                    "hexapod": 6, "octopod": 8, "multi_leg_mecha": 6}.get(topology, 0)
        for i in range(legs):
            side = -1 if i % 2 == 0 else 1
            group = i // 2
            step = max(1, math.ceil(legs / 2))
            along = 0 if step == 1 else (group / (step - 1)) * 0.8 - 0.4
            root = point(f"leg_{i}_root", (side * 0.25, along, 0.45 if legs > 2 else 0.35))
            knee = point(f"leg_{i}_knee", (side * 0.33, along + 0.04, 0.25))
            foot = point(f"leg_{i}_foot", (side * 0.36, along + 0.08, 0.03))
            add_bone(f"Leg_{i}_upper", root, knee, "Root")
            add_bone(f"Leg_{i}_lower", knee, foot, f"Leg_{i}_upper")
    if topology in {"biped", "winged_biped", "humanoid_mecha"}:
        for i, side in enumerate((-1, 1)):
            shoulder = point(f"arm_{i}_root", (side * 0.20, 0, 0.75))
            elbow = point(f"arm_{i}_elbow", (side * 0.37, 0, 0.53))
            hand = point(f"arm_{i}_hand", (side * 0.45, 0, 0.37))
            add_bone(f"Arm_{i}_upper", shoulder, elbow, "Spine")
            add_bone(f"Arm_{i}_lower", elbow, hand, f"Arm_{i}_upper")
    if topology in {"avian", "winged_quadruped", "winged_biped"}:
        for i, side in enumerate((-1, 1)):
            a = point(f"wing_{i}_root", (side * 0.16, 0, 0.73))
            b = point(f"wing_{i}_elbow", (side * 0.37, 0.04, 0.82))
            c = point(f"wing_{i}_tip", (side * 0.52, 0.14, 0.98))
            add_bone(f"Wing_{i}_upper", a, b, "Spine")
            add_bone(f"Wing_{i}_lower", b, c, f"Wing_{i}_upper")
    if topology in {"serpentine", "aquatic", "tentacled", "plant"}:
        part = "Tail" if topology in {"serpentine", "aquatic"} else "Tendril"
        count = min(16, max(4, int(spec.get("chain_segments", 6))))
        previous = "Root"
        for i in range(count):
            a = point(f"chain_{i}", (0, (i / count) - 0.5, 0.45))
            b = point(f"chain_{i+1}", (0, ((i + 1) / count) - 0.5, 0.45))
            add_bone(f"{part}_{i}", a, b, previous)
            previous = f"{part}_{i}"
    if topology in {"quadruped", "winged_quadruped", "quadruped_mecha", "biped", "winged_biped", "avian"} and profile.get("limbs", {}).get("tails", 1):
        add_bone("Tail", point("tail_base", (0, -0.25, 0.45)),
                 point("tail_tip", (0, -0.50, 0.28)), "Root")
    bpy.ops.object.mode_set(mode="OBJECT")
    return rig


# For rigid machinery do not invent mechanical pivots or soft-skin parts.
rigid = profile["rig_strategy"] in {"rigid_part_hierarchy", "object_transform"}
parts = spec.get("parts") or []
rig_quality = {"strategy": profile["rig_strategy"], "status": "existing" if rig else "missing"}
if rigid and topology == "object":
    rig_quality = {"strategy": "object_transform", "status": "object_transform",
                   "part_count": len(meshes)}
elif rigid:
    names = {o.name for o in meshes}
    defined = isinstance(parts, list) and len(parts) > 0 and all(
        isinstance(p, dict) and isinstance(p.get("object"), str) and p["object"] in names
        and isinstance(p.get("pivot"), list) and len(p["pivot"]) == 3
        and p.get("joint") in {"fixed", "hinge", "slider", "rotation"} for p in parts)
    if defined:
        for part in parts:
            obj = bpy.data.objects[part["object"]]
            # Blender origin must be moved without moving visible geometry.
            pivot = Vector(part["pivot"])
            mw = obj.matrix_world.copy()
            world_offset = obj.matrix_world.inverted() @ pivot
            obj.data = obj.data.copy()
            obj.data.transform(__import__("mathutils").Matrix.Translation(-world_offset))
            obj.matrix_world = mw @ __import__("mathutils").Matrix.Translation(world_offset)
            obj["joint_type"] = part["joint"]
            obj["joint_axis"] = part.get("axis", [0, 0, 1])
            obj["joint_min"] = part.get("min", 0)
            obj["joint_max"] = part.get("max", 0)
        rig_quality = {"strategy": "rigid_part_hierarchy", "status": "explicit_parts", "part_count": len(parts)}
    else:
        rig_quality = {"strategy": "rigid_part_hierarchy", "status": "requires_part_definitions",
                       "note": "Supply mesh-object identifiers, real pivots, joint types and limits"}
elif not rig and spec.get("allow_provisional_rig") is True:
    rig = skeleton()
    # Envelope weights are an approximation only; never approve as production rig.
    for mesh in meshes:
        if not mesh.vertex_groups:
            for bone in rig.data.bones:
                mesh.vertex_groups.new(name=bone.name)
        modifier = mesh.modifiers.new("Provisional armature", "ARMATURE")
        modifier.object = rig
        modifier.use_bone_envelopes = True
    rig_quality = {"strategy": profile["rig_strategy"], "status": "provisional_envelope",
                   "note": "Needs manual landmark and deformation/weight review"}
elif not rig:
    rig_quality["note"] = "No existing rig; provide one or opt into provisional envelope guides"

(out / "rig" / "rig_report.json").write_text(json.dumps(rig_quality, ensure_ascii=False, indent=2), encoding="utf8")


def targets(clip):
    """Return stable, bounded procedural motion channels for named bones."""
    samples = {}
    if rig:
        for bone in rig.pose.bones:
            if bone.name.startswith("Leg_") and clip in {"walk", "run", "march"}:
                number = int(bone.name.split("_")[1])
                offset = number * math.pi / (2 if topology in {"quadruped", "hexapod", "octopod"} else 1)
                amp = 0.23 if clip == "walk" else 0.36
                samples[bone.name] = (amp, offset, "X")
            elif bone.name.startswith("Wing_") and clip in {"fly", "glide", "land"}:
                samples[bone.name] = (0.35 if clip == "fly" else 0.12, math.pi * int(bone.name.split("_")[1]), "Y")
            elif bone.name.startswith(("Tail", "Tendril")) and clip in {"idle", "swim", "march", "attack"}:
                samples[bone.name] = (0.12, 0.42 * len(bone.name), "Z")
            elif bone.name == "Spine" and clip in {"idle", "pulse"}:
                samples[bone.name] = (0.04, 0, "Y")
    return samples


clips = []
requested = profile.get("motion_plan", [])
frames = max(16, int(spec.get("animation_frames", 48)))
for item in requested:
    clip, method = item["clip"], item["method"]
    if method != "blender_procedural":
        clips.append({"name": clip, "method": method, "status": "external" if method == "tripo_preset" else "unsupported"})
        continue
    if topology == "object" and clip in {"idle", "spin", "attack"}:
        for mesh in meshes:
            mesh.rotation_mode = "XYZ"
            initial = tuple(mesh.rotation_euler)
            for frame in (1, frames):
                angle = 2 * math.pi if clip == "spin" and frame == frames else 0
                mesh.rotation_euler = (initial[0], initial[1], initial[2] + angle)
                mesh.keyframe_insert(data_path="rotation_euler", frame=frame)
        clips.append({"name": clip, "method": method, "status": "generated",
                      "frames": frames, "provisional": False})
    elif rigid and rig_quality["status"] == "explicit_parts" and clip in {"open", "close", "rotate", "extend", "retract", "spin"}:
        for part in parts:
            obj = bpy.data.objects[part["object"]]
            if part["joint"] == "fixed":
                continue
            lo_lim, hi_lim = float(part.get("min", 0)), float(part.get("max", 0))
            axis = Vector(part.get("axis", [0, 0, 1]))
            if axis.length < 0.000001:
                continue
            axis.normalize()
            prop = "location" if part["joint"] == "slider" else "rotation_euler"
            base = tuple(getattr(obj, prop))
            for frame, t in ((1, 0), (frames, 1)):
                amount = (lo_lim + (hi_lim - lo_lim) * (t if clip not in {"close", "retract"} else 1 - t))
                vec = Vector(base) + axis * amount
                setattr(obj, prop, vec[:])
                obj.keyframe_insert(data_path=prop, frame=frame)
        clips.append({"name": clip, "method": method, "status": "generated", "frames": frames, "provisional": True})
    elif rig and not rigid:
        channels = targets(clip)
        if not channels:
            clips.append({"name": clip, "method": method, "status": "no_template_for_rig"})
            continue
        action = bpy.data.actions.new(f"typed_{topology}_{clip}")
        rig.animation_data_create()
        # Blender 4.4+ supports action slots; older versions still accept action assignment.
        try:
            rig.animation_data.action = action
        except Exception:
            clips.append({"name": clip, "method": method, "status": "blender_action_incompatible"})
            continue
        for name, (amp, offset, axis) in channels.items():
            bone = rig.pose.bones[name]
            bone.rotation_mode = "XYZ"
            for frame in (1, frames // 4, frames // 2, 3 * frames // 4, frames):
                phase = 2 * math.pi * (frame - 1) / (frames - 1)
                index = "XYZ".index(axis)
                rot = [0.0, 0.0, 0.0]
                rot[index] = amp * math.sin(phase + offset)
                bone.rotation_euler = rot
                bone.keyframe_insert(data_path="rotation_euler", frame=frame, group=name)
        rig.animation_data.action = None
        clips.append({"name": clip, "method": method, "status": "generated", "frames": frames, "provisional": True})
    else:
        clips.append({"name": clip, "method": method, "status": "needs_rig_or_mechanism"})

(out / "animations" / "animations_manifest.json").write_text(
    json.dumps({"clips": clips, "source": "typed_blender", "topology": topology}, ensure_ascii=False, indent=2), encoding="utf8")

# Four orthographic turntable views serve as evidence for visual inspection.
rendered_views = []
try:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    cam_data = bpy.data.cameras.new("TypedQA_Camera")
    cam = bpy.data.objects.new("TypedQA_Camera", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 1.65 * max(size)
    focus = Vector(center)
    distance = 2.8 * max(size)
    for label, angle in (("front", 0.0), ("right", math.pi / 2),
                         ("back", math.pi), ("left", 3 * math.pi / 2)):
        cam.location = focus + Vector((distance * math.sin(angle),
                                       -distance * math.cos(angle),
                                       distance * 0.15))
        cam.rotation_euler = (focus - cam.location).to_track_quat("-Z", "Y").to_euler()
        target = out / "previews" / ("qa_" + label + ".png")
        scene.render.filepath = str(target)
        bpy.ops.render.render(write_still=True)
        if target.is_file() and target.stat().st_size:
            rendered_views.append(str(target.relative_to(out)))
except Exception as exc:
    print("WARN: multi-view render unavailable:", exc)

triangles = sum(sum(len(p.vertices) - 2 for p in mesh.data.polygons) for mesh in meshes)
poly_budget = int(spec.get("poly_budget_triangles") or 30000)
uv_missing = [m.name for m in meshes if not m.data.uv_layers]
materials_missing = [m.name for m in meshes if not m.data.materials]
required = set(profile.get("requested_clips", []))
covered = {x["name"] for x in clips if x["status"] == "generated"}
covered.update(x["clip"] for x in requested if x["method"] == "tripo_preset" and any(x["clip"] in a.name.lower() for a in bpy.data.actions))
qa = {
    "asset_class": profile["asset_class"], "topology": topology,
    "checks": profile["qa_checks"], "mesh_count": len(meshes),
    "triangles": triangles, "triangle_budget": poly_budget,
    "uv_missing": uv_missing, "materials_missing": materials_missing,
    "rig": rig_quality, "motions": clips, "rendered_views": rendered_views,
    "required_clips": sorted(required), "covered_clips": sorted(covered),
    "hard_checks": {
        "mesh": bool(meshes and triangles > 0),
        "budget": bool(triangles <= poly_budget),
        "uv": not uv_missing,
        "materials": not materials_missing,
        "rig": rig_quality["status"] in {"existing", "explicit_parts", "object_transform"},
        "motions": required <= covered,
        "visual_anatomy": False,  # requires rendered pose sweep reviewed by visual QA
        "collision_free": False,   # not safe to infer from one rest pose
        "export_reload": False,    # updated only after actual reload
        "multiview_evidence": len(rendered_views) == 4,
    },
    "warnings": profile.get("warnings", []) +
                ["Visual anatomy, deformation, poses and self-intersection require reviewed renders"],
}
bpy.ops.wm.save_as_mainfile(filepath=str(out / "models" / (model.stem + ".blend")))
bpy.ops.export_scene.gltf(filepath=str(out / "models" / (model.stem + ".glb")), export_format="GLB", export_animations=True)
# Round-trip test: not just checking whether export wrote bytes.
export_file = out / "models" / (model.stem + ".glb")
if export_file.is_file() and export_file.stat().st_size > 0:
    try:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(export_file))
        qa["hard_checks"]["export_reload"] = any(x.type == "MESH" for x in bpy.context.scene.objects)
    except Exception as exc:
        qa["warnings"].append("Export reload failed: " + str(exc))
qa["automated_pass"] = all(v for k, v in qa["hard_checks"].items() if k not in {"visual_anatomy", "collision_free"})
qa["passed"] = False  # only a separate final human approval can set this
qa["status"] = "REVIEW_REQUIRED" if qa["automated_pass"] else "QA_PENDING"
(out / "qa" / "typed_metrics.json").write_text(json.dumps(qa, ensure_ascii=False, indent=2), encoding="utf8")
print(json.dumps({"status": qa["status"], "automated_pass": qa["automated_pass"],
                  "metrics": str(out / "qa" / "typed_metrics.json")}, ensure_ascii=False))
