"""Match every sampled frame and compare every cup, hanger and ferrule vertex in world space."""
import json
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

CLIPS={"chr_run":23,"chr_roll_dodge":21,"chr_hit_react":16}
MOUNT=("FieldCup","CupHanger","CupHanger ferrule")


def sample(folder,kind):
    if kind=="blend":
        source,=folder.glob("*.blend")
        bpy.ops.wm.open_mainfile(filepath=str(source))
    else:
        source=next(folder.glob("chr*.glb")) if kind=="full" else folder/"game_lod.glb"
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.context.scene.render.fps=30
        bpy.ops.import_scene.gltf(filepath=str(source))
    rig=bpy.data.objects["Humanoid"]
    for tr in rig.animation_data.nla_tracks:
        tr.mute=True
    objects={n:bpy.data.objects[n] for n in ("Backpack",*MOUNT)}
    faces={}
    for n in ("Backpack","FieldCup"):
        mesh=objects[n].data
        mesh.calc_loop_triangles()
        faces[n]=[p.vertices[:] for p in mesh.loop_triangles]
    frames={}
    for clip,length in CLIPS.items():
        a=bpy.data.actions[clip]
        rig.animation_data.action=a
        slot=next(s for s in a.slots if s.identifier=="OBHumanoid")
        rig.animation_data.action_slot=slot
        assert tuple(a.frame_range)==(0,length-1),(clip,tuple(a.frame_range))
        for f in range(length):
            bpy.context.scene.frame_set(f)
            deps=bpy.context.evaluated_depsgraph_get()
            vertices={}
            for n,ob in objects.items():
                ob=ob.evaluated_get(deps)
                data=np.empty(len(ob.data.vertices)*3,dtype='f')
                ob.data.vertices.foreach_get("co",data)
                xf=np.array(ob.matrix_world)
                vertices[n]=data.reshape(-1,3)@xf[:3,:3].T+xf[:3,3]
            trees=[BVHTree.FromPolygons(vertices[n].tolist(),faces[n],all_triangles=True)
                   for n in ("Backpack","FieldCup")]
            frames[clip,f]=(len(trees[0].overlap(trees[1])),{n:vertices[n] for n in MOUNT})
    return frames


if __name__=="__main__":
    kind,baseline,stage=sys.argv[-3:]
    stage=Path(stage)
    before=sample(Path(baseline),kind)
    after=sample(stage,kind)
    rows=[]
    for (clip,f),(old,points) in before.items():
        new,latest=after[clip,f]
        deltas={n:float(np.linalg.norm(latest[n]-points[n],axis=1).max()*1000) for n in MOUNT}
        rows.append(dict(clip=clip,frame=f,before=old,after=new,max_vertex_delta_mm=deltas))
    (stage/(kind+"_frames.json")).write_text(json.dumps(rows,indent=2))
    assert len(rows)==60
    assert all(r["after"]==0 and max(r["max_vertex_delta_mm"].values())<.001 for r in rows)
    print("VERIFIED",kind,[(r["clip"],r["frame"],r["before"]) for r in rows if r["before"]],flush=True)
