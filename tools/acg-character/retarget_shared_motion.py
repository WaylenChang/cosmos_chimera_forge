"""Transfer body-space BVH trajectory arcs into the authored shared action plans."""

from dataclasses import dataclass
from hashlib import sha256
import math

import bpy
from mathutils import Vector


@dataclass(frozen=True)
class Reference:
    female: str
    male: str
    landmark: str
    seconds: tuple[float, float]
    target_frames: tuple[int, int]
    body: float
    wrists: tuple[float, float]


def ref(source, landmark, target, *, male=None, seconds=(.48, .32), body=.23, wrists=(0, .24)):
    return Reference(source, male or source, landmark, seconds, target, body, wrists)


def accad(motion, landmark, target, **weights):
    return ref(f"accad/female_01/{motion}", landmark, target,
               male=f"accad/male_01/{motion}", **weights)


REFERENCES = {
    "chr_idle_long": accad("sway", "center", (1, 120), seconds=(1.0, 1.0), body=.40, wrists=(.12, .12)),
    "chr_glide": ref("cmu/143/143_36", "spread", (1, 45), seconds=(.65, .55), body=.14, wrists=(.18, .18)),
    "chr_mount_idle": ref("cmu/114/114_05", "seated", (1, 60), seconds=(.62, .62), body=.23, wrists=(0, 0)),
    "chr_command_point": ref("cmu/13/13_27", "reach", (1, 10), male="cmu/14/14_24", body=.25),
    "chr_command_recall": ref("cmu/113/113_27", "high", (1, 10), body=.21, wrists=(0, .27)),
    "chr_item_use_self": ref("cmu/13/13_08", "near_head", (9, 24), male="cmu/79/79_38",
                             seconds=(.68, .20), body=.22, wrists=(.07, .25)),
    "chr_item_use_other": ref("cmu/80/80_27", "reach", (9, 16), body=.22, wrists=(0, .30)),
    "chr_field_deploy": accad("put_down", "low", (9, 30), seconds=(.60, .25), body=.38, wrists=(.22, .22)),
    "chr_throw_card": ref("cmu/22/22_22", "swing", (5, 12), body=.31, wrists=(0, .20)),
    "chr_throw_bead": ref("cmu/22/22_24", "swing", (6, 15), body=.34, wrists=(0, .13)),
    "chr_throw_cube": ref("cmu/113/113_24", "swing", (10, 18), male="cmu/33/33_01",
                          body=.31, wrists=(0, .22)),
    "chr_gather_forage": ref("cmu/80/80_09", "low", (8, 22), male="cmu/139/139_06",
                             seconds=(.64, .28), body=.35, wrists=(0, .30)),
    "chr_mine_pick": ref("cmu/79/79_04", "downstroke", (5, 16), male="cmu/79/79_01",
                         body=.31, wrists=(.14, .14)),
    "chr_fish_cast": ref("cmu/79/79_34", "swing", (6, 16), male="cmu/80/80_12",
                         body=.22, wrists=(.22, .22)),
    "chr_fish_wait": ref("cmu/79/79_35", "quiet", (1, 60), male="cmu/80/80_12",
                         seconds=(.72, .72), body=.12, wrists=(.08, .08)),
    "chr_fish_reel": ref("cmu/79/79_35", "swing", (6, 20), male="cmu/80/80_12",
                         seconds=(.55, .49), body=.18, wrists=(0, .30)),
    "chr_cook_camp": ref("cmu/79/79_13", "stir", (1, 60), male="cmu/80/80_16",
                         seconds=(.66, .54), body=.16, wrists=(0, .38)),
    "chr_craft_forge": ref("cmu/79/79_01", "downstroke", (5, 18), body=.29, wrists=(0, .25)),
    "chr_trap_place": accad("put_down", "low", (7, 22), seconds=(.47, .23), body=.38, wrists=(.20, .20)),
    "chr_pet_s": accad("crouch", "low", (4, 30), seconds=(.78, .22), body=.36, wrists=(0, 0)),
    "chr_pet_m": accad("pick_up", "low", (5, 30), seconds=(.63, .27), body=.36, wrists=(0, 0)),
}


def vec3(x, y, z):
    return Vector((x, y, z))


def pair(mid, left, right):
    return (mid(left) + mid(right)) * .5


def measure_clip(asset, library):
    path = library / asset["path"]
    if sha256(path.read_bytes()).hexdigest() != asset["sha256"]:
        raise ValueError(f"Reference checksum mismatch: {path}")
    cmu = asset.get("source_id") == "cmu"
    result = bpy.ops.import_anim.bvh(
        filepath=str(path), target="ARMATURE", global_scale=1 if cmu else .01,
        axis_forward="Z" if cmu else "-Z", axis_up="Y", frame_start=1,
        use_fps_scale=False, use_cyclic=False, update_scene_fps=False, update_scene_duration=False,
    )
    assert result == {"FINISHED"}, path
    rig = bpy.context.view_layer.objects.active
    scene = bpy.context.scene
    action = rig.animation_data.action
    lower = rig.data.bones["LeftUpLeg"].length + rig.data.bones["LeftLeg"].length
    scale = .81 / lower
    up = vec3(0, 0, 1)
    fps = 1 / asset["frame_time_seconds"]
    step = max(1, round(fps / 30))
    frames = range(asset.get("motion_start_frame", 1), asset["frames"] + 1, step)
    samples = []
    lateral = 0.
    previous_center = None
    for frame in frames:
        scene.frame_set(frame)
        posed = rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
        def head(name):
            return posed.matrix_world @ posed.pose.bones[name].head

        center = head("Hips")
        left = head("LeftUpLeg") - head("RightUpLeg")
        left.z = 0
        left.normalize()
        back = up.cross(left)
        if previous_center is not None:
            lateral += (center - previous_center).dot(left) * scale
        previous_center = center
        shoulders = head("LeftArm") - head("RightArm")
        collar = pair(head, "LeftArm", "RightArm")
        torso = head("Neck") - center
        torso_pitch = math.degrees(math.atan2(-torso.dot(back), torso.z))
        torso_roll = math.degrees(math.atan2(torso.dot(left), torso.z))
        torso_yaw = math.degrees(math.atan2(shoulders.dot(back), shoulders.dot(left)))

        # Use the horizontal hip axes so the actor's path and facing do not move the game root.
        def local(point):
            location = point - center
            return vec3(location.dot(left), location.dot(back), location.z) * scale

        samples.append({
            "frame": frame,
            "hip": vec3(lateral, 0, center.z * scale),
            "body": vec3(torso_pitch, torso_roll, torso_yaw),
            "left": local(head("LeftHand")),
            "right": local(head("RightHand")),
            "collar": local(collar),
            "head": local(head("Head")),
        })
    bpy.data.objects.remove(rig, do_unlink=True)
    bpy.data.actions.remove(action)
    if len(samples) < 12:
        raise ValueError(f"Insufficient body samples in {asset['id']}")
    return samples, fps, step


def choose_window(samples, fps, step, reference):
    margin = max(3, round(len(samples) * .055))
    candidates = range(margin, len(samples) - margin)
    before = max(3, round(reference.seconds[0] * fps / step))
    after = max(3, round(reference.seconds[1] * fps / step))
    span = before + after

    def score(i):
        pose = samples[i]
        speed = samples[i + 2]["right"] - samples[i - 2]["right"]
        other = samples[i + 2]["left"] - samples[i - 2]["left"]
        if reference.landmark == "center":
            return -abs(i - len(samples) / 2)
        if reference.landmark == "quiet":
            return -(speed.length + other.length) - .0003 * abs(i - len(samples) / 2)
        if reference.landmark == "seated":
            return -pose["hip"].z - .45 * (speed.length + other.length)
        if reference.landmark == "spread":
            return (pose["left"] - pose["right"]).length - .33 * abs(pose["left"].z - pose["right"].z)
        if reference.landmark == "reach":
            return -pose["right"].y - .33 * abs(pose["right"].z - pose["collar"].z)
        if reference.landmark == "high":
            return pose["right"].z - .23 * abs(pose["right"].x)
        if reference.landmark == "near_head":
            return -(pose["head"] - pose["right"]).length
        if reference.landmark == "low":
            return -pose["hip"].z + .45 * (pose["body"].x / 45) - .17 * pose["right"].z
        if reference.landmark == "downstroke":
            return -speed.z + .22 * speed.length
        if reference.landmark == "stir":
            return math.hypot(speed.x, speed.y) - .25 * abs(speed.z)
        if reference.landmark == "swing":
            return speed.length + .16 * other.length
        raise ValueError(reference.landmark)

    landmark = max(candidates, key=score)
    first = max(0, min(landmark - before, len(samples) - span - 1))
    last = min(len(samples) - 1, first + span)
    assert last - first >= 8
    return first, landmark, last


def residual_shape(samples, first, last, key, t):
    """Resample the normalized path and remove its endpoint trend before blending."""
    position = first + (last - first) * t
    center = math.floor(position)
    weight = position - center
    def average(i):
        indices = range(max(first, i - 1), min(last, i + 1) + 1)
        return sum((samples[j][key] for j in indices), Vector((0., 0., 0.))) / len(indices)
    actual = average(center).lerp(average(min(center + 1, last)), weight)
    return actual - average(first).lerp(average(last), t)


def limit(vec, maxima):
    return Vector(tuple(max(-maximum, min(maximum, v)) for v, maximum in zip(vec, maxima, strict=True)))


def build_layer(samples, first, last, reference):
    target_start, target_end = reference.target_frames
    layer = {}
    for target in range(target_start, target_end + 1):
        fraction = (target - target_start) / (target_end - target_start)
        if target in (target_start, target_end):
            continue
        weight = math.sin(math.pi * fraction) ** 2
        hip = residual_shape(samples, first, last, "hip", fraction)
        body = residual_shape(samples, first, last, "body", fraction)
        left = residual_shape(samples, first, last, "left", fraction)
        right = residual_shape(samples, first, last, "right", fraction)
        hip = limit(hip * (weight * reference.body), (.023, 0, .027))
        body = limit(body * (weight * reference.body), (4.7, 3.1, 5.2))
        max_delta = (.023, .026, .029)
        left = limit(left * (weight * reference.wrists[0]), max_delta)
        right = limit(right * (weight * reference.wrists[1]), max_delta)
        if reference.wrists[0] == reference.wrists[1] and reference.wrists[0] and reference.landmark in ("low", "swing", "downstroke"):
            # Both hands stay on the same tool or object when applying a source arc.
            left = right = (left + right) * .5
        layer[target] = (hip, body, left, right)
    return layer


def compile_references(library, catalog):
    assets = {clip["id"]: clip for clip in catalog["clips"]}
    tracks = {}
    result = {}
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for profile in ("female", "male"):
        layers = {}
        for action_id, reference in REFERENCES.items():
            clip_id = getattr(reference, profile)
            assert clip_id in catalog["game_actions"][action_id]["clip_ids"], (action_id, clip_id)
            if clip_id not in tracks:
                tracks[clip_id] = measure_clip(assets[clip_id], library)
            samples, fps, step = tracks[clip_id]
            first, landmark, last = choose_window(samples, fps, step, reference)
            layer = build_layer(samples, first, last, reference)
            hip, body, left, right = (max(values[i].length for values in layer.values()) for i in range(4))
            assert max(hip * 100, body, left * 100, right * 100) > .025, (action_id, clip_id)
            layers[action_id] = {
                "samples": layer,
                "source": {
                    "clip_id": clip_id,
                    "source_frame_range": [samples[first]["frame"], samples[last]["frame"]],
                    "source_landmark_frame": samples[landmark]["frame"],
                    "source_fps": round(fps, 3),
                    "target_frame_range": list(reference.target_frames),
                    "source_landmark": reference.landmark,
                    "layered_channels": ["hips_lateral_vertical", "torso", *(
                        hand for hand, weight in zip(("left_wrist", "right_wrist"), reference.wrists, strict=True) if weight
                    )],
                    "largest_source_hip_offset_m": round(hip, 5),
                    "largest_source_torso_offset_deg": round(body, 4),
                    "largest_source_wrist_offset_m": round(max(left, right), 5),
                },
            }
        result[profile] = layers
    return result

