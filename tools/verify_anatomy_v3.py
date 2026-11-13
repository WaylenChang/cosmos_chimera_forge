"""Reopen structural prototypes, measure all frames, reimport real GLB, make media.
Technical pass here never means art/performance acceptance.
"""
import argparse
import json
import math
import struct
import sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0,str(Path(__file__).resolve().parent))
import blender_starters as b
V=Vector


def coords(mesh):
    ob=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ob.to_mesh()
    a=np.empty(len(m.vertices)*3,dtype=np.float32);m.vertices.foreach_get('co',a);a=a.reshape(-1,3)
    matrix=np.array(ob.matrix_world,dtype=np.float32);a=a@matrix[:3,:3].T+matrix[:3,3]
    ob.to_mesh_clear();return a


def gif(path,frames,width,height,delay=5):
    """Portable GIF89a, adaptive median-cut palette and bounded literal LZW blocks.

    Clear every 120 pixels keeps the code width at 9 bits. All frame pixels
    come from actual Blender renders. No image-generating service is used.
    """
    samples=np.concatenate([frame.reshape(-1,3)[::40] for frame in frames])
    colors,counts=np.unique(samples,axis=0,return_counts=True);boxes=[(colors,counts)]
    while len(boxes)<256:
        scores=[float(np.ptp(c.astype(float),axis=0).max())*math.sqrt(float(w.sum())) if len(c)>1 else 0 for c,w in boxes]
        k=int(np.argmax(scores))
        if not scores[k]:break
        c,w=boxes.pop(k);axis=int(np.argmax(np.ptp(c.astype(float),axis=0)));order=np.argsort(c[:,axis]);c,w=c[order],w[order]
        split=max(1,min(len(c)-1,int(np.searchsorted(np.cumsum(w),w.sum()/2))))
        boxes.extend([(c[:split],w[:split]),(c[split:],w[split:])])
    pal=np.array([np.average(c,axis=0,weights=w) for c,w in boxes],dtype=np.float32)
    while len(pal)<256:pal=np.vstack([pal,pal[-1]])
    pal=np.clip(np.rint(pal),0,255).astype(np.uint8);palette=pal.tobytes()
    # RGB555 lookup bounds nearest-color memory while retaining dark blues and
    # smooth gray anatomical volume, which uniform RGB332 lost.
    codes=np.arange(32768,dtype=np.int32)
    cube=np.stack([((codes>>10)&31)*8+4,((codes>>5)&31)*8+4,(codes&31)*8+4],axis=1).astype(np.float32)
    lookup=np.empty(32768,dtype=np.uint8)
    for start in range(0,32768,512):lookup[start:start+512]=np.argmin(np.sum((cube[start:start+512,None,:]-pal[None,:,:].astype(np.float32))**2,axis=2),axis=1)
    data=bytearray(b'GIF89a'+struct.pack('<HHBBB',width,height,0xf7,0,0)+palette)
    data.extend(b'!\xff\x0bNETSCAPE2.0\x03\x01\x00\x00\x00')
    for rgb in frames:
        reduced=rgb.astype(np.int32)>>3
        pixels=lookup[(reduced[:,:,0]<<10)+(reduced[:,:,1]<<5)+reduced[:,:,2]]
        data.extend(b'!\xf9\x04'+struct.pack('<BHB',4,delay,0)+b'\x00')
        data.extend(b','+struct.pack('<HHHHB',0,0,width,height,0)+b'\x08')
        flat=pixels.flatten();codes=[]
        for start in range(0,len(flat),120):codes.extend([256,*flat[start:start+120].tolist()])
        codes.append(257);payload=bytearray();acc=0;bits=0
        for code in codes:
            acc|=int(code)<<bits;bits+=9
            while bits>=8:payload.append(acc&255);acc>>=8;bits-=8
        if bits:payload.append(acc&255)
        for start in range(0,len(payload),255):block=payload[start:start+255];data.append(len(block));data.extend(block)
        data.append(0)
    data.append(0x3b);Path(path).write_bytes(data)


def rendered_indices(scene):
    bpy.ops.render.render()
    # Render Result exposes no pixels in background builds; load the exact PNG.
    bpy.data.images['Render Result'].save_render(scene.render.filepath,scene=scene)
    image=bpy.data.images.load(scene.render.filepath,check_existing=False)
    arr=np.array(image.pixels[:],dtype=np.float32).reshape(image.size[1],image.size[0],4)[::-1,:,:3]
    # PNG-backed image pixels already contain display-encoded byte values.
    # Applying an additional gamma curve here would wash out the review.
    rgb=np.clip(arr*255,0,255).astype(np.uint8);bpy.data.images.remove(image)
    return rgb


def media(job,mesh,rig,motion):
    scene=bpy.context.scene;review=Path(job['output'])/'review'
    cam,center,extent,studio=b.setup_render(mesh)
    points=[]
    for clip in motion['clips']:
        rig.animation_data.action=bpy.data.actions[clip['id']]
        for fraction in (0,.25,.5,.75,1):
            scene.frame_set(round(clip['frames']*fraction));points.extend(coords(mesh)[::12])
    allco=np.array(points);low=allco.min(0);high=allco.max(0);center=V((low+high)/2);extent=float(max(high-low));cam.data.ortho_scale=extent*1.24
    scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=320;scene.render.resolution_y=320;scene.render.resolution_percentage=100
    scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_cavity=True;scene.display.shading.show_shadows=True
    scene.display.shading.background_type='WORLD';scene.world.color=(.055,.067,.09)
    studio.objects.get('studio_floor').hide_render=True
    for view,d in [('side',(6,0,.1)),('quarter',(4,-6,1.1))]:
        rig.animation_data.action=bpy.data.actions['v3_'+job['stage']+'_idle'];scene.frame_set(0)
        cam.location=center+V(d)*extent;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(review/f'glb_reopened_{view}.png');bpy.ops.render.render(write_still=True)
    # Render the actual imported joint locations, rather than an illustrative
    # skeleton unrelated to the delivered armature.
    b.MATS=[]
    for name,color in [('limb',(1,.55,.08,1)),('axial',(.12,.8,1,1)),('wing',(.66,.25,1,1))]:
        mat=bpy.data.materials.new('qa_'+name);mat.diffuse_color=color;b.MATS.append(mat)
    bones=[]
    for pb in rig.pose.bones:
        if pb.name.startswith(('Feather_','Root')):continue
        mat=2 if pb.name.startswith('Wing_') else 0 if any(s in pb.name for s in ('Front','Hind','Scapula')) else 1
        ob=b.tube('QA_joint_'+pb.name,[pb.head,pb.tail],[extent*.005,extent*.002],mat,sides=6);bones.append(ob)
        ob=b.ell('QA_pivot_'+pb.name,pb.head,(extent*.009,)*3,mat,seg=8,rings=6);bones.append(ob)
    mesh.hide_render=True
    for view,d in [('side',(6,0,.1)),('top',(0,0,6))]:
        cam.location=center+V(d)*extent;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(review/f'rig_{view}.png');bpy.ops.render.render(write_still=True)
    mesh.hide_render=False
    for ob in bones:ob.hide_render=True
    if job['stage']=='adult':
        for clip in motion['clips']:
            rig.animation_data.action=bpy.data.actions[clip['id']];frames=[]
            # Complete cycle, not only a four-key contact sheet. Each action
            # retains its own duration by adjusting the GIF frame delay.
            count=min(40,clip['frames']+1)
            for i in range(count):
                scene.frame_set(round(clip['frames']*i/(count-1)))
                cam.location=center+V((6,0,.18))*extent;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(review/'_gif_frame.png')
                frames.append(rendered_indices(scene))
            gif(review/(clip['action']+'_fullcycle_side.gif'),frames,320,320,max(2,round(clip['frames']/30/count*100)))
        rig.animation_data.action=bpy.data.actions['v3_'+job['stage']+'_idle'];scene.frame_set(0);frames=[]
        for i in range(36):
            a=2*math.pi*i/36;cam.location=center+V((math.sin(a)*6,-math.cos(a)*6,.6))*extent;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(review/'_gif_frame.png');frames.append(rendered_indices(scene))
        gif(review/'turntable_360.gif',frames,320,320,7)
        (review/'_gif_frame.png').unlink(missing_ok=True)


def verify(job,make_media):
    out=Path(job['output']);blend=next((out/'models').glob('*.blend'));glb=next((out/'models').glob('*.glb'))
    bpy.ops.wm.open_mainfile(filepath=str(blend));mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.endswith('_v3_structure'));rig=mesh.parent
    motion=json.loads((out/'motion_spec.json').read_text(encoding='utf8'));report=dict(task_id=job['task_id'],scope='structural prototype, technical checks only',blend_opened=True,art_accepted=False,errors=[])
    lengths={p.name:p.bone.length for p in rig.pose.bones};maxlen=0;looperr=0;deformations={};minstance=1e9;maxstance=0
    groups={g.index:g.name for g in mesh.vertex_groups if g.name in rig.data.bones};unweighted=0;influences=0;weight_error=0
    for v in mesh.data.vertices:
        weights=[g.weight for g in v.groups if g.group in groups and g.weight>1e-6]
        if not weights:unweighted+=1
        influences=max(influences,len(weights));weight_error=max(weight_error,abs(sum(weights)-1))
    for clip in motion['clips']:
        rig.animation_data.action=bpy.data.actions[clip['id']];bpy.context.scene.frame_set(0);first=coords(mesh);peak=0
        for f in range(clip['frames']+1):
            bpy.context.scene.frame_set(f)
            uniform_scale=rig.pose.bones['Root'].scale.x if clip.get('uniform_appearance_scale') else 1
            for pb in rig.pose.bones:maxlen=max(maxlen,abs((pb.tail-pb.head).length/max(uniform_scale,.001)-lengths[pb.name]))
            if f%4==0 or f==clip['frames']:peak=max(peak,float(np.max(np.linalg.norm(coords(mesh)-first,axis=1))))
        deformations[clip['action']]=peak
        if clip['loop']:looperr=max(looperr,float(np.max(np.linalg.norm(coords(mesh)-first,axis=1))))
    # Every locomotion stance sample is checked against the exported skin's
    # actual rigid foot geometry, rather than only its target coordinates.
    for check in motion['checks']:
        if not check['stance_samples']:continue
        rig.animation_data.action=bpy.data.actions[check.get('id','v3_'+job['stage']+'_'+check['action'])]
        perframe={}
        for sample in check['stance_samples']:perframe.setdefault(sample['frame'],[]).append(sample['limb'])
        for f,limbs in perframe.items():
            bpy.context.scene.frame_set(f);co=coords(mesh)
            for limb in limbs:
                name=limb+'_Foot';group=mesh.vertex_groups.get(name)
                verts=[v.index for v in mesh.data.vertices if any(g.group==group.index and g.weight>.99 for g in v.groups)]
                if verts:
                    z=float(co[verts,2].min());minstance=min(minstance,z);maxstance=max(maxstance,abs(z))
    report.update(bones=len(rig.data.bones),clips=len(motion['clips']),max_bone_length_error_m=maxlen,loop_mesh_error_m=looperr,unweighted_vertices=unweighted,max_deform_influences=influences,max_weight_sum_error=weight_error,max_stance_ground_error_m=maxstance,min_stance_z_m=minstance,clip_max_deformation_m=deformations)
    if unweighted or influences>4 or weight_error>.0001:report['errors'].append('Skin weights')
    if maxlen>1e-4:report['errors'].append('Changing bone lengths')
    if looperr>1e-4:report['errors'].append('Loop discontinuity')
    if maxstance>.003:report['errors'].append('Stance foot ground error')
    if any(check['max_foot_target_error_m']>.003 for check in motion['checks']):report['errors'].append('Unreachable foot target')
    raw=glb.read_bytes();magic,version,length=struct.unpack_from('<4sII',raw);n,kind=struct.unpack_from('<II',raw,12);doc=json.loads(raw[20:20+n]);report['glb_envelope_valid']=magic==b'glTF' and version==2 and length==len(raw)
    expected={c['id'] for c in motion['clips']};actual={a.get('name') for a in doc.get('animations',[])}
    report['glb_clips_match']=expected==actual
    if expected!=actual:report['errors'].append('GLB clips mismatch')
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=30;bpy.ops.import_scene.gltf(filepath=str(glb))
    mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH');rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    report['glb_reimported']=True
    rig.animation_data.action=bpy.data.actions.get('v3_'+job['stage']+'_walk');bpy.context.scene.frame_set(0);a=coords(mesh);bpy.context.scene.frame_set(12);z=coords(mesh)
    report['glb_walk_deformation_m']=float(np.max(np.linalg.norm(a-z,axis=1)))
    if report['glb_walk_deformation_m']<1e-5:report['errors'].append('GLB walk does not deform')
    if make_media:media(job,mesh,rig,motion)
    report['passed']=not report['errors'];b.write_json(out/'review/structure_verification.json',report)
    print('STRUCTURE_VERIFIED',job['task_id'],json.dumps({k:report[k] for k in ['passed','errors','max_stance_ground_error_m','max_bone_length_error_m','loop_mesh_error_m']}),flush=True)


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--jobs',required=True);ap.add_argument('--only');ap.add_argument('--media',action='store_true');ap.add_argument('--media-only',action='store_true');args=ap.parse_args(sys.argv[sys.argv.index('--')+1:])
    for job in json.loads(Path(args.jobs).read_text(encoding='utf-8-sig')):
        if args.only and job['family']+':'+job['stage'] not in args.only.split(','):continue
        if args.media_only:
            out=Path(job['output']);verified=json.loads((out/'review/structure_verification.json').read_text(encoding='utf8'))
            assert verified['passed']
            bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=30;bpy.ops.import_scene.gltf(filepath=str(next((out/'models').glob('*.glb'))))
            mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH');rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
            media(job,mesh,rig,json.loads((out/'motion_spec.json').read_text(encoding='utf8')))
        else:verify(job,args.media)


if __name__=='__main__':main()
