"""Pose-space cloth clearance for the two hanging sleeves, retaining their original skin and motion."""
import json
from pathlib import Path

import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

CLIPS = ("chr_run", "chr_roll_dodge", "chr_hit_react")
PROPERTY = "sleeve_contact_sample"


def coords(mesh):
    values = np.empty(len(mesh.vertices)*3, dtype="f")
    mesh.vertices.foreach_get("co", values)
    return values.reshape(-1,3)


def set_coords(mesh, values):
    mesh.vertices.foreach_set("co", np.asarray(values,dtype="f").ravel())
    mesh.update()


def triangles(mesh):
    mesh.calc_loop_triangles()
    faces=np.empty(len(mesh.loop_triangles)*3, dtype="i")
    mesh.loop_triangles.foreach_get("vertices", faces)
    return faces.reshape(-1,3)


def smooth(t):
    t=np.clip(t,0,1)
    return t*t*(3-2*t)


def poses(rig, obj, rests, frames, chest):
    # Displacements along the three mesh axes give the exact per-vertex skin transform,
    # including Blender's dual-quaternion skinning and the sleeve's existing swing.
    series=[]
    for offset in (np.zeros(3),*np.eye(3)*.02):
        set_coords(obj.data,rests+offset)
        rows=[]
        for clip, frame in frames:
            rig.animation_data.action=bpy.data.actions[clip]
            bpy.context.scene.frame_set(frame)
            xf=np.array(chest.bone.matrix_local @ chest.matrix.inverted())
            mesh=obj.evaluated_get(bpy.context.evaluated_depsgraph_get()).data
            rows.append(coords(mesh)@xf[:3,:3].T+xf[:3,3])
        series.append(np.array(rows))
    set_coords(obj.data,rests)
    return series[0], np.stack([(a-series[0])/.02 for a in series[1:]],axis=-1)


def fit_sleeve(obj, rig, pack, frames, start):
    rest=coords(obj.data)
    tris=triangles(obj.data)
    bag=coords(pack.data)
    lower,upper=bag.min(0),bag.max(0)
    obstacle=BVHTree.FromPolygons(bag.tolist(),triangles(pack.data).tolist(),all_triangles=True)
    posed,jac=poses(rig,obj,rest,frames,rig.pose.bones["UpperChest"])
    side=1 if obj.name.startswith("L") else -1
    directions=np.array([(side,0,0),(side,-1,0),(0,-1,0),(side,1,0),(0,1,0),
                         (side,0,-1),(0,0,-1),(side,-2,-1),(side,1,-1),(side*2,-1,0),
                         (side,-1,1),(0,-1,-1),(0,1,-1)],dtype=float)
    directions/=np.linalg.norm(directions,axis=1,keepdims=True)
    anchor=smooth((rest[:,2].max()-.008-rest[:,2])/.018)
    zero=np.zeros_like(rest)
    options=[]
    for (clip,frame),v,j in zip(frames,posed,jac):
        # Select triangles that could meet the pack, including large faces crossing its box.
        xyz=v[tris]
        near=tris[np.all((xyz.max(1)>lower-.008)&(xyz.min(1)<upper+.008),axis=1)]
        def hits(points):
            return len(obstacle.overlap(BVHTree.FromPolygons(points.tolist(),near.tolist(),all_triangles=True))) if len(near) else 0
        if not hits(v):
            options.append([zero]);continue
        distance=np.maximum(np.maximum(lower-v,v-upper),0).max(1)
        weight=smooth(1-distance/.045)*anchor
        valid=[]
        for direction in directions:
            separation=np.maximum(0,(bag@direction).max()+.004-v@direction)
            delta=weight[:,None]*separation[:,None]*direction
            if not hits(v+delta):
                valid.append(np.linalg.solve(j,delta[...,None])[...,0].astype("f"))
        if not valid:
            raise ValueError(f"No fixed-root clearance at {obj.name} {clip}:{frame}")
        options.append(valid)
    # Favour similar neighbouring corrections through the same contact event.
    chosen=[]
    for clip in CLIPS:
        inds=[i for i,(name,_) in enumerate(frames) if name==clip]
        costs=np.zeros(1);last=[zero];parents=[]
        for i in inds:
            costs_next=[]; links=[]
            for d in options[i]:
                jumps=costs+np.array([np.mean((d[::16]-p[::16])**2) for p in last])*6
                best=int(jumps.argmin());links.append(best)
                costs_next.append(jumps[best]+np.mean(d[::16]**2))
            parents.append(links);last=options[i];costs=np.array(costs_next)
        state=int(costs.argmin());path=[]
        for i,links in zip(reversed(inds),reversed(parents)):
            path.append(options[i][state]);state=links[state]
        chosen.extend(reversed(path))
    obj.shape_key_add(name="Basis")
    for i,delta in enumerate(chosen):
        if not np.any(delta):continue
        assert np.max(np.abs(delta[anchor==0]))==0
        key=obj.shape_key_add(name=f"Clearance_{i+start:03d}",from_mix=False)
        key.data.foreach_set("co",(rest+delta).astype("f").ravel())
        driver=key.driver_add("value").driver
        var=driver.variables.new();var.name="sample";var.type="SINGLE_PROP"
        var.targets[0].id=rig;var.targets[0].data_path=f'["{PROPERTY}"]'
        driver.expression=f"max(0, 1-abs(sample-{i+start}))"
    print("FITTED",obj.name,len(obj.data.shape_keys.key_blocks)-1,flush=True)


def mount_ferrule():
    # Join a short metal lug to the back of the original crimp without moving the crimp or cord.
    import bmesh
    from mathutils import Vector
    ferrule=bpy.data.objects["PackTassel ferrule"]
    pack=bpy.data.objects["Backpack"]
    xf=ferrule.matrix_world.inverted() @ pack.matrix_world
    tree=BVHTree.FromPolygons([xf@v.co for v in pack.data.vertices],triangles(pack.data).tolist(),all_triangles=True)
    tip=min((v.co.copy() for v in ferrule.data.vertices), key=lambda co:tree.find_nearest(co)[3])
    hit,_,_,_=tree.find_nearest(tip)
    axis=(tip-hit).normalized()
    tangent=axis.cross(Vector((0,0,1))).normalized()
    normal=tangent.cross(axis).normalized()
    mesh=bmesh.new();mesh.from_mesh(ferrule.data)
    weights=mesh.verts.layers.deform.verify()
    rings=[]
    for center in (hit-axis*.003,tip+axis*.001):
        ring=[]
        for a,b in ((-.003,-.0015),(.003,-.0015),(.004,-.0005),(.004,.0005),
                    (.003,.0015),(-.003,.0015),(-.004,.0005),(-.004,-.0005)):
            v=mesh.verts.new(center+tangent*a+normal*b)
            v[weights][ferrule.vertex_groups["UpperChest"].index]=1.
            ring.append(v)
        rings.append(ring)
    mesh.faces.new(tuple(reversed(rings[0])));mesh.faces.new(rings[1])
    for i in range(8):
        j=(i+1)%8
        mesh.faces.new((rings[0][i],rings[0][j],rings[1][j],rings[1][i]))
    mesh.normal_update();mesh.to_mesh(ferrule.data);mesh.free()
    ferrule.data.update()


def fit(stage):
    rig=bpy.data.objects["Humanoid"]
    pack=bpy.data.objects["Backpack"]
    scene=bpy.context.scene
    original,original_frame=rig.animation_data.action,scene.frame_current
    v=coords(pack.data);x,y,z=v.T.copy()
    # Recess only the lower panel below the lanyard attachment.
    v[:,1]-=.045*np.clip((1.07-z)/.05,0,1)*np.clip((x-.02)/.07,0,1)*np.clip((y-.045)/.09,0,1)
    set_coords(pack.data,v)
    mount_ferrule()
    frames=[(name,f) for name in CLIPS for f in range(int(bpy.data.actions[name].frame_range[0]),int(bpy.data.actions[name].frame_range[1])+1)]
    start=10
    rig[PROPERTY]=-100.
    for name in ("L_KimonoSleeve","R_KimonoSleeve"):
        fit_sleeve(bpy.data.objects[name],rig,pack,frames,start)
    for action in list(bpy.data.actions):
        if not any(slot.identifier=="OB"+rig.name for slot in action.slots):continue
        rig.animation_data.action=action
        path=f'["{PROPERTY}"]'
        bag=action.layers[0].strips[0].channelbag(rig.animation_data.action_slot)
        curve=bag.fcurves.new(path,index=0)
        keys=[(f,i+start) for i,(clip,f) in enumerate(frames) if clip==action.name]
        for f,sample in keys or [(action.frame_range[0],-100)]:
            curve.keyframe_points.insert(f,sample).interpolation="LINEAR"
    rig.animation_data.action=original;scene.frame_set(original_frame)
    (stage/"contact_samples.json").write_text(json.dumps(frames))

def fit_hair(stage):
    """Blend in a root-pinned comb adjustment only around contact frames."""
    obj=bpy.data.objects["TiedHair"];shirt=bpy.data.objects["Bodice"]
    rig=bpy.data.objects["Humanoid"];scene=bpy.context.scene
    initial,frame=rig.animation_data.action,scene.frame_current
    rest=coords(obj.data)
    obj.shape_key_add(name="Basis")
    key=obj.shape_key_add(name="Garment clearance",from_mix=False)
    tangent=smooth((1.47-rest[:,2])/.14)
    set_values=rest+tangent[:,None]*np.array((.035,.012,.018))
    key.data.foreach_set("co",set_values.astype("f").ravel())
    levels={}
    for clip in CLIPS:
        action=bpy.data.actions[clip];rig.animation_data.action=action
        required=[]
        for f in range(int(action.frame_range[0]),int(action.frame_range[1])+1):
            scene.frame_set(f);dg=bpy.context.evaluated_depsgraph_get()
            obstacle=BVHTree.FromObject(shirt,dg)
            for w in np.linspace(0,1,17):
                key.value=w
                bpy.context.view_layer.update()
                if not obstacle.overlap(BVHTree.FromObject(obj,dg)):
                    required.append(min(1,float(w)+.10) if w else 0.)
                    break
            else:
                raise ValueError((clip,f,"insufficient clearance"))
        levels[clip]=[max(0.,max(w-.22*abs(i-j) for j,w in enumerate(required))) for i in range(len(required))]
    key.value=0.
    prop="ponytail_contact";rig[prop]=0.
    driver=key.driver_add("value").driver
    var=driver.variables.new();var.name="amount";var.type="SINGLE_PROP"
    var.targets[0].id=rig;var.targets[0].data_path=f'["{prop}"]';driver.expression="amount"
    for action in bpy.data.actions:
        if not any(s.identifier=="OB"+rig.name for s in action.slots):continue
        rig.animation_data.action=action
        bag=action.layers[0].strips[0].channelbag(rig.animation_data.action_slot)
        curve=bag.fcurves.new(f'["{prop}"]',index=0)
        for i,w in enumerate(levels.get(action.name,[0.])):
            curve.keyframe_points.insert(action.frame_range[0]+i,w).interpolation="LINEAR"
    rig.animation_data.action=initial;scene.frame_set(frame)
    (stage/"contact_samples.json").write_text(json.dumps(levels))
