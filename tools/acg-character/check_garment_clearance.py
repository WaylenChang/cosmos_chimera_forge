"""Compare all integer frames, keeping normals, root positions and authored swing separately measurable."""
import json,sys
from pathlib import Path
import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

CLIPS=("chr_run","chr_roll_dodge","chr_hit_react")


def compare(path, items):
    bpy.ops.wm.open_mainfile(filepath=str(path))
    rig=bpy.data.objects["Humanoid"]
    report={};samples={}
    for name,target in items:
        ob=bpy.data.objects[name]
        rest=np.array([v.co[:] for v in ob.data.vertices])
        top=rest[:,2].max()
        # Entire top 8 mm, independent of fitted weights or collision masks.
        pinned=np.flatnonzero(rest[:,2]>=top-.008)
        tips=np.flatnonzero(rest[:,2]<=rest[:,2].min()+.004)
        relevant=[rig.pose.bones[g.name] for g in ob.vertex_groups if g.name in rig.pose.bones]
        for clip in CLIPS:
            ac=bpy.data.actions[clip];rig.animation_data.action=ac
            for frame in range(int(ac.frame_range[0]),int(ac.frame_range[1])+1):
                bpy.context.scene.frame_set(frame);dg=bpy.context.evaluated_depsgraph_get()
                objs=[bpy.data.objects[s].evaluated_get(dg) for s in (name,target)]
                trees=[]
                for o in objs:
                    m=o.data;m.calc_loop_triangles()
                    v=np.empty(len(m.vertices)*3,dtype="f");m.vertices.foreach_get("co",v)
                    xf=np.array(o.matrix_world);v=v.reshape(-1,3)@xf[:3,:3].T+xf[:3,3]
                    if o==objs[0]:
                        pos=v
                    tr=np.empty(len(m.loop_triangles)*3,dtype="i");m.loop_triangles.foreach_get("vertices",tr)
                    trees.append(BVHTree.FromPolygons(v.tolist(),tr.reshape(-1,3).tolist(),all_triangles=True))
                key=(name,clip,frame)
                report[key]=len(trees[0].overlap(trees[1]))
                samples[key]=(pos[pinned],pos[tips].mean(0),np.array([np.array(b.matrix) for b in relevant]))
    return report,samples


if __name__=="__main__":
    old,new,out=map(Path,sys.argv[-3:])
    items=([("L_KimonoSleeve","Backpack"),("R_KimonoSleeve","Backpack"),("PackTassel","Backpack")]
           if "sumiha" in old.name else [("TiedHair","Bodice"),("FieldCup","Backpack")])
    a,x=compare(old,items);b,y=compare(new,items)
    results=[]
    for key,count in a.items():
        anchor,tip,bones=x[key];new_anchor,new_tip,new_bones=y[key]
        results.append(dict(part=key[0],action=key[1],frame=key[2],before=count,after=b[key],
            fixed_mm=float(np.linalg.norm(anchor-new_anchor,axis=1).max()*1000),
            tip_delta_mm=float(np.linalg.norm(tip-new_tip)*1000),
            tip_before=tip.tolist(),tip_after=new_tip.tolist(),bone_matrix_delta=float(np.max(np.abs(bones-new_bones)))))
    out.write_text(json.dumps(results,separators=(",",":")))
    for name,t in items:
        sub=[r for r in results if r["part"]==name]
        print("QA",name,len(sub),sum(r["before"]>0 for r in sub),sum(r["after"]>0 for r in sub),
              max(r["fixed_mm"] for r in sub),max(r["bone_matrix_delta"] for r in sub),flush=True)
