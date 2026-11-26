"""Build the gameplay mesh variant from the verified full-detail character export selection."""
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from refine_protagonist_motion import glb_json


def reduce_body(body):
    # Simplify the dense base surface in its undeformed rest pose.
    assert not body.data.shape_keys
    bpy.context.view_layer.objects.active = body
    modifier = body.modifiers.new("Game mesh", "DECIMATE")
    modifier.ratio = .32
    bpy.ops.object.modifier_move_to_index(modifier=modifier.name, index=0)
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def batch_trims(objects):
    batches = {}
    for o in objects:
        if not o.name.startswith(("Boot • brass eyelet", "Boot • crossed lace",
                                  "Weathercoat • bound seam", "Weathercoat • signal hem")):
            continue
        assert not o.data.shape_keys and not o.constraints
        data = o.animation_data
        visibility = []
        if data:
            assert not data.action and not data.nla_tracks
            for fc in data.drivers:
                assert fc.data_path in {"hide_render", "hide_viewport"}
                driver = fc.driver
                assert all(v.type == "SINGLE_PROP" for v in driver.variables)
                visibility.append((fc.data_path, driver.expression, tuple(
                    (v.name, v.targets[0].id.name, v.targets[0].data_path) for v in driver.variables)))

        key = (o.name.split(".")[0], o.parent, o.find_armature(), tuple(o.data.materials), tuple(sorted(visibility)))
        batches.setdefault(key, []).append(o)
    for group in batches.values():
        bpy.ops.object.select_all(action="DESELECT")
        for o in group:
            o.select_set(True)
        bpy.context.view_layer.objects.active = group[0]
        bpy.ops.object.join()


def run(stage, reference=None):
    source, = stage.glob("*.blend")
    if reference is None:
        reference, = [p for p in stage.glob("*.glb") if p.stem != "game_lod"]
    baseline = glb_json(reference)
    bpy.ops.wm.open_mainfile(filepath=str(source))
    names = {n["name"] for n in baseline["nodes"]}
    body = bpy.data.objects.get("Body surface") or bpy.data.objects["Leo • body from neck to toes"]
    reduce_body(body)
    batch_trims([o for o in bpy.context.scene.objects if o.name in names])
    bpy.ops.object.select_all(action="DESELECT")
    for o in bpy.context.scene.objects:
        if o.name in names and not o.hide_viewport:
            o.select_set(True)
    output = stage/"game_lod.glb"
    bpy.ops.export_scene.gltf(filepath=str(output),use_selection=True, export_animation_mode="ACTIONS",
        export_frame_range=False, export_force_sampling=True, export_morph_animation=False, export_extras=True)
    candidate = glb_json(output)
    def contract(doc):
        return ([a["name"] for a in doc["animations"]],
                sorted((m["name"], m["extras"]["targetNames"]) for m in doc["meshes"]
                       if m.get("extras", {}).get("targetNames")),
                sorted(doc["nodes"][j]["name"] for skin in doc["skins"] for j in skin["joints"]))
    assert contract(candidate) == contract(baseline)
    print("GAME VERIFIED",stage.name,flush=True)


if __name__ == "__main__":
    run(Path(sys.argv[-1]).resolve())
