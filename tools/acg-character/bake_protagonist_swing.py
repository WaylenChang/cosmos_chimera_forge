"""Bake world gravity and attachment inertia into the protagonists' existing actions.

Run Blender in background with --python-exit-code 1 --python this_file -- ASSET STAGE.
Use the current authored blend and matching published GLB as inputs.
"""
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Quaternion, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from refine_protagonist_motion import glb_json

PENDANTS = {"CubeLanyard": ("PuzzleCharm",), "CupHanger": ("FieldCup",),
            "Bead tether": ("Cobalt signal bead", "Glass bead bronze bezel")}
FREE = {"TiedHair", "Bow tail", "PackTassel", "SashTail", *PENDANTS}


def fit_cup_hanger():
    cup = bpy.data.objects.get("FieldCup")
    if cup is None:
        return
    hanger = bpy.data.objects["CupHanger"]
    crimp = bpy.data.objects["CupHanger ferrule"]
    anchor = min((crimp.matrix_world @ v.co).z for v in crimp.data.vertices)
    bottom = min((hanger.matrix_world @ v.co).z for v in hanger.data.vertices)
    offset = Vector((-.77, .64, 0)) * .035
    for obj in (cup, hanger):
        local = obj.matrix_world.to_3x3().inverted() @ offset
        for v in obj.data.vertices:
            depth = (anchor - (obj.matrix_world @ v.co).z) / (anchor-bottom)
            v.co += local * (1 if obj == cup else max(0.,min(1.,depth)))
        obj.data.update()


def attach(rig):
    parts = [(o, "Swing_" + o.name.replace(" ", "_")) for o in bpy.context.scene.objects
             if o.type == "MESH" and (o.name.startswith("HairLock") or o.name in FREE or o.name in {"Hair • fringe coils", "Hair • nape coils"} or o.name.startswith("Hair • hairline curls"))]
    specs = {}
    tips_by_root = {}
    end_bones = {}
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    for obj, name in parts:
        assert len(obj.vertex_groups) == 1 and obj.find_armature() == rig, obj.name
        parent = obj.vertex_groups[0].name
        transform = rig.matrix_world.inverted() @ obj.matrix_world
        points = [transform @ v.co for v in obj.data.vertices]
        low, high = min(p.z for p in points), max(p.z for p in points)
        band = (high-low)*.10
        roots = [p for p in points if p.z >= high-band]
        tips = [p for p in points if p.z <= low+band]
        bone = rig.data.edit_bones.new(name)
        bone.parent = rig.data.edit_bones[parent]
        bone.head = sum(roots, Vector()) / len(roots)
        bone.tail = sum(tips, Vector()) / len(tips)
        assert bone.length > .001 and bone.name == name
        weights = [min(1., max(0., (high-band-p.z)/(high-low-band))) for p in points]
        if bone.length > .10 and (obj.name.startswith("HairLock") or obj.name in {"PackTassel", "TiedHair", "SashTail"}):
            end = bone.tail.copy()
            bone.tail = bone.head.lerp(end, .56)
            tip = rig.data.edit_bones.new(name+"_Tip")
            tip.parent = bone
            tip.head, tip.tail = bone.tail, end
            tip.use_connect = True
            tips_by_root[name] = tip.name
        if obj.name == "CupHanger":
            cup = bpy.data.objects["FieldCup"]
            xf = rig.matrix_world.inverted() @ cup.matrix_world
            center = sum((xf @ v.co for v in cup.data.vertices), Vector()) / len(cup.data.vertices)
            joint = rig.data.edit_bones.new("Swing_CupPivot")
            joint.parent = bone
            joint.head = bone.tail
            joint.tail = center
            assert joint.length > .003
            end_bones[name] = joint.name
        specs[name] = parent, weights
    bpy.ops.object.mode_set(mode="OBJECT")
    for obj, name in parts:
        parent, weights = specs[name]
        group = obj.vertex_groups.new(name=name)
        tip = obj.vertex_groups.new(name=tips_by_root[name]) if name in tips_by_root else None
        for i, weight in enumerate(weights):
            obj.vertex_groups[parent].add([i], 1-weight, "REPLACE")
            distal = max(0., (weight-.5)*2) if tip else 0.
            group.add([i], weight-distal, "REPLACE")
            if distal:
                tip.add([i], distal, "REPLACE")
        for child in PENDANTS.get(obj.name, ()):
            end = bpy.data.objects[child]
            assert len(end.vertex_groups) == 1 and end.vertex_groups[0].name == parent
            end.vertex_groups[0].name = end_bones.get(name, name)
    return list(specs) + list(tips_by_root.values()) + list(end_bones.values()) + [b.name for b in rig.pose.bones if b.name.endswith(
        ("TrouserHem", "WaistHem", "SleeveFold", "SleeveFall", "SleeveDrop"))]


def coat(rig):
    panels = [o for o in bpy.context.scene.objects if o.name.startswith("Weathercoat")]
    if not panels:
        return []
    names = {}
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    for side in ("L", "R"):
        parent = rig.data.edit_bones["thigh."+side]
        bone = rig.data.edit_bones.new("Swing_Coat_"+side)
        bone.parent = parent
        bone.head = parent.head.lerp(parent.tail, .35)
        bone.tail = parent.tail
        names[parent.name] = bone.name
    bpy.ops.object.mode_set(mode="OBJECT")
    for obj in panels:
        for parent, name in names.items():
            origin = obj.vertex_groups.get(parent)
            if origin is None:
                continue
            group = obj.vertex_groups.new(name=name)
            pivot = rig.data.bones[name].head_local.z
            for v in obj.data.vertices:
                share = next((g.weight for g in v.groups if g.group == origin.index), 0)
                fraction = max(0., min(.85, (pivot-(obj.matrix_world @ v.co).z)/.20))
                if share and fraction:
                    origin.add([v.index], share*(1-fraction), "REPLACE")
                    group.add([v.index], share*fraction, "REPLACE")
    return list(names.values())


def response(name):
    """Natural frequency (rad/s), damping ratio, angular compliance and rotation cap."""
    if name.startswith("Swing_Hair_"):
        return 25., .95, .004, 5.
    if name == "Swing_CupPivot":
        return 12., .76, .011, 14.
    if name.endswith("_Tip"):
        return 10., .72, .008, 12.
    if "Hair" in name:
        return 16., .84, .009, 11.
    if "SleeveDrop" in name or "SleeveFall" in name:
        return 14., .84, .006, 9.
    if "Tassel" in name or name in {f"Swing_{s.replace(' ', '_')}" for s in PENDANTS}:
        return 10., .58, .021, 28.
    if name.startswith("Swing_"):
        return 13., .82, .012, 18.
    return 21., .9, .003, 5.


def face_shading():
    from mathutils.bvhtree import BVHTree
    head = bpy.data.objects["Head"]
    pigment = head.data.color_attributes["Facial pigment"]
    assert pigment.domain == "POINT"
    inv = head.matrix_world.inverted()
    blockers = [o for o in bpy.context.scene.objects if o.type == "MESH" and
                (o.name.startswith("HairLock") or o.name == "SailorCap")]
    points, polygons = [], []
    for obj in blockers:
        xf = inv @ obj.matrix_world
        offset = len(points)
        points.extend(xf @ v.co for v in obj.data.vertices)
        polygons.extend([offset+i for i in p.vertices] for p in obj.data.polygons)
    tree = BVHTree.FromPolygons(points, polygons)
    rays = [Vector((x,-.30,1)).normalized() for x in (-.55,-.28,0,.28,.55)]
    for v in head.data.vertices:
        hits = sum(tree.ray_cast(v.co + d*.001,d,.058)[0] is not None for d in rays)
        jaw = max(0., -v.normal.z)
        value = pigment.data[v.index]
        rgb = value.color[:3]
        value.color = (*[c*(1-.27*hits/len(rays)-.13*jaw) for c in rgb],1.)
    for mat in bpy.data.materials:
        if mat.name == "Skin - Head neutral" or mat.name.startswith(("HairLock","Hair nape")) or mat.name == "Hair":
            shader = mat.node_tree.nodes.get("Principled BSDF")
            shader.inputs["Emission Strength"].default_value *= .43


def field_layers():
    # Separate the long outer panels from the underlying tunic even when they share a swatch.
    tunic = bpy.data.objects["Sleeveless tunic"]
    shell = tunic.data.materials[0].copy()
    shell.name = "Weathercoat • slate canvas"
    shader = shell.node_tree.nodes.get("Principled BSDF")
    rgb = shader.inputs["Base Color"]
    if rgb.is_linked:
        raise ValueError("Inspect the authored canvas texture before changing its tint")
    r, g, b, a = rgb.default_value
    rgb.default_value = (min(1,r*1.24), min(1,g*1.32), min(1,b*1.42), a)
    shader.inputs["Roughness"].default_value = .68
    for o in bpy.context.scene.objects:
        if o.name.startswith(("Weathercoat • front","Weathercoat • rear")):
            o.data.materials[0] = shell
    trousers = bpy.data.objects["Cargo trousers"].data.materials[0]
    trousers.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = .93


def bake(rig, names, action):
    rig.animation_data.action = action
    scene = bpy.context.scene
    fps = scene.render.fps / scene.render.fps_base
    start, end = map(int, action.frame_range)
    frames = list(range(start, end+1))

    bag = action.layers[0].strips[0].channelbag(rig.animation_data.action_slot)
    history = {name: [] for name in names}
    for frame in frames:
        scene.frame_set(frame)
        for name in names:
            pb = rig.pose.bones[name]
            world = rig.matrix_world @ pb.matrix
            history[name].append((rig.matrix_world @ pb.tail, world.to_quaternion(),
                                  pb.rotation_quaternion.copy()))
    for name, samples in history.items():
        frequency, damping, gain, degrees = response(name)
        limit = math.radians(degrees)
        positions = np.array([tuple(s[0]) for s in samples])
        if len(frames) == 1:
            padded = np.repeat(positions, 3, axis=0)
        elif action.use_cyclic:
            # Include locomotion displacement across the seam.
            extra = positions[-1]-positions[0]
            padded = np.vstack((positions[-2]-extra, positions, positions[1]+extra))
        else:
            padded = np.vstack((2*positions[0]-positions[1], positions,
                                2*positions[-1]-positions[-2]))
        acceleration = np.diff(padded, n=2, axis=0)*fps**2
        targets = []
        for (_, orient, _), acc in zip(samples, acceleration):
            force = orient.inverted() @ (Vector((0,0,-9.81))-Vector(acc))
            tilt = Vector((force.z, 0, -force.x)) * gain
            if tilt.length > limit:
                tilt = tilt.normalized()*limit
            targets.append(tilt)
        swing, speed = targets[0].copy(), Vector()
        def step(target):
            nonlocal swing, speed
            steps = max(1, math.ceil(4*frequency/fps))
            dt = 1/(fps*steps)
            for _ in range(steps):
                speed += ((target-swing)*frequency**2-speed*(2*damping*frequency))*dt
                swing += speed*dt
        if action.use_cyclic and len(frames) > 1:
            for _ in range(max(2, math.ceil(fps/(len(frames)-1)))):
                for target in targets[1:]:
                    step(target)
        values = []
        for i, (_, _, base) in enumerate(samples):
            if i:
                step(targets[i])
            q = base @ (Quaternion(swing.normalized(), swing.length) if swing.length else Quaternion())
            if values:
                q.make_compatible(Quaternion(values[-1]))
            values.append(tuple(q))
        path = rig.pose.bones[name].path_from_id("rotation_quaternion")
        for axis in range(4):
            fc = bag.fcurves.find(path,index=axis) or bag.fcurves.new(path,index=axis)
            fc.keyframe_points.clear()
            fc.keyframe_points.add(len(frames))
            fc.keyframe_points.foreach_set("co", np.column_stack((frames,np.array(values)[:,axis])).astype("f").ravel())
            for k in fc.keyframe_points:
                k.interpolation = "LINEAR"
            fc.update()


def run(asset, stage):
    stem = asset.name + "_03b_blender"
    source = asset/"03b_blender"/(stem+".blend")
    reference = asset/(stem+".glb")
    if asset.name == "chr_quest_camp_beacon":
        folder = asset/"_03b_blender"
        source = folder/(asset.name+"_blend_03b_blender_v3.blend")
        reference = folder/(asset.name+"_model_03b_blender_v3.glb")
    stage.mkdir(exist_ok=True, parents=True)
    assert stage not in (asset, source.parent)
    bpy.ops.wm.open_mainfile(filepath=str(source))
    rig, = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    original, frame = rig.animation_data.action, bpy.context.scene.frame_current
    if bpy.data.objects.get("Head"):
        face_shading()
    else:
        field_layers()
    fit_cup_hanger()
    names = attach(rig) + coat(rig)
    actions = [a for a in bpy.data.actions if any(slot.identifier == "OB"+rig.name for slot in a.slots)]
    visible = {o.name for o in bpy.context.scene.objects if o.type=="MESH" and not o.hide_get()}
    for name in visible:
        bpy.data.objects[name].hide_set(True)
    for action in actions:
        # Unkeyed bones retain their previous pose when switching actions.
        for name in names:
            rig.pose.bones[name].rotation_quaternion.identity()
        parents = [n for n in names if n != "Swing_CupPivot"]
        bake(rig, parents, action)
        if "Swing_CupPivot" in names:
            bake(rig, ["Swing_CupPivot"], action)
    for name in visible:
        bpy.data.objects[name].hide_set(False)
    rig.animation_data.action = original
    bpy.context.scene.frame_set(frame)
    bpy.ops.wm.save_as_mainfile(filepath=str(stage/source.name), compress=True, relative_remap=False)
    bpy.ops.wm.open_mainfile(filepath=str(stage/source.name))
    previous = glb_json(reference)
    old = {n["name"] for n in previous["nodes"]}
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.name in old and not obj.hide_viewport:
            obj.select_set(True)
    output = stage/reference.name
    bpy.ops.export_scene.gltf(filepath=str(output), use_selection=True, export_animation_mode="ACTIONS",
        export_frame_range=False, export_force_sampling=True, export_morph_animation=False, export_extras=True)
    result = glb_json(output)
    nodes = [n["name"] for n in result["nodes"]]
    assert set(nodes) == old | set(names)
    assert {a["name"] for a in result["animations"]} == {a["name"] for a in previous["animations"]}
    for a in result["animations"]:
        animated = {nodes[c["target"]["node"]] for c in a["channels"] if c["target"]["path"]=="rotation"}
        assert set(names) <= animated, (a["name"],set(names)-animated)
    print("VERIFIED", asset.name, len(names), len(actions), flush=True)


if __name__ == "__main__":
    run(*(Path(s).resolve() for s in sys.argv[sys.argv.index("--")+1:]))
