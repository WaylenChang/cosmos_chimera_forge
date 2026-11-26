"""Inventory inter-object triangle intersections at every authored frame of a character GLB.

Overlaps include design contacts. The raw ledger deliberately retains these for adjudication.
"""
import gzip
import struct
import json
import sys
import time
from pathlib import Path

import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

ANATOMY={"Body surface","Head","Brow L","Brow R","Eye globe L","Eye globe R","Tongue","Upper teeth",
         "Leo • face and speech","Leo • body from neck to toes","Oral cavity","Cranium • anatomical crown"}


def anatomy(n):
    return n in ANATOMY or any(tag in n for tag in ("_Ear","Oral •","Ear.")) or n=="Ear"


def bind(rig, meshes, action):
    for block in [rig]+[o.data.shape_keys for o in meshes if o.data.shape_keys]:
        ad=block.animation_data
        if ad is None:continue
        strip=next((s for t in ad.nla_tracks for s in t.strips if s.action==action),None)
        for t in ad.nla_tracks:t.mute=True
        ad.action=action if strip or block==rig else None
        if strip:ad.action_slot=strip.action_slot


def run(source,out,fps,parts=()):
    with source.open("rb") as stream:
        length=struct.unpack_from("<I",stream.read(20),12)[0]
        asset=json.loads(stream.read(length))
    delivered={n["name"] for n in asset["nodes"] if "mesh" in n}
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene;scene.render.fps=fps
    bpy.ops.import_scene.gltf(filepath=str(source))
    rig,=[o for o in scene.objects if o.type=="ARMATURE"]
    meshes=sorted([o for o in scene.objects if o.type=="MESH"],key=lambda o:o.name)
    # The glTF importer creates an empty with the original name for some animated meshes.
    names=[o.data.name if bpy.data.objects.get(o.data.name) and
           bpy.data.objects[o.data.name].type=="EMPTY" else o.name for o in meshes]
    exported=[(n,o) for n,o in zip(names,meshes) if n in delivered]
    names=[n for n,o in exported];meshes=[o for n,o in exported]
    assert set(names)==delivered and len(names)==len(delivered)
    assert set(parts)<=delivered

    allowed=np.array([[i<j and (not parts or n in parts or m in parts) and not (anatomy(n) and anatomy(m)) for j,m in enumerate(names)] for i,n in enumerate(names)])
    actions=[a for a in bpy.data.actions if any(s.identifier=="OB"+rig.name for s in a.slots)]
    groups=[];tracks={};rest={}
    for o in meshes:
        used={g.group for v in o.data.vertices for g in v.groups if g.weight>0}
        bone=o.vertex_groups[next(iter(used))].name if len(used)==1 and not o.data.shape_keys else None
        groups.append(bone)
    # Same-bone pairs have invariant relative geometry under rigid joint transforms.
    rigid={}
    xyz=[np.empty(len(o.data.vertices)*3,dtype='f') for o in meshes]
    start=time.monotonic()
    def inspect():
        dg=bpy.context.evaluated_depsgraph_get()
        lows=[];highs=[];evaluated=[];trees={}
        for i,o in enumerate(meshes):
            e=o.evaluated_get(dg);evaluated.append(e)
            e.data.vertices.foreach_get("co",xyz[i])
            p=xyz[i].reshape(-1,3);xf=np.asarray(e.matrix_world)
            if not np.array_equal(xf,np.eye(4)):p=p@xf[:3,:3].T+xf[:3,3]
            lows.append(p.min(0));highs.append(p.max(0))
        lo=np.array(lows);hi=np.array(highs)
        mask=allowed&np.all(hi[:,None,:]>=lo[None,:,:],axis=2)&np.all(lo[:,None,:]<=hi[None,:,:],axis=2)
        found={}
        def tree(i):
            if i not in trees:
                e=evaluated[i];xf=np.asarray(e.matrix_world)
                if np.array_equal(xf,np.eye(4)):
                    trees[i]=BVHTree.FromObject(meshes[i],dg)
                else:
                    m=e.data;m.calc_loop_triangles();p=xyz[i].reshape(-1,3)@xf[:3,:3].T+xf[:3,3]
                    tris=np.empty(3*len(m.loop_triangles),dtype='i')
                    m.loop_triangles.foreach_get('vertices',tris)
                    trees[i]=BVHTree.FromPolygons(p.tolist(),tris.reshape(-1,3).tolist(),all_triangles=True)
            return trees[i]
        for i,j in zip(*np.nonzero(mask)):
            k=f"{i}/{j}"
            if k in rigid:count=rigid[k]
            else:
                count=len(tree(i).overlap(tree(j)))
                if groups[i] and groups[i]==groups[j]:rigid[k]=count
            if count:found[k]=count
        return found
    # Bind-pose contacts are a comparison point, never an automatic exemption.
    rig.data.pose_position="REST";bpy.context.view_layer.update()
    rest=inspect()
    rig.data.pose_position="POSE"
    for a in actions:
        bind(rig,meshes,a)
        first,last=(round(x) for x in a.frame_range)
        frames=[]
        for f in range(first,last+1):
            scene.frame_set(f)
            frames.append(inspect())
        tracks[a.name]=dict(first=first,frames=frames)
        print("AUDIT",a.name,len(frames),round(time.monotonic()-start,1),flush=True)
        with gzip.open(out.with_suffix(".partial.gz"),"wt",encoding="utf8") as stream:
            json.dump(dict(meshes=names,rest=rest,clips=tracks,fps=fps),stream,separators=(",",":"))
    out.with_suffix(".partial.gz").replace(out)
    print("DONE",len(actions),sum(len(a["frames"]) for a in tracks.values()),flush=True)


if __name__=="__main__":
    src,dst,fps,*parts=sys.argv[sys.argv.index("--")+1:]
    run(Path(src),Path(dst),int(fps),parts)
