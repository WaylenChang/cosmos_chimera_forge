"""Build and reopen the shared character action assets in Blender.

blender -b --python tools/acg-character/build_shared_character_actions.py -- LIBRARY OUT
LIBRARY contains catalog.json, rigs/, and the indexed motion sources.
Pass --hybrid to build the mocap-derived set. OUT receives both .blend files and validation.json.
"""

from argparse import ArgumentParser
from pathlib import Path
import json
import math
import sys

import bpy
from mathutils import Euler, Matrix, Quaternion, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from shared_action_poses import ACTIONS


SIDES = (("Left", 1), ("Right", -1))
DIGITS = ("Thumb", "Index", "Middle", "Ring", "Little")
GEOMETRY_BONES = (
    "Hips", "Spine", "Chest", "UpperChest", "Neck", "Head",
    *[side + part for side, _ in SIDES for part in
      ("Shoulder", "Arm", "ForeArm", "Hand", "UpLeg", "Leg", "Foot", "Toes", "Index2", "Index3")],
)
EPS = 1e-7


def lerp_tuple(a, b, weight):
    return tuple((1 - weight) * x + weight * y for x, y in zip(a, b, strict=True))


def orientation(direction, top):
    """Orient local +Y along the bone and preserve the spin given by local +Z."""
    y = Vector(direction).normalized()
    x = y.cross(Vector(top)).normalized()
    if x.length < EPS:
        raise ValueError(f"Parallel orientation axes: {direction}, {top}")
    z = x.cross(y)
    return Matrix((x, y, z)).transposed().to_quaternion()


def sample(sequence, frame):
    for (first, a), (last, b) in zip(sequence.poses, sequence.poses[1:]):
        if first <= frame <= last:
            fraction = (frame - first) / (last - first)
            weight = fraction * fraction * (3 - 2 * fraction)
            break
    else:
        raise ValueError(f"Frame {frame} outside the pose sequence")

    def hand_target(early, late):
        first_rot = orientation(early.fingers, early.dorsal)
        last_rot = orientation(late.fingers, late.dorsal)
        return (
            Vector(lerp_tuple(early.wrist, late.wrist, weight)),
            first_rot.slerp(last_rot, weight),
            lerp_tuple(early.curl, late.curl, weight),
        )

    return (
        Vector(lerp_tuple(a.hip, b.hip, weight)),
        Vector(lerp_tuple(a.body, b.body, weight)),
        Vector(lerp_tuple(a.gaze, b.gaze, weight)),
        hand_target(a.left, b.left),
        hand_target(a.right, b.right),
    )


def two_bone(origin, target, pole, upper, lower):
    """Place the elbow/knee in the bend plane, clamping only at anatomical extension."""
    axis = target - origin
    distance = axis.length
    axis.normalize()
    direction = Vector(pole) - axis * axis.dot(Vector(pole))
    if direction.length < EPS:
        raise ValueError("Limb goal lies on the pole axis")
    direction.normalize()
    length = min(upper + lower - .004, max(abs(upper - lower) + .004, distance))
    along = (upper ** 2 - lower ** 2 + length ** 2) / (2 * length)
    amplitude = math.sqrt(max(0, upper ** 2 - along ** 2))
    joint = origin + axis * along + direction * amplitude
    end = origin + axis * length
    return joint, end, direction.cross(axis), abs(distance - length)


class SkeletonPose:
    def __init__(self, rig, scale):
        self.rig = rig
        self.scale = scale
        self.bones = rig.data.bones
        self.rest = {bone.name: bone.matrix_local.copy() for bone in self.bones}
        self.relative = {
            bone.name: (self.rest[bone.parent.name].inverted() @ self.rest[bone.name]
                        if bone.parent else self.rest[bone.name])
            for bone in self.bones
        }
        self.world = {}

    def base(self, name):
        bone = self.bones[name]
        if bone.parent:
            return self.world[bone.parent.name] @ self.relative[name]
        return self.relative[name].copy()

    def set(self, name, matrix):
        self.world[name] = matrix
        bone = self.bones[name]
        opts = {}
        if bone.parent:
            opts = {"parent_matrix": self.world[bone.parent.name],
                    "parent_matrix_local": self.rest[bone.parent.name]}
        basis = bone.convert_local_to_pose(matrix, self.rest[name], invert=True, **opts)
        loc, rotation, _ = basis.decompose()
        bone_pose = self.rig.pose.bones[name]
        rotation.make_compatible(bone_pose.rotation_quaternion)
        bone_pose.location = loc if name == "Hips" else (0., 0., 0.)
        bone_pose.rotation_quaternion = rotation

    def turn(self, name, degrees, shift=None):
        base = self.base(name)
        rotation = Euler(tuple(math.radians(value) for value in degrees), "XYZ").to_matrix()
        out = (rotation @ base.to_3x3()).to_4x4()
        out.translation = base.translation
        if shift is not None:
            out.translation += shift
        self.set(name, out)

    def point(self, name, head, rotation):
        matrix = rotation.to_matrix().to_4x4()
        matrix.translation = head
        self.set(name, matrix)

    def hand(self, side, sign, intent):
        target, hand_rot, curls = intent
        upper = side + "Arm"
        lower = side + "ForeArm"
        hand = side + "Hand"
        root = self.base(upper).translation
        elbow, wrist, plane, err = two_bone(
            root, target * self.scale, (sign * .75, .38, -.69),
            self.bones[upper].length, self.bones[lower].length,
        )
        limb_top = plane * sign
        self.point(upper, root, orientation(elbow - root, limb_top))
        self.point(lower, elbow, orientation(wrist - elbow, limb_top))
        self.point(hand, wrist, hand_rot)
        for digit, curl in zip(DIGITS, curls, strict=True):
            for segment, bend in enumerate((.68, 1.0, .76), 1):
                name = f"{side}{digit}{segment}"
                base = self.base(name)
                relief = .62 if digit == "Thumb" else 1.0
                self.point(name, base.translation, base.to_quaternion() @
                           Quaternion((1, 0, 0), -curl * bend * relief))
        return err

    def foot_target(self, side, sign, sequence):
        ankle = self.rest[side + "Foot"].translation.copy()
        if sequence.airborne:
            return Vector((sign * .137, .365 if sign > 0 else .47, .481 if sign > 0 else .545)) * self.scale
        if sequence.seated:
            return Vector((sign * .280, -.103, .337)) * self.scale
        ankle.x = sign * .117 * self.scale
        ankle.y = (-.073 if sign > 0 else .045) * self.scale
        return ankle

    def leg(self, side, sign, sequence):
        upper, lower, foot = (side + suffix for suffix in ("UpLeg", "Leg", "Foot"))
        origin = self.base(upper).translation
        target = self.foot_target(side, sign, sequence)
        knee, ankle, lateral, error = two_bone(
            origin, target, (sign * (.27 if sequence.seated else .08), -1, 0),
            self.bones[upper].length, self.bones[lower].length,
        )
        self.point(upper, origin, orientation(knee - origin, lateral.cross(knee - origin)))
        self.point(lower, knee, orientation(ankle - knee, lateral.cross(ankle - knee)))
        foot_rotation = self.rest[foot].to_quaternion()
        if sequence.airborne:
            foot_rotation = Quaternion((1, 0, 0), math.radians(19)) @ foot_rotation
        elif sequence.seated:
            foot_rotation = Quaternion((0, 0, 1), sign * math.radians(13)) @ foot_rotation
        self.point(foot, ankle, foot_rotation)
        toe = side + "Toes"
        self.set(toe, self.base(toe))
        return error

    def apply(self, sequence, frame, source_delta=None):
        hip_shift, body, gaze, left, right = sample(sequence, frame)
        if source_delta is not None:
            hip, turn, left_wrist, right_wrist = source_delta
            hip_shift += hip
            body += turn
            left = (left[0] + left_wrist, *left[1:])
            right = (right[0] + right_wrist, *right[1:])
        self.world = {}
        self.set("Root", self.base("Root"))
        self.turn("Hips", body * .24, hip_shift * self.scale)
        for name, portion in (("Spine", .30), ("Chest", .24), ("UpperChest", .22)):
            self.turn(name, body * portion)
        self.turn("Neck", gaze * .38)
        self.turn("Head", gaze * .62)
        hand_errors = []
        foot_errors = []
        for (side, sign), hand in zip(SIDES, (left, right), strict=True):
            shoulder = side + "Shoulder"
            lift = max(0., hand[0].z - 1.25) * 12
            self.turn(shoulder, (0., -sign * lift, 0.))
            hand_errors.append(self.hand(side, sign, hand))
            foot_errors.append(self.leg(side, sign, sequence))
        return max(hand_errors), max(foot_errors)


def capture(scene, rig, frame):
    scene.frame_set(frame)
    evaluated = rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
    return {name: {"head": list(evaluated.pose.bones[name].head), "tail": list(evaluated.pose.bones[name].tail)}
            for name in GEOMETRY_BONES}


def scene_setup(template, source, action_id):
    if template.name == "Scene":
        scene = template
        rig = source
        scene.name = action_id
    else:
        scene = bpy.data.scenes.new(action_id)
        rig = source.copy()
        scene.collection.objects.link(rig)
    bpy.context.window.scene = scene
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    rig.name = action_id + "_rig"
    rig.animation_data_clear()
    for bone in rig.pose.bones:
        bone.rotation_mode = "QUATERNION"
        bone.matrix_basis = Matrix.Identity(4)
    scene.unit_settings.system = "METRIC"
    scene.render.fps = 30
    scene.render.fps_base = 1.0
    return scene, rig


def verify_motion_spec(catalog, sequences=ACTIONS, hybrid=False):
    specs = catalog["game_actions"]
    statuses = ("partial", "hybrid_authored") if hybrid else ("custom", "authored")
    expected = {action for action, spec in specs.items() if spec["coverage_status"] in statuses}
    if set(sequences) != expected:
        raise ValueError(f"Motion plans and catalog differ: {set(sequences) ^ expected}")
    for action_id, sequence in sequences.items():
        spec = specs[action_id]
        key_frames = [frame for frame, _ in sequence.poses]
        assert key_frames[0] == 1 and key_frames[-1] == spec["expected_frames"], action_id
        assert all(right > left for left, right in zip(key_frames, key_frames[1:])), action_id
        assert not spec["root_motion"], action_id
        assert all(event["frame"] in key_frames for event in spec["events"]), action_id
    return {name: specs[name] for name in sequences}


def make_action(rig, scene, action_id, sequence, spec, profile, scale, layer=None):
    action = bpy.data.actions.new(action_id)
    action.use_fake_user = True
    action.asset_mark()
    action.asset_data.description = spec["description"]
    action.asset_data.tags.new("Shared humanoid")
    action.asset_data.tags.new("30 fps")
    action["profile"] = profile
    action["loop"] = spec["loop"]
    action["root_motion"] = spec["root_motion"]
    action["sample_rate"] = 30
    if layer:
        action.asset_data.tags.new("Mocap + authored")
        action["mocap_provenance"] = json.dumps(layer["source"])
    for event in spec["events"]:
        marker = action.pose_markers.new(event["id"])
        marker.frame = event["frame"]
        scene.timeline_markers.new(event["id"], frame=event["frame"])
    for frame, label in sequence.beats:
        scene.timeline_markers.new(label, frame=frame)
    rig.animation_data_create().action = action
    scene.frame_start = 1
    scene.frame_end = spec["expected_frames"]
    action.use_frame_range = True
    action.frame_start, action.frame_end = 1, spec["expected_frames"]
    action.use_cyclic = spec["loop"]
    pose = SkeletonPose(rig, scale)
    bone_names = [bone.name for bone in rig.data.bones if bone.use_deform or bone.name == "Root"]
    hand_clamp, foot_clamp = 0, 0
    wrist_clamp_frame = None
    for frame in range(1, spec["expected_frames"] + 1):
        source_delta = layer["samples"].get(frame) if layer else None
        if source_delta is not None and spec["events"]:
            proximity = min(abs(frame - event["frame"]) for event in spec["events"])
            source_delta = tuple(delta * min(1, proximity / 3) for delta in source_delta)
        current_hand, current_foot = pose.apply(sequence, frame, source_delta)
        if current_hand > hand_clamp:
            wrist_clamp_frame = frame
        hand_clamp = max(hand_clamp, current_hand)
        foot_clamp = max(foot_clamp, current_foot)
        for name in bone_names:
            bone = rig.pose.bones[name]
            bone.keyframe_insert("rotation_quaternion", frame=frame, group=name)
        for name in ("Root", "Hips"):
            rig.pose.bones[name].keyframe_insert("location", frame=frame, group=name)
    slot = rig.animation_data.action_slot
    curves = action.layers[0].strips[0].channelbag(slot).fcurves
    for curve in curves:
        for key in curve.keyframe_points:
            key.interpolation = "LINEAR"
    scene.frame_set(spec["events"][0]["frame"] if spec["events"] else sequence.beats[1][0])
    return {"largest_wrist_clamp_m": round(hand_clamp, 5), "largest_ankle_clamp_m": round(foot_clamp, 5),
            "largest_wrist_clamp_frame": wrist_clamp_frame}


def bone_segments(rig):
    return {b.name: (tuple(b.head_local), tuple(b.tail_local), b.parent.name if b.parent else None)
            for b in rig.data.bones}


def point_segment_distance(point, a, b):
    direction = b - a
    ratio = (point - a).dot(direction) / direction.length_squared
    return (point - a - direction * max(0, min(1, ratio))).length


def verify_contact_poses(action_id, poses, scale):
    def head(frame, name):
        return Vector(poses[frame][name]["head"])

    if action_id == "chr_pet_xs":
        for frame in (27, 30):
            palm = head(frame, "LeftHand").lerp(Vector(poses[frame]["LeftHand"]["tail"]), .65)
            index_tip = Vector(poses[frame]["RightIndex3"]["tail"])
            offset = (index_tip - palm) / scale
            assert math.hypot(offset.x, offset.y) < .05 and .02 < offset.z < .105, (action_id, frame, offset)
    elif action_id == "chr_handbook_open":
        left_wrist = head(1, "LeftHand")
        assert all((head(f, "LeftHand") - left_wrist).length < .002 for f in poses)
        assert head(30, "RightHand").x - head(14, "RightHand").x > .22 * scale
    elif action_id == "chr_command_attack":
        assert head(6, "RightHand").y - head(10, "RightHand").y > .18 * scale
    elif action_id == "chr_revive_ally":
        for side, _ in SIDES:
            assert head(18, side + "Hand").z - head(28, side + "Hand").z > .045 * scale
            assert head(18, side + "Hand").y - head(28, side + "Hand").y > .06 * scale
    elif action_id == "chr_pet_xl":
        separation = head(36, "LeftHand").x - head(36, "RightHand").x
        assert .4 * scale < separation < .65 * scale
    elif action_id in ("chr_field_deploy", "chr_trap_place"):
        event, lower, clear = (30, 20, 36) if action_id == "chr_field_deploy" else (22, 15, 28)
        for side, _ in SIDES:
            name = side + "Hand"
            assert head(event, name).z < head(lower, name).z - .10 * scale
            assert head(clear, name).z > head(event, name).z + .04 * scale
    elif action_id in ("chr_throw_card", "chr_throw_bead", "chr_throw_cube", "chr_fish_cast"):
        start, event = {
            "chr_throw_card": (8, 12), "chr_throw_bead": (10, 15),
            "chr_throw_cube": (14, 18), "chr_fish_cast": (12, 16),
        }[action_id]
        assert head(start, "RightHand").y - head(event, "RightHand").y > .11 * scale
    elif action_id == "chr_item_use_other":
        assert (head(16, "RightHand") - head(20, "RightHand")).length < .002
        # Wrist position is held while the fingers open on the release.
        wrist_to_tip = [
            (Vector(poses[f]["RightIndex3"]["tail"]) - head(f, "RightHand")).length for f in (16, 20)
        ]
        assert wrist_to_tip[1] - wrist_to_tip[0] > .005 * scale
    elif action_id == "chr_mine_pick":
        for side, _ in SIDES:
            name = side + "Hand"
            assert head(10, name).z - head(16, name).z > .28 * scale
            assert head(20, name).z >= head(16, name).z
    elif action_id == "chr_craft_forge":
        assert head(11, "RightHand").z - head(18, "RightHand").z > .28 * scale
        assert all((head(f, "LeftHand") - head(1, "LeftHand")).length < .002 for f in poses)
    elif action_id in ("chr_pet_s", "chr_pet_m"):
        assert head(23, "RightHand").y - head(30, "RightHand").y > .024 * scale
        assert head(30, "RightHand").z < head(12, "RightHand").z - .08 * scale



def verify_append(template, source, specs, previews):
    bpy.ops.wm.open_mainfile(filepath=str(template))
    scene = bpy.context.scene
    rig = bpy.context.view_layer.objects.active
    with bpy.data.libraries.load(str(source), link=False) as (available, selected):
        assert set(available.actions) == set(specs)
        selected.actions = list(specs)
    animation = rig.animation_data_create()
    for bone in rig.pose.bones:
        bone.rotation_mode = "QUATERNION"
    for name in specs:
        action = bpy.data.actions[name]
        animation.action = action
        animation.action_slot, = action.slots
        for frame, expected in previews[name].items():
            actual = capture(scene, rig, frame)
            for bone in expected:
                for endpoint in ("head", "tail"):
                    error = (Vector(actual[bone][endpoint]) - Vector(expected[bone][endpoint])).length
                    assert error < 2e-5, (name, frame, bone, endpoint, error)
    print(f"APPEND VERIFIED {len(specs)} Actions from {source.name}", flush=True)




def validate(path, spec_by_id, expected_rig, profile, fit, sequences, layers):
    bpy.ops.wm.open_mainfile(filepath=str(path))
    assert set(s.name for s in bpy.data.scenes) == set(spec_by_id)
    assert set(a.name for a in bpy.data.actions) == set(spec_by_id)
    report = {}
    previews = {}
    for action_id, spec in spec_by_id.items():
        scene = bpy.data.scenes[action_id]
        bpy.context.window.scene = scene
        rig, = scene.objects
        assert rig.type == "ARMATURE" and bone_segments(rig) == expected_rig
        assert scene.render.fps == 30 and scene.render.fps_base == 1
        action = rig.animation_data.action
        assert action and action.name == action_id and action.asset_data
        assert bool(action.use_cyclic) == spec["loop"]
        assert bool(action["root_motion"]) == spec["root_motion"]
        assert action["profile"] == profile
        if action_id in layers:
            assert json.loads(action["mocap_provenance"]) == layers[action_id]["source"]
        assert (scene.frame_start, scene.frame_end) == tuple(action.curve_frame_range) == (
            1, spec["expected_frames"],
        )
        markers = {marker.name: marker.frame for marker in action.pose_markers}
        assert markers == {event["id"]: event["frame"] for event in spec["events"]}, action_id
        for event, frame in markers.items():
            assert scene.timeline_markers[event].frame == frame
        clip_samples = []
        hands = []
        ankles = []
        roots = []
        min_hand_clearance = float("inf")
        max_delta_angle = 0.0
        max_delta_at = None
        bone_rotations = None
        bounds = []
        for frame in [1 + half / 2 for half in range((spec["expected_frames"] - 1) * 2 + 1)]:
            base = math.floor(frame)
            scene.frame_set(base, subframe=frame - base)
            evaluated = rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
            bones = evaluated.pose.bones
            values = tuple(v for bone in bones for row in bone.matrix for v in row)
            assert all(math.isfinite(v) for v in values)
            for name, (_, _, _) in expected_rig.items():
                assert abs(bones[name].length - rig.data.bones[name].length) < 1e-4, (action_id, frame, name)
            roots.append(bones["Root"].matrix.copy())
            hands.append(tuple(bones[side + "Hand"].head.copy() for side, _ in SIDES))
            ankles.append(tuple(bones[side + "Foot"].head.copy() for side, _ in SIDES))
            clip_samples.append(values)
            rotations = {bone.name: bone.rotation_quaternion.copy() for bone in bones if bone.bone.use_deform}
            if bone_rotations:
                for name, b in rotations.items():
                    a = bone_rotations[name]
                    # q and -q represent the same orientation.
                    angle = 2 * math.acos(min(1, abs(a.dot(b))))
                    if math.degrees(angle) > max_delta_angle:
                        max_delta_angle = math.degrees(angle)
                        max_delta_at = (frame, name)
            bone_rotations = rotations
            for wrist in hands[-1]:
                for spine in ("Hips", "Spine", "Chest", "UpperChest"):
                    bone = bones[spine]
                    min_hand_clearance = min(min_hand_clearance,
                                             point_segment_distance(wrist, bone.head, bone.tail))
            bounds.append(min(bones[side + "Toes"].tail.z for side, _ in SIDES))
        scale = float(rig["reference_height_metres"]) / 1.66
        chosen = sequences[action_id]
        root_delta = max((matrix.translation - roots[0].translation).length for matrix in roots)
        assert root_delta < 1e-6
        assert all(abs(matrix.to_quaternion().dot(roots[0].to_quaternion())) > .999999
                   for matrix in roots), action_id
        foot_slide = max((point - ankles[0][side]).length for points in ankles for side, point in enumerate(points))
        assert foot_slide < .012 * scale, (action_id, "ankle drift", foot_slide)
        floor_clearance = .20 if chosen.airborne else .005
        assert min(bounds) >= floor_clearance, (action_id, "toe below reference height", min(bounds))
        assert min_hand_clearance > .103 * scale, (action_id, "wrist enters torso core", min_hand_clearance)
        hand_range = max((point - hands[0][side]).length for points in hands for side, point in enumerate(points))
        min_wrist_travel = min(.031, chosen.min_wrist_travel) if chosen.seated else chosen.min_wrist_travel
        assert hand_range > min_wrist_travel * scale, (action_id, "motion range", hand_range)
        assert max_delta_angle < 28, (action_id, "rotation jump per half frame", max_delta_at, max_delta_angle)
        loop_error = max(abs(a - b) for a, b in zip(clip_samples[0], clip_samples[-1], strict=True))
        if spec["loop"]:
            assert loop_error < 1e-5, (action_id, "loop seam", loop_error)
        frames = sorted(set([1, spec["expected_frames"], *(f for f, _ in chosen.beats),
                             *(event["frame"] for event in spec["events"])]))
        previews[action_id] = {frame: capture(scene, rig, frame) for frame in frames}
        verify_contact_poses(action_id, previews[action_id], scale)
        report[action_id] = {
            "frames": spec["expected_frames"],
            "fps": 30,
            "loop": spec["loop"],
            "root_motion": spec["root_motion"],
            "event_markers": markers,
            "support": ("airborne_reference" if chosen.airborne else
                        "stirrup_reference" if chosen.seated else "fixed_floor_stance"),
            "largest_ankle_drift_m": round(foot_slide, 5),
            "largest_root_displacement_m": round(root_delta, 7),
            "minimum_wrist_to_torso_axis_m": round(min_hand_clearance, 5),
            "largest_rotation_step_per_half_frame_deg": round(max_delta_angle, 2),
            "largest_rotation_step_location": max_delta_at,
            "loop_pose_error": round(loop_error, 7) if spec["loop"] else None,
            **fit[action_id],
        }
        if action_id in layers:
            report[action_id]["mocap_source"] = layers[action_id]["source"]
        assert fit[action_id]["largest_wrist_clamp_m"] <= .024 * scale, (action_id, fit[action_id])
        assert fit[action_id]["largest_ankle_clamp_m"] <= .008 * scale, (action_id, fit[action_id])
        print(f"VERIFIED {profile} {action_id} {report[action_id]}", flush=True)
    return report, previews


def build(template_path, output, profile, specs, sequences, layers):
    bpy.ops.wm.open_mainfile(filepath=str(template_path))
    base = bpy.context.scene
    rig = bpy.context.view_layer.objects.active
    base.name = "Scene"
    expected_rig = bone_segments(rig)
    scale = float(rig["reference_height_metres"]) / 1.66
    fit = {}
    for action_id, sequence in sequences.items():
        scene, subject = scene_setup(base, rig, action_id)
        fit[action_id] = make_action(subject, scene, action_id, sequence, specs[action_id], profile, scale,
                                     layers.get(action_id))
        print(f"BUILT {profile} {action_id} {fit[action_id]}", flush=True)
    preview_action = "chr_command_point" if layers else "chr_command_attack"
    bpy.context.window.scene = bpy.data.scenes[preview_action]
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type != "VIEW_3D":
                continue
            area.spaces.active.region_3d.view_location = (0, 0, .86 * scale)
            area.spaces.active.region_3d.view_rotation = Vector((-.43, 1, -.13)).to_track_quat("-Z", "Y")
            area.spaces.active.region_3d.view_distance = 2.75 * scale
            area.spaces.active.region_3d.view_perspective = "ORTHO"
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
    report, previews = validate(output, specs, expected_rig, profile, fit, sequences, layers)
    verify_append(template_path, output, specs, previews)
    return report, previews


def main():
    parser = ArgumentParser()
    parser.add_argument("library", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--hybrid", action="store_true", help="Build the mocap-derived action set.")
    params = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    library = params.library.resolve()
    output = params.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    catalog = json.loads((library / "catalog.json").read_text(encoding="utf-8"))
    sequences, layers = ACTIONS, {}
    if params.hybrid:
        from shared_hybrid_poses import ACTIONS as hybrid_sequences
        from retarget_shared_motion import compile_references

        sequences = hybrid_sequences
        layers = compile_references(library, catalog)
        assert all(set(actions) == set(sequences) for actions in layers.values())
    specs = verify_motion_spec(catalog, sequences, params.hybrid)
    report = {"blender": bpy.app.version_string, "profiles": {}, "visual_bones": list(GEOMETRY_BONES)}
    previews = {}
    for profile in ("female", "male"):
        template = library / "rigs" / f"humanoid_{profile}_t_pose.blend"
        suffix = "hybrid" if params.hybrid else "shared"
        blend = output / f"humanoid_{profile}_{suffix}_actions.blend"
        report["profiles"][profile], previews[profile] = build(
            template, blend, profile, specs, sequences, layers.get(profile, {}),
        )
    report["sample_spacing_frames"] = .5
    report["append_validation"] = "Appended each Action to its untouched template and compared sampled bone endpoints."
    (output / "validation.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    (output / "preview_poses.json").write_text(json.dumps(previews) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

