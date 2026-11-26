"""Build a new candidate from the selected release and keep its animation/wardrobe contract."""
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0,str(Path(__file__).resolve().parent))
from refine_protagonist_motion import glb_json


def pigment():
    return bpy.data.objects["Head"].data.color_attributes["Facial pigment"].data


def lighting():
    colors = np.empty(len(pigment())*4, dtype=np.float32)
    pigment().foreach_get("color",colors)
    emission = {m.name: m.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value
                for m in bpy.data.materials if m.name in ("Skin - Head neutral","Hair") or
                m.name.startswith(("HairLock","Hair nape"))}
    return colors,emission


def midpoint(source, prior):
    bpy.ops.wm.open_mainfile(filepath=str(prior))
    original, strengths = lighting()
    bpy.ops.wm.open_mainfile(filepath=str(source))
    current, latest = lighting()
    if original.shape != current.shape or strengths.keys() != latest.keys():
        raise ValueError("Incompatible lighting endpoints")
    pigment().foreach_set("color", (original+current)*.5)
    for name, value in latest.items():
        bpy.data.materials[name].node_tree.nodes["Principled BSDF"].inputs[
            "Emission Strength"].default_value = (strengths[name]+value)*.5


def export(reference, stage):
    previous = glb_json(reference)
    names = {n["name"] for n in previous["nodes"]}
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.name in names and not obj.hide_viewport:
            obj.select_set(True)
    output = stage/reference.name
    bpy.ops.export_scene.gltf(filepath=str(output),use_selection=True,export_animation_mode="ACTIONS",
        export_frame_range=False,export_force_sampling=True,export_morph_animation=False,export_extras=True)
    candidate=glb_json(output)
    for key in ("nodes","animations","meshes"):
        assert {n["name"] for n in candidate[key]} == {n["name"] for n in previous[key]}, key


if __name__ == "__main__":
    mode,release_dir,output_dir,*extras = sys.argv[sys.argv.index("--")+1:]
    release,stage=Path(release_dir).resolve(),Path(output_dir).resolve()
    source,=release.glob("*.blend")
    reference,=release.glob("chr*.glb")
    assert stage!=release
    stage.mkdir(exist_ok=True,parents=True)
    if mode=="midpoint":
        midpoint(source,Path(extras[0]).resolve())
        bpy.ops.wm.save_as_mainfile(filepath=str(stage/source.name),compress=True,relative_remap=False)
    elif mode=="fit":
        bpy.ops.wm.open_mainfile(filepath=str(source))
        if "TiedHair" in bpy.data.objects and "PackTassel" not in bpy.data.objects:
            from sleeve_contact_shapes import fit_hair
            fit_hair(stage)
        else:
            from sleeve_contact_shapes import fit
            fit(stage)
        bpy.ops.wm.save_as_mainfile(filepath=str(stage/source.name),compress=True,relative_remap=False)
    elif mode=="full":
        bpy.ops.wm.open_mainfile(filepath=str(stage/source.name))
        export(reference,stage)
        if (stage/"contact_samples.json").exists():
            import json
            from garment_glb_tracks import write_sleeve_tracks
            write_sleeve_tracks(stage/reference.name,json.loads((stage/"contact_samples.json").read_text()),bpy.context.scene.render.fps/bpy.context.scene.render.fps_base)
    elif mode=="lod":
        from export_character_game_lod import run
        if (stage/"contact_samples.json").exists():
            import json
            from garment_glb_tracks import write_sleeve_tracks
            run(stage,stage/reference.name)
            write_sleeve_tracks(stage/"game_lod.glb",json.loads((stage/"contact_samples.json").read_text()),bpy.context.scene.render.fps/bpy.context.scene.render.fps_base)
        else:
            run(stage,reference)
    else:
        raise ValueError(mode)
