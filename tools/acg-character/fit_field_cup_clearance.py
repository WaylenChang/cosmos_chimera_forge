"""Relieve the local backpack panel under Yeh Chengxi's swinging field cup."""
import json
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils.bvhtree import BVHTree


def fit(source, stage):
    bpy.ops.wm.open_mainfile(filepath=str(source))
    rig = bpy.data.objects["Humanoid"]
    initial, frame = rig.animation_data.action, bpy.context.scene.frame_current
    pack, cup = (bpy.data.objects[n] for n in ("Backpack", "FieldCup"))
    rig.animation_data.action = bpy.data.actions["chr_run"]
    bpy.context.scene.frame_set(1)
    mesh = pack.data
    rest = np.array([v.co[:] for v in mesh.vertices])
    mesh.calc_loop_triangles()
    deps = bpy.context.evaluated_depsgraph_get()
    def surface(obj):
        obj = obj.evaluated_get(deps)
        obj.data.calc_loop_triangles()
        return BVHTree.FromPolygons([obj.matrix_world @ v.co for v in obj.data.vertices],
            [t.vertices[:] for t in obj.data.loop_triangles], all_triangles=True)
    obstacle = surface(cup)
    pairs = surface(pack).overlap(obstacle)
    if not pairs:
        raise ValueError("Expected the baseline run-frame-1 contact")
    faces = [mesh.loop_triangles[i] for i in sorted({a for a,b in pairs})]
    center = np.mean([rest[list(f.vertices)].mean(0) for f in faces], axis=0)
    normal = np.mean([f.normal[:] for f in faces], axis=0)
    normal /= np.linalg.norm(normal)
    # A compact smooth falloff preserves the seams outside the narrow contact patch.
    r = np.linalg.norm(rest-center,axis=1)/.027
    weights = np.maximum(0,1-r**2)**3
    def apply(depth):
        coords = rest - weights[:,None] * depth * normal
        mesh.vertices.foreach_set("co",coords.astype("f").ravel())
        mesh.update()
        bpy.context.view_layer.update()
    for mm in np.arange(.5,8.5,.5):
        apply(mm/1000.)
        if not surface(pack).overlap(obstacle):
            break
    else:
        raise ValueError("No local fit within the relief budget")
    # One extra millimetre provides clearance for mesh tessellation and export rounding.
    apply((mm+1)/1000.)
    assert not surface(pack).overlap(obstacle)
    actual=np.linalg.norm(np.array([v.co[:] for v in mesh.vertices])-rest,axis=1)
    report=dict(frame=1,original_pairs=len(pairs),patch_radius_mm=27,
        moved_vertices=int(np.count_nonzero(actual>1e-7)),max_relief_mm=float(actual.max()*1000))
    rig.animation_data.action=initial
    bpy.context.scene.frame_set(frame)
    stage.mkdir(exist_ok=True,parents=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(stage/source.name),compress=True,relative_remap=False)
    (stage/"fit.json").write_text(json.dumps(report,indent=2))
    print("FIT",report,flush=True)


if __name__=="__main__":
    fit(*(Path(arg).resolve() for arg in sys.argv[-2:]))
