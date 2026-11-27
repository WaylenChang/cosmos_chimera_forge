"""Build verified 50-Action Blender libraries for the two shared rigs.

blender -b --python tools/acg-character/build_shared_reference_actions.py -- LIBRARY OUT
"""

from argparse import ArgumentParser
from collections import Counter
from pathlib import Path
import json
import math
import sys

import bpy
from mathutils import Matrix, Quaternion, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_shared_character_actions import SkeletonPose, SIDES, capture, scene_setup, bone_segments, verify_append
from shared_reference_motion import CUTS, GROUND, BODY_GROUND, compile_tracks


ZERO = Vector((0, 0, 0))
UP = Vector((0, 0, 1))
AXIS = Vector((0, 1, 0))
DIGITS = ("Thumb", "Index", "Middle", "Ring", "Little")
FINGERS = {
    "chr_idle": .26, "chr_walk": .31, "chr_run": .67, "chr_sneak_idle": .35,
    "chr_sneak_move": .47, "chr_roll_dodge": .48, "chr_jump": .20,
    "chr_swim_idle": .12, "chr_swim_move": .08, "chr_block": .71,
    "chr_hit_react": .26, "chr_knockdown": .22, "chr_getup": .30,
    "chr_talk_idle": .26, "chr_talk_gesture": .19, "chr_victory": .23, "chr_defeated": .30,
}


def body_basis(left, up):
    x = left.normalized()
    z = (up - x * x.dot(up)).normalized()
    if x.length < .95 or z.length < .95:
        raise ValueError("Degenerate source torso plane")
    return Matrix((x, z.cross(x), z)).transposed().to_quaternion()


def compliant(rotation, prev):
    result = rotation.normalized()
    if prev is not None:
        result.make_compatible(prev)
    return result


class Transfer(SkeletonPose):
    def __init__(self, rig):
        length = sum(rig.data.bones[name].length for name in ("LeftUpLeg", "LeftLeg"))
        super().__init__(rig, length / .81)
        self.driven = tuple(b.name for b in self.bones if b.use_deform or b.name == "Root")

    def set(self, name, matrix):
        super().set(name, matrix)
        if name == "Root":
            bone = self.rig.pose.bones[name]
            bone.location = self.rest[name].to_3x3().inverted() @ (matrix.translation - self.rest[name].translation)

    def aim(self, name, v, align=None):
        neutral = self.rest[name].to_quaternion()
        natural = self.base(name)
        desired = natural.to_quaternion() if align is None else align @ neutral
        reference_axis = desired @ AXIS
        if v.length < 1e-4:
            self.point(name, natural.translation, desired)
            return
        q = reference_axis.rotation_difference(v.normalized()) @ desired
        self.point(name, natural.translation, q)

    def hand(self, p, side, torso, curl):
        source = p[side + "HandTip"] - p[side + "Hand"]
        forearm = p[side + "Hand"] - p[side + "ForeArm"]
        # Favor wrist continuity when an End Site points back into the forearm.
        direction = source.normalized()
        axis = forearm.normalized()
        agreement = axis.dot(direction)
        weight = .72 * max(0., min(1., (agreement + .07) / .67))
        source = axis.lerp(direction, weight)
        hand_name = side + "Hand"
        self.aim(hand_name, source)
        for i, digit in enumerate(DIGITS):
            for segment, turn in enumerate((.56, .79, .68), 1):
                name = f"{side}{digit}{segment}"
                matrix = self.base(name)
                multiplier = (.54, .84, .93, 1, 1.1)[i]
                rotation = matrix.to_quaternion() @ Quaternion((1, 0, 0), -curl * turn * multiplier)
                self.point(name, matrix.translation, rotation)

    def bounds(self, floor_points):
        def z(name):
            if name.endswith("Tip"):
                main = name.removesuffix("Tip")
                return (self.world[main] @ Vector((0, self.bones[main].length, 0))).z
            return self.world[name].translation.z
        return min(z(name) for name in floor_points)

    def retarget(self, action_id, mode, frame, key):
        p, path, hip_drift, height = key
        self.world = {}
        root = self.rest["Root"].copy()
        if mode == "roll":
            root.translation = Vector((path.x * .30, path.y, 0)) * self.scale
        self.set("Root", root)
        left = p["LeftUpLeg"] - p["RightUpLeg"]
        pelvis_up = p["Chest"] - p["Hips"]
        if pelvis_up.length < .06:
            pelvis_up = p["UpperChest"] - p["Hips"]
        pelvis = body_basis(left, pelvis_up)
        shoulders = p["LeftArm"] - p["RightArm"]
        torso = body_basis(shoulders, p["Neck"] - p["Chest"])
        hips = self.base("Hips").translation
        if mode == "fall":
            hips.x += hip_drift.x * .75 * self.scale
            hips.y += hip_drift.y * .90 * self.scale
        elif mode == "getup":
            hips.x += hip_drift.x * .40 * self.scale
            hips.y += hip_drift.y * .40 * self.scale
        elif mode != "roll":
            hips.x += max(-.09, min(.09, hip_drift.x)) * self.scale
            hips.y += max(-.09, min(.09, hip_drift.y)) * self.scale
        self.point("Hips", hips, pelvis @ self.rest["Hips"].to_quaternion())
        for name, amount in (("Spine", .43), ("Chest", .72), ("UpperChest", 1)):
            self.point(name, self.base(name).translation, pelvis.slerp(torso, amount) @ self.rest[name].to_quaternion())
        neck_direction = p["Head"] - p["Neck"]
        self.aim("Neck", neck_direction, torso)
        head_direction = p["HeadTip"] - p["Head"]
        head_axis = neck_direction.normalized().lerp(head_direction.normalized(), .24)
        self.aim("Head", head_axis)
        curl = FINGERS.get(action_id, .17 + .54 * min(1, max(0, (frame - 7) / 3)))
        for side, _ in SIDES:
            for name, endpoint in (("Shoulder", "Arm"), ("Arm", "ForeArm"), ("ForeArm", "Hand")):
                guide = torso if name != "ForeArm" else None
                self.aim(side + name, p[side + endpoint] - p[side + name], guide)
            self.hand(p, side, torso, curl)
            for name, end in (("UpLeg", "Leg"), ("Leg", "Foot"), ("Foot", "Toes"), ("Toes", "ToesTip")):
                guide = pelvis if name in ("UpLeg", "Leg") else None
                self.aim(side + name, p[side + end] - p[side + name], guide)
        if mode in ("water_idle", "water_stroke"):
            vertical = (.67 if mode == "water_idle" else .79) * self.scale + hip_drift.z * self.scale - hips.z
        else:
            points = BODY_GROUND if mode in ("roll", "fall", "getup") else GROUND
            vertical = (.018 + height) * self.scale - self.bounds(points)
        shifted = self.world["Hips"].copy()
        shifted.translation.z += vertical
        self.point("Hips", shifted.translation, shifted.to_quaternion())
        return {
            name: (self.rig.pose.bones[name].location.copy(),
                   self.rig.pose.bones[name].rotation_quaternion.copy())
            for name in self.driven
        }


def blend_states(left, right, weight):
    return {name: (left[name][0].lerp(value[0], weight), left[name][1].slerp(value[1], weight))
            for name, value in right.items()}


def set_channels(rig, action, states):
    animation = rig.animation_data_create()
    animation.action = action
    rotations = {}
    for frame, state in states:
        for name, (loc, raw) in state.items():
            bone = rig.pose.bones[name]
            rotation = compliant(raw, rotations.get(name))
            rotations[name] = rotation
            bone.rotation_quaternion = rotation
            bone.keyframe_insert("rotation_quaternion", frame=frame, group=name)
            if name in ("Root", "Hips"):
                bone.location = loc
                bone.keyframe_insert("location", frame=frame, group=name)
    curves = action.layers[0].strips[0].channelbag(animation.action_slot).fcurves
    for curve in curves:
        for point in curve.keyframe_points:
            point.interpolation = "LINEAR"


def game_markers(scene, spec):
    for event in spec["events"]:
        scene.timeline_markers.new(event["id"], frame=event["frame"])


def output_range(scene, spec):
    scene.frame_start, scene.frame_end = 1, spec["expected_frames"]


def create_action(scene, pose, action_id, spec, profile, track, fallen, idle):
    keys, origin = track
    mode = origin["mode"]
    action = bpy.data.actions.new(action_id)
    action.asset_mark()
    action.use_fake_user = True
    action.asset_data.description = spec["description"]
    for tag in ("Shared humanoid", "Retargeted reference", "30 fps"):
        action.asset_data.tags.new(tag)
    action["profile"] = profile
    action["sample_rate"] = 30
    action["loop"] = spec["loop"]
    action["root_motion"] = spec["root_motion"]
    action["reference_provenance"] = json.dumps(origin)
    action.use_cyclic = spec["loop"]
    action.use_frame_range = True
    action.frame_start, action.frame_end = 1, spec["expected_frames"]
    output_range(scene, spec)
    game_markers(scene, spec)
    for item in spec["events"]:
        marker = action.pose_markers.new(item["id"])
        marker.frame = item["frame"]
    if mode in ("gait", "run"):
        for contact, side in zip(spec["events"], origin["footstep_sides"], strict=True):
            scene.timeline_markers.new(side + " stance", frame=contact["frame"])
    states = [(frame, pose.retarget(action_id, mode, frame, key)) for frame, key in keys]
    if action_id == "chr_block":
        for index in range(7):
            frame, state = states[-7 + index]
            blend = index / 6
            states[-7 + index] = frame, blend_states(state, idle, blend * blend * (3 - 2 * blend))
        scene.timeline_markers.new("Lower guard", frame=24)
    if mode == "getup":
        if fallen is None:
            raise ValueError("Get-up needs the matching knockdown endpoint")
        for i in range(7):
            blend = i / 7
            frame, state = states[i]
            states[i] = frame, blend_states(fallen, state, blend * blend * (3 - 2 * blend))
        scene.timeline_markers.new("Knockdown match", frame=1)
        scene.timeline_markers.new("Support transfer", frame=10)
    if spec["loop"]:
        states[-1] = states[-1][0], states[0][1]
    set_channels(pose.rig, action, states)
    scene.frame_set(spec["events"][0]["frame"] if spec["events"] else (spec["expected_frames"] + 1) // 2)
    return states[-1][1]


def append_existing(base, rig, library, catalog, profile):
    for library_id, status in (("authored_action_libraries", "authored"),
                               ("hybrid_action_libraries", "hybrid_authored")):
        path = library / catalog[library_id]["profiles"][profile]["path"]
        specs = {name: spec for name, spec in catalog["game_actions"].items() if spec["coverage_status"] == status}
        with bpy.data.libraries.load(str(path), link=False) as (available, selected):
            assert set(available.actions) == specs.keys(), (path, set(available.actions) ^ specs.keys())
            selected.actions = list(specs)
        for name, spec in specs.items():
            scene, subject = scene_setup(base, rig, name)
            output_range(scene, spec)
            game_markers(scene, spec)
            action = bpy.data.actions[name]
            subject.animation_data_create().action = action
            subject.animation_data.action_slot, = action.slots
            scene.frame_set(spec["events"][0]["frame"] if spec["events"] else 1)


def collect_events(markers):
    return Counter((marker.name, marker.frame) for marker in markers if marker.name.startswith("ev_"))


def endpoint(rig, name):
    bone = rig.pose.bones[name.removesuffix("Tip")]
    return bone.tail if name.endswith("Tip") else bone.head


def validate(path, specs, rest, profile, tracks):
    bpy.ops.wm.open_mainfile(filepath=str(path))
    assert set(specs) == set(s.name for s in bpy.data.scenes) == set(a.name for a in bpy.data.actions)
    report, frames_to_draw = {}, {}
    for name, spec in specs.items():
        scene = bpy.data.scenes[name]
        bpy.context.window.scene = scene
        rig, = scene.objects
        assert rig.type == "ARMATURE" and bone_segments(rig) == rest
        action = rig.animation_data.action
        assert action and rig.animation_data.action_slot and action.asset_data
        assert action.name == name and action["profile"] == profile and scene.render.fps == 30
        assert tuple(action.curve_frame_range) == (scene.frame_start, scene.frame_end) == (1, spec["expected_frames"])
        assert bool(action.use_cyclic) == spec["loop"]
        assert bool(action["root_motion"]) == spec["root_motion"]
        expected = Counter((m["id"], m["frame"]) for m in spec["events"])
        assert collect_events(action.pose_markers) == collect_events(scene.timeline_markers) == expected, name
        source = tracks[name][1] if name in tracks else None
        if source:
            assert json.loads(action["reference_provenance"]) == source
        mode = source["mode"] if source else None
        roots, quaternion, soles, contacts, signatures, hips = [], [], [], {}, [], []
        max_degrees, worst = 0., None
        previous = None
        for half in range(2 * spec["expected_frames"] - 1):
            frame = 1 + half / 2
            scene.frame_set(int(frame), subframe=frame % 1)
            subject = rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
            bones = subject.pose.bones
            values = tuple(v for bone in bones for row in bone.matrix for v in row)
            assert all(math.isfinite(x) for x in values)
            roots.append(bones["Root"].matrix.translation.copy())
            quaternion.append(bones["Root"].matrix.to_quaternion())
            signatures.append(values)
            hips.append(bones["Hips"].head.copy())
            rotations = {b.name: b.rotation_quaternion.copy() for b in bones if b.bone.use_deform}
            if previous:
                for bone, q in rotations.items():
                    angle = math.degrees(2 * math.acos(min(1., abs(q.normalized().dot(previous[bone].normalized())))))
                    if angle > max_degrees:
                        max_degrees, worst = angle, (frame, bone)
            previous = rotations
            if mode and not mode.startswith("water"):
                candidates = BODY_GROUND if mode in ("roll", "fall", "getup") else GROUND
                soles.append(min(endpoint(subject, k).z for k in candidates))
            if frame in (item["frame"] for item in spec["events"]) and mode in ("gait", "run"):
                contacts[int(frame)] = [min(endpoint(subject, side + key).z for key in ("Toes", "ToesTip"))
                                        for side, _ in SIDES]
        total_root = (roots[-1] - roots[0]).length
        root_travel = max((r - roots[0]).length for r in roots)
        if spec["root_motion"]:
            assert mode == "roll" and 1.3 < total_root < 2.6 and roots[-1].y < -1.2
            assert max(abs(r.z) for r in roots) < 1e-5
            assert min(b.y - a.y for a, b in zip(roots, roots[1:])) > -.24
            assert max(b.y - a.y for a, b in zip(roots, roots[1:])) < .04
        else:
            assert root_travel < 1e-6, (name, root_travel)
        assert all(abs(q.dot(quaternion[0])) > .99999 for q in quaternion)
        seam = max(abs(a - b) for a, b in zip(signatures[0], signatures[-1], strict=True))
        if spec["loop"]:
            assert seam < 1e-5, (name, seam)
        assert max(max(abs(a - b) for a, b in zip(row, signatures[0], strict=True)) for row in signatures) > .008
        roll_quarter_min = None
        if source:
            scale = float(rig["reference_height_metres"]) / 1.66
            assert max_degrees < 70, (name, worst, max_degrees)
            if soles:
                assert min(soles) > -.04 * scale, (name, min(soles))
            if contacts:
                for event, label in zip(spec["events"], source["footstep_sides"], strict=True):
                    side = 0 if label == "Left" else 1
                    both = contacts[event["frame"]]
                    assert both[side] < .09 * scale and both[side] <= both[1 - side] + .025 * scale, (name, event, both)
            if mode == "roll":
                floor_samples = []
                for quarter in range(1, 4 * (spec["expected_frames"] - 1), 2):
                    frame = 1 + quarter / 4
                    scene.frame_set(int(frame), subframe=frame % 1)
                    subject = rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
                    floor_samples.append(min(endpoint(subject, point).z for point in BODY_GROUND))
                roll_quarter_min = min(floor_samples)
                assert roll_quarter_min > -.028 * scale, (name, roll_quarter_min)
            if mode == "jump":
                assert max(soles) > .17 * scale and soles[-1] < .10 * scale, (name, max(soles), soles[-1])
            if mode == "fall":
                assert hips[0].z - hips[-1].z > .38 * scale, name
            if mode == "getup":
                assert hips[-1].z - hips[0].z > .38 * scale, name
            points = {1, spec["expected_frames"], *(event["frame"] for event in spec["events"])}
            points.update([max(2, spec["expected_frames"] // 3), max(3, spec["expected_frames"] * 2 // 3)])
            if mode == "roll":
                points.add(8)
            frames_to_draw[name] = {frame: capture(scene, rig, frame) for frame in sorted(points)}
        report[name] = {
            "frames": spec["expected_frames"], "fps": 30, "loop": spec["loop"],
            "root_motion": spec["root_motion"], "event_markers": sorted(collect_events(action.pose_markers).elements()),
            "root_displacement_m": round(total_root, 5), "max_pose_step_deg": round(max_degrees, 2),
            "max_pose_step_at": worst, "loop_pose_error": round(seam, 8) if spec["loop"] else None,
            "footstep_heights_m": {f: [round(x, 4) for x in values] for f, values in contacts.items()},
            "reference": source, "lowest_support_point_m": round(min(soles), 5) if soles else None,
            "highest_support_point_m": round(max(soles), 5) if soles else None,
            "roll_quarter_frame_lowest_point_m": round(roll_quarter_min, 5) if roll_quarter_min is not None else None,
        }
        if source:
            print("VERIFIED", profile, name, report[name], flush=True)
    fall = frames_to_draw["chr_knockdown"][30]
    getup = frames_to_draw["chr_getup"][1]
    assert max((Vector(fall[name]["head"]) - Vector(getup[name]["head"])).length for name in fall) < 2e-5
    return report, frames_to_draw


def build(library, output, catalog, profile, tracks):
    specs = catalog["game_actions"]
    base_template = library / catalog["rigs"][profile]["path"]
    bpy.ops.wm.open_mainfile(filepath=str(base_template))
    base = bpy.context.scene
    base.name = "Scene"
    rig = bpy.context.view_layer.objects.active
    rest = bone_segments(rig)
    fallen = idle = None
    for name, track in tracks.items():
        scene, subject = scene_setup(base, rig, name)
        pose = Transfer(subject)
        endpoint_state = create_action(scene, pose, name, specs[name], profile, track, fallen, idle)
        if name == "chr_idle":
            idle = endpoint_state
        if name == "chr_knockdown":
            fallen = endpoint_state
    append_existing(base, rig, library, catalog, profile)
    bpy.context.window.scene = bpy.data.scenes["chr_walk"]
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                view = area.spaces.active.region_3d
                view.view_location = (0, 0, .85)
                view.view_rotation = Vector((-.43, 1, -.13)).to_track_quat("-Z", "Y")
                view.view_distance = 2.75
                view.view_perspective = "ORTHO"
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
    validation, frames = validate(output, specs, rest, profile, tracks)
    # Use the same append path as a downstream Blender file for the newly retargeted tracks.
    verify_append(base_template, output, specs, sample_all(output, frames, specs))
    return validation, frames


def sample_all(library, new, specs):
    bpy.ops.wm.open_mainfile(filepath=str(library))
    poses = dict(new)
    for action_id in specs.keys() - poses.keys():
        scene = bpy.data.scenes[action_id]
        bpy.context.window.scene = scene
        rig, = scene.objects
        poses[action_id] = {frame: capture(scene, rig, frame) for frame in (1, scene.frame_end // 2, scene.frame_end)}
    return poses


def main():
    parser = ArgumentParser()
    parser.add_argument("library", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    library = args.library.resolve()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    catalog = json.loads((library / "catalog.json").read_text(encoding="utf-8"))
    want = {name for name, spec in catalog["game_actions"].items()
            if spec["coverage_status"] in ("reference", "retargeted")}
    assert want == CUTS.keys() and len(catalog["game_actions"]) == 50
    tracks = compile_tracks(library, catalog)
    report = {"blender": bpy.app.version_string, "sample_spacing_frames": .5,
              "append_validation": "50 Actions per profile appended onto untouched templates.", "profiles": {}}
    poses = {}
    for profile in ("female", "male"):
        destination = output / f"humanoid_{profile}_50_actions.blend"
        report["profiles"][profile], poses[profile] = build(library, destination, catalog, profile, tracks[profile])
    (output / "validation.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    (output / "preview_poses.json").write_text(json.dumps(poses) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

