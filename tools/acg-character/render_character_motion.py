"""Blender background worker for character_motion_gif.py."""

from collections import defaultdict
import json
import math
from pathlib import Path
import sys

import bpy
from bpy_extras.anim_utils import action_get_channelbag_for_slot
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from character_motion_gif import choose_clips


def clip_bindings(targets, find_unassigned):
    bindings = defaultdict(dict)
    for target in targets:
        data = target.animation_data
        if not data:
            continue
        # Importers often leave the first clip active as well as on an NLA strip.
        entries = [(strip.action, strip.action_slot)
                   for track in data.nla_tracks
                   for strip in track.strips if strip.action]
        entries.append((data.action, data.action_slot))
        for action, slot in entries:
            if action and slot:
                bindings[action][target] = slot
        data.use_nla = False
        data.action = None

    if find_unassigned:
        rigs = [obj for obj in targets if isinstance(obj, bpy.types.Object) and obj.type == "ARMATURE"]
        for action in bpy.data.actions:
            for slot in action.slots:
                if slot in bindings.get(action, {}).values() or slot.target_id_type != "OBJECT":
                    continue
                bag = action_get_channelbag_for_slot(action, slot)
                paths = {curve.data_path for curve in bag.fcurves} if bag else set()
                matches = []
                for rig in rigs:
                    if rig in bindings.get(action, {}):
                        continue
                    if not any(path.startswith("pose.bones[") for path in paths):
                        continue
                    try:
                        for path in paths:
                            rig.path_resolve(path)
                    except ValueError:
                        continue
                    matches.append(rig)
                named = [rig for rig in matches if slot.identifier == "OB" + rig.name]
                if len(named or matches) == 1:
                    bindings[action][(named or matches)[0]] = slot
    return bindings


def set_clip(bindings, action, transforms, poses, shapes):
    for target, matrix in transforms.items():
        if target.animation_data:
            target.animation_data.action = None
        target.matrix_basis = matrix
    for bone, matrix in poses.items():
        bone.matrix_basis = matrix
    for target, values in shapes.items():
        if target.animation_data:
            target.animation_data.action = None
        for key, value in zip(target.key_blocks, values):
            key.value = value
    for target, slot in bindings[action].items():
        data = target.animation_data_create()
        data.action = action
        data.action_slot = slot
    bpy.context.view_layer.update()


def configure_scene(scene, size, yaw):
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = 8
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.pixel_aspect_x = scene.render.pixel_aspect_y = 1
    scene.render.film_transparent = True
    scene.render.use_sequencer = scene.render.use_compositing = False
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1

    view = Vector((-math.sin(yaw), -math.cos(yaw), 0.12)).normalized()
    rotation = (-view).to_track_quat("-Z", "Y")
    camera = bpy.data.objects.new("Motion preview camera", bpy.data.cameras.new("Motion preview"))
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera.rotation_euler = rotation.to_euler()
    camera.data.type = "ORTHO"
    for direction, energy in ((view + Vector((0.4, 0, 0.7)), 2.1),
                              (view + Vector((-0.8, 0, 0.25)), 0.8),
                              (-view + Vector((0, 0, 1)), 0.8)):
        sun = bpy.data.lights.new("Motion preview light", "SUN")
        sun.energy = energy
        light = bpy.data.objects.new(sun.name, sun)
        scene.collection.objects.link(light)
        light.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    return camera, rotation


def set_frame(scene, frame):
    base = math.floor(frame)
    scene.frame_set(base, subframe=frame - base)


def projected_bounds(scene, meshes, frames, inverse):
    low = Vector((math.inf,) * 3)
    high = Vector((-math.inf,) * 3)
    for frame in frames:
        set_frame(scene, frame)
        graph = bpy.context.evaluated_depsgraph_get()
        for obj in meshes:
            evaluated = obj.evaluated_get(graph)
            for corner in evaluated.bound_box:
                point = inverse @ (evaluated.matrix_world @ Vector(corner))
                low = Vector(map(min, low, point))
                high = Vector(map(max, high, point))
    return low, high


def render_objects(layer_collection):
    if layer_collection.exclude or layer_collection.collection.hide_render:
        return set()
    objects = {obj for obj in layer_collection.collection.objects if not obj.hide_render}
    for child in layer_collection.children:
        objects.update(render_objects(child))
    return objects


def run(source, directory, size, preview_fps, yaw):
    is_blend = source.suffix.lower() == ".blend"
    if is_blend:
        bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False)
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.context.scene.render.fps = 30
        bpy.ops.import_scene.gltf(filepath=str(source))
    scene = bpy.context.scene
    objects = list(bpy.context.view_layer.objects)
    visible = render_objects(bpy.context.view_layer.layer_collection)
    meshes = [obj for obj in objects if obj.type == "MESH" and obj in visible]
    if not meshes:
        raise ValueError("No rendered mesh found in the active scene and view layer.")
    source_fps = scene.render.fps / scene.render.fps_base
    for obj in objects:
        if obj.type == "LIGHT":
            obj.hide_render = True
    transforms = {obj: obj.matrix_basis.copy() for obj in objects}
    poses = {bone: bone.matrix_basis.copy() for obj in objects if obj.type == "ARMATURE"
             for bone in obj.pose.bones}
    shapes = {obj.data.shape_keys: [key.value for key in obj.data.shape_keys.key_blocks]
              for obj in objects if obj.type == "MESH" and obj.data.shape_keys}
    bindings = clip_bindings([*objects, *shapes], find_unassigned=is_blend)
    actions = {action.name: action for action in bindings}
    selected = choose_clips({name: action.frame_range[1] > action.frame_range[0] + 1
                             for name, action in actions.items()})
    camera, rotation = configure_scene(scene, size, math.radians(yaw))
    clips = {}
    for clip_id, name in enumerate(dict.fromkeys(name for name, _ in selected)):
        action = actions[name]
        start, end = action.frame_range
        count = max(2, math.ceil((end - start) * preview_fps / source_fps) + 1)
        frames = [min(end, start + i * source_fps / preview_fps) for i in range(count)]
        set_clip(bindings, action, transforms, poses, shapes)
        low, high = projected_bounds(scene, meshes, frames, rotation.inverted())
        scale = max(high.x - low.x, high.y - low.y)
        if not math.isfinite(scale) or scale <= 0:
            raise ValueError(f"Unable to frame the character meshes for {name}.")
        camera.data.ortho_scale = scale * 1.12
        center, depth = (low + high) * 0.5, high.z - low.z
        # Start the render pass from the same baseline as the framing pass.
        set_clip(bindings, action, transforms, poses, shapes)
        distance = max(scale * 2, depth)
        camera.location = rotation @ (center + Vector((0, 0, distance)))
        camera.data.clip_start = distance / 1000
        camera.data.clip_end = distance * 3
        for index, frame in enumerate(frames):
            set_frame(scene, frame)
            scene.render.filepath = str(directory / f"{clip_id:02d}-{index:05d}.png")
            bpy.ops.render.render(write_still=True)
        clips[action.name] = {"id": clip_id, "frames": len(frames)}
    (directory / "clips.json").write_text(json.dumps({"selected": selected, "clips": clips}), encoding="utf-8")


if __name__ == "__main__":
    source, directory, size, fps, yaw = sys.argv[sys.argv.index("--") + 1:]
    run(Path(source), Path(directory), int(size), int(fps), float(yaw))
