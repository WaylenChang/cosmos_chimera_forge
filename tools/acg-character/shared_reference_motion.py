"""Sample and phase-align the sources for the shared reference Action set."""

from bisect import bisect_right
from dataclasses import dataclass
from hashlib import sha256
import math

import bpy
from mathutils import Quaternion, Vector


@dataclass(frozen=True)
class Cut:
    source: str
    frames: tuple[int, ...]
    mode: str = "ground"
    target: tuple[int, ...] = ()


def pair(motion, female, male, mode="ground", target=(), male_group="male_01"):
    return (Cut(f"accad/female_01/{motion}", female, mode, target),
            Cut(f"accad/{male_group}/{motion}", male, mode, target))


def shared(source, frames, mode="ground", target=()):
    cut = Cut(source, frames, mode, target)
    return cut, cut


CUTS = {
    "chr_idle": shared("kinemiq/idle_relaxed", (0, 0), "quiet"),
    "chr_walk": pair("walk_forward", (56, 73, 95), (197, 249, 321), "gait", male_group="male_02"),
    "chr_run": pair("run_forward", (8, 19, 30), (30, 43, 55), "run", male_group="male_02"),
    "chr_sneak_idle": (
        Cut("accad/female_01/crouch", (116, 151), "quiet"),
        Cut("kinemiq/idle_crouching", (0, 0), "quiet"),
    ),
    "chr_sneak_move": (
        Cut("cmu/136/136_09", (610, 674, 718), "gait"),
        Cut("cmu/136/136_09", (754, 818, 866), "gait"),
    ),
    "chr_roll_dodge": shared("kinemiq/dodge_roll", (0, 4, 18, 26, 43), "roll", (1, 4, 9, 16, 20)),
    "chr_jump": pair("run_jump_walk", (35, 44, 60, 69), (23, 39, 54, 66), "jump", (1, 13, 22, 30)),
    "chr_swim_idle": shared("quaternius/swim_idle_loop", (0, 0), "water_idle"),
    "chr_swim_move": (
        Cut("cmu/125/125_01", (1100, 2200), "water_stroke"),
        Cut("cmu/126/126_03", (1000, 2200), "water_stroke"),
    ),
    "chr_block": (
        Cut("accad/male_02/block_high", (7, 21, 38, 65), "ground", (1, 8, 18, 30)),
        Cut("accad/male_02/block_middle", (12, 26, 35, 58), "ground", (1, 8, 18, 30)),
    ),
    "chr_hit_react": shared("kinemiq/hit_to_the_chest", (0, 0), "ground"),
    "chr_knockdown": shared("kinemiq/death_fall_backwards", (6, 27, 40, 57), "fall", (1, 14, 22, 30)),
    "chr_getup": (
        Cut("cmu/113/113_08", (1110, 1320, 1514, 1720), "getup", (1, 10, 19, 30)),
        Cut("cmu/140/140_08", (98, 270, 480, 700), "getup", (1, 10, 19, 30)),
    ),
    "chr_interact_pickup": pair("pick_up", (43, 81, 128), (26, 60, 99), "ground", (1, 10, 24)),
    "chr_talk_idle": shared("kinemiq/idle_talking", (0, 0), "quiet"),
    "chr_talk_gesture": (
        Cut("accad/female_01/conversation", (603, 647, 693), "ground", (1, 22, 45)),
        Cut("cmu/138/138_11", (22, 130, 226), "ground", (1, 23, 45)),
    ),
    "chr_victory": (
        Cut("cmu/79/79_69", (308, 436, 522, 620), "ground", (1, 19, 40, 60)),
        Cut("accad/male_02/victory_one", (23, 45, 89, 148), "ground", (1, 18, 37, 60)),
    ),
    "chr_defeated": (
        Cut("cmu/80/80_45", (784, 912, 1068, 1116), "ground", (1, 15, 34, 45)),
        Cut("cmu/79/79_71", (461, 553, 687, 789), "ground", (1, 17, 33, 45)),
    ),
}


MAIN_BONES = ("Hips", "Spine", "Chest", "UpperChest", "Neck", "Head",
              *[side + name for side in ("Left", "Right") for name in
                ("Shoulder", "Arm", "ForeArm", "Hand", "UpLeg", "Leg", "Foot", "Toes")])
TAILS = ("Head", "LeftHand", "RightHand", "LeftToes", "RightToes")
GROUND = ("LeftToes", "RightToes", "LeftToesTip", "RightToesTip")
BODY_GROUND = (*GROUND, "Hips", "LeftHand", "RightHand", "LeftForeArm", "RightForeArm",
               "Head", "HeadTip", "Chest")
UP = Vector((0, 0, 1))


def sample_source(path, asset, bone_map):
    if sha256(path.read_bytes()).hexdigest() != asset["sha256"]:
        raise ValueError(f"Invalid reference file: {path}")
    scene = bpy.context.scene
    scene.render.fps = 30
    scene.render.fps_base = 1
    if path.suffix == ".bvh":
        cmu = asset.get("source_id") == "cmu"
        result = bpy.ops.import_anim.bvh(filepath=str(path), target="ARMATURE",
            global_scale=1 if cmu else .01, axis_forward="Z" if cmu else "-Z", axis_up="Y",
            frame_start=1, use_fps_scale=False, use_cyclic=False, update_scene_fps=False)
    else:
        result = bpy.ops.import_scene.gltf(filepath=str(path))
    assert result == {"FINISHED"}, path
    rig, = [obj for obj in scene.objects if obj.type == "ARMATURE"]
    action = rig.animation_data.action
    start, last = tuple(action.frame_range)
    start = max(start, asset.get("motion_start_frame", start))
    reverse = {target: source for source, target in bone_map.items()}
    scale = .81 / sum(rig.data.bones[reverse[name]].length for name in ("LeftUpLeg", "LeftLeg"))
    fps = 1 / asset["frame_time_seconds"] if "frame_time_seconds" in asset else 30
    stride = max(1, round(fps / 30))
    frames = sorted(set(range(math.ceil(start), math.floor(last) + 1, stride)) | {start, last})
    rows = []
    for frame in frames:
        base = math.floor(frame)
        scene.frame_set(base, subframe=frame - base)
        evaluated = rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
        pose = evaluated.pose.bones
        vertices = {}
        for name in MAIN_BONES:
            if name in reverse:
                vertices[name] = evaluated.matrix_world @ pose[reverse[name]].head * scale
        for name in TAILS:
            vertices[name + "Tip"] = evaluated.matrix_world @ pose[reverse[name]].tail * scale
        if "Root" in reverse:
            vertices["Root"] = evaluated.matrix_world @ pose[reverse["Root"]].head * scale
        if "Spine" not in vertices:
            vertices["Spine"] = vertices["Hips"].lerp(vertices["Chest"], .40)
        rows.append(vertices)

    for obj in list(scene.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for item in list(bpy.data.actions):
        bpy.data.actions.remove(item)
    return frames, rows, fps


def match_swim_cycle(frames, rows, cut, fps):
    """Find a complete breaststroke bounded by equivalent arm and leg poses."""
    lo, hi = cut.frames
    joints = ("LeftHand", "RightHand", "LeftFoot", "RightFoot", "Head")
    eligible = [i for i, frame in enumerate(frames) if lo <= frame <= hi]
    vectors = [tuple(row[name] - row["Hips"] for name in joints) for row in rows]
    def distance(a, b):
        return sum((x - y).length_squared for x, y in zip(vectors[a], vectors[b], strict=True))
    best = None
    for i in eligible[::2]:
        for j in eligible:
            length = frames[j] - frames[i]
            if not 1.05 * fps <= length <= 2.5 * fps:
                continue
            mid = (i + j) // 2
            excursion = max(distance(i, mid), distance(i, (i + mid) // 2),
                            distance(i, (j + mid) // 2))
            if excursion < .22:
                continue
            velocity_error = sum(((a - b) - (c - d)).length_squared for a, b, c, d in
                                 zip(vectors[i + 1], vectors[i], vectors[j], vectors[j - 1], strict=True))
            cost = (distance(i, j) + 4 * velocity_error) / excursion
            if best is None or cost < best[0]:
                best = cost, i, j
    if best is None:
        raise ValueError(f"No full stroke in {cut.source}")
    return frames[best[1]], frames[best[2]]


def interpolate(frames, rows, position):
    i = max(0, min(bisect_right(frames, position) - 1, len(frames) - 2))
    t = (position - frames[i]) / (frames[i + 1] - frames[i])
    return {name: point.lerp(rows[i + 1][name], t) for name, point in rows[i].items()}


def map_time(frame, output, source):
    i = max(0, min(bisect_right(output, frame) - 1, len(output) - 2))
    ratio = (frame - output[i]) / (output[i + 1] - output[i])
    return source[i] + ratio * (source[i + 1] - source[i])


def facing_calibration(rows, mode):
    if mode in ("gait", "run", "jump", "roll"):
        travel = rows[-1]["Hips"] - rows[0]["Hips"]
        travel.z = 0
        # Capture translation establishes forward for the entire take.
        horizontal = travel.normalized()
    else:
        start = rows[0] if mode not in ("getup", "water_stroke") else rows[-1]
        lateral = start["LeftUpLeg"] - start["RightUpLeg"]
        lateral.z = 0
        if lateral.length < .01:
            lateral = start["LeftArm"] - start["RightArm"]
            lateral.z = 0
        horizontal = lateral.cross(UP).normalized()
    if horizontal.length < .95:
        raise ValueError(f"Degenerate facing for {mode}")
    yaw = -math.pi / 2 - math.atan2(horizontal.y, horizontal.x)
    return Quaternion(UP, yaw)


def compose_track(cut, data, spec):
    frames, rows, fps = data
    count = spec["expected_frames"]
    samples = cut.frames
    if samples == (0, 0):
        samples = frames[0], frames[-1]
    if cut.mode == "water_stroke":
        samples = match_swim_cycle(frames, rows, cut, fps)
    assert frames[0] <= samples[0] < samples[-1] <= frames[-1], (cut.source, samples, frames[-1])
    samples_raw = [p for f, p in zip(frames, rows, strict=True) if samples[0] <= f <= samples[-1]]
    orient = facing_calibration(samples_raw, cut.mode)
    first = interpolate(frames, rows, samples[0])
    last = interpolate(frames, rows, samples[-1])
    source_root = "Root" if "Root" in first else "Hips"
    if cut.mode == "roll" and (last[source_root] - first[source_root]).xy.length < .25:
        source_root = "Hips"
    root_home = first[source_root]
    floor_points = BODY_GROUND if cut.mode in ("fall", "getup", "roll") else GROUND
    floor = min(p[name].z for p in samples_raw for name in floor_points)
    target = cut.target or (1, count)
    if cut.mode in ("gait", "run"):
        events = [item["frame"] for item in spec["events"]]
        beat1, beat2 = events or (1, 1 + (count - 1) // 2)
        target = (beat1, beat2, beat1 + count - 1)
    keys = []
    target_samples = (1 + frame / 2 for frame in range(2 * count - 1)) if cut.mode == "roll" else range(1, count + 1)
    for out in target_samples:
        phase = ((out - target[0]) % (count - 1)) + target[0] if cut.mode in ("gait", "run") else out
        t = map_time(phase, target, samples)
        animation = interpolate(frames, rows, t)
        frac = (t - samples[0]) / (samples[-1] - samples[0])
        center = animation["Hips"]
        local = {name: orient @ (point - center) for name, point in animation.items()}
        if spec["loop"]:
            for name, value in local.items():
                correction = (last[name] - last["Hips"]) - (first[name] - first["Hips"])
                local[name] = value - (orient @ correction) * frac
        source_motion = orient @ (animation[source_root] - root_home)
        hip_drift = orient @ (center - first["Hips"])
        if spec["loop"]:
            hip_drift -= orient @ (last["Hips"] - first["Hips"]) * frac
        if cut.mode in ("gait", "run", "jump"):
            hip_drift.y = 0
        height = max(0., min(animation[name].z for name in floor_points) - floor)
        if spec["loop"]:
            endpoint = (min(last[name].z for name in floor_points)
                        - min(first[name].z for name in floor_points))
            height = max(0., height - endpoint * frac)
        if cut.mode == "gait" or cut.mode == "quiet":
            height = min(.035, height)
        if cut.mode == "run":
            height = min(.16, height)
        if cut.mode in ("roll", "fall", "getup"):
            height = min(.20, height)
        if cut.mode == "gait" and spec["events"]:
            distance = min(abs(out - item["frame"]) for item in spec["events"])
            height *= min(1, distance / 3)
        keys.append((out, (local, source_motion, hip_drift, height)))
    if spec["loop"]:
        keys[-1] = (keys[-1][0], keys[0][1])
    provenance = {
        "clip_id": cut.source, "source_frame_range": [samples[0], samples[-1]], "source_fps": round(fps, 3),
        "phase_source_frames": list(samples), "phase_target_frames": list(target), "mode": cut.mode,
        "source_translation_bone": source_root if spec["root_motion"] else None,
        "footstep_sides": (["Right", "Left"] if cut.mode == "gait" else ["Left", "Right"]) if spec["events"] and cut.mode in ("gait", "run") else [],
    }
    return keys, provenance


def compile_tracks(library, catalog):
    assets = {clip["id"]: clip for clip in catalog["clips"]}
    result = {}
    cached = {}
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for index, profile in enumerate(("female", "male")):
        result[profile] = {}
        for name, cuts in CUTS.items():
            cut = cuts[index]
            spec = catalog["game_actions"][name]
            assert cut.source in spec["clip_ids"], (name, cut.source)
            if cut.source not in cached:
                asset = assets[cut.source]
                cached[cut.source] = sample_source(library / asset["path"], asset,
                    catalog["retarget_bone_maps"][asset["retarget_map_id"]])
            result[profile][name] = compose_track(cut, cached[cut.source], spec)
    return result

