"""Independent Blender reopen/import and GLB structure/deformation audit."""
import argparse
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

import bpy
import numpy as np

# Shared studio construction only; geometry and animation are read from the files.
sys.path.insert(0,str(Path(__file__).resolve().parent))
from blender_starters import setup_render


def render_motion_review(job,rig,mesh):
    """Fast viewport filmstrips supplement numeric checks for every action."""
    scene=bpy.context.scene
    studio=bpy.data.collections.get('STUDIO_do_not_export')
    if studio:studio.hide_viewport=False
    scene.render.engine='BLENDER_WORKBENCH'
    scene.render.resolution_x=192;scene.render.resolution_y=192;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL'
    scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True
    scene.display.shading.background_type='WORLD';scene.world.color=(.06,.075,.1)
    camera=scene.camera
    from mathutils import Vector
    box=[mesh.matrix_world@Vector(c) for c in mesh.bound_box]
    center=Vector(tuple((min(v[i] for v in box)+max(v[i] for v in box))/2 for i in range(3)))
    extent=max(max(v[i] for v in box)-min(v[i] for v in box) for i in range(3))
    camera.location=center+Vector((3.5,-5,1.1))*extent
    camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=extent*1.5
    framesdir=Path(job['output'])/'review/motion_frames';framesdir.mkdir(exist_ok=True)
    for a in job['actions']:
        rig.animation_data.action=bpy.data.actions[f"cr_{job['stage']}_{a['id']}"]
        for i,frame in enumerate([0,a['f']//3,2*a['f']//3,a['f']]):
            scene.frame_set(frame)
            scene.render.filepath=str(framesdir/f"{a['id']}_{i}.png")
            bpy.ops.render.render(write_still=True)


def glb_json(path):
    data=path.read_bytes()
    magic,version,length=struct.unpack_from('<4sII',data)
    assert magic==b'glTF' and version==2 and length==len(data),'Invalid GLB envelope'
    n,kind=struct.unpack_from('<II',data,12)
    assert kind==0x4e4f534a
    return json.loads(data[20:20+n])


def deformed_coords(mesh):
    deps=bpy.context.evaluated_depsgraph_get();obj=mesh.evaluated_get(deps);m=obj.to_mesh()
    coords=np.array([(obj.matrix_world@v.co)[:] for v in m.vertices])
    obj.to_mesh_clear()
    return coords


def audit(job):
    out=Path(job['output']);name=f"cr_{job['subject_id']}_{job['stage']}"
    blend=out/'models'/(name+'.blend');glb=out/'models'/(name+'.glb')
    errors=[];evidence={}
    def check(ok,message):
        if not ok:errors.append(message)
    doc=glb_json(glb)
    expected={f"cr_{job['stage']}_{a['id']}" for a in job['actions']}
    exported={a['name'] for a in doc.get('animations',[])}
    evidence['glb_clips']=sorted(exported)
    check(expected==exported,f'GLB actions differ: missing={expected-exported}, extra={exported-expected}')
    check(len(doc.get('skins',[]))==1,'GLB needs one skeleton')
    for m in doc['meshes']:
        for p in m['primitives']:
            check('JOINTS_0' in p['attributes'] and 'WEIGHTS_0' in p['attributes'],'Unskinned GLB primitive')
            check('TEXCOORD_0' in p['attributes'],'Missing GLB UV')
    check(not doc.get('cameras'),'Studio camera exported')
    check(all('uri' not in i for i in doc.get('images',[])),'GLB texture is not embedded')
    bpy.ops.wm.open_mainfile(filepath=str(blend))
    rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');mesh=bpy.data.objects[name]
    check(len(rig.data.bones)<=60,'Bone budget exceeded')
    check(all(o.type not in ('CAMERA','LIGHT') for o in [mesh,rig]),'Invalid export selection')
    check(len(mesh.data.uv_layers)==1,'Unexpected multiple UV layers')
    tris=sum(len(p.vertices)-2 for p in mesh.data.polygons)
    check(job['size'][0]<=tris<=job['size'][1],f'Triangle budget mismatch {tris}')
    evidence.update(triangles=tris,bones=len(rig.data.bones),vertices=len(mesh.data.vertices))
    unweighted=0;maxinfluence=0;maxerror=0
    for v in mesh.data.vertices:
        weights=[g.weight for g in v.groups if g.weight>.00001]
        if not weights:unweighted+=1
        maxinfluence=max(maxinfluence,len(weights));maxerror=max(maxerror,abs(1-sum(weights)))
    check(unweighted==0,f'{unweighted} unweighted vertices')
    check(maxinfluence<=4,f'{maxinfluence} influences, limit 4')
    check(maxerror<.005,f'Weights not normalized: error {maxerror}')
    evidence.update(unweighted=unweighted,max_influences=maxinfluence,weight_sum_max_error=maxerror)
    check(all(i.packed_file for i in bpy.data.images if i.type=='IMAGE'),'Blend has unpacked textures/references')
    movement={};looperror={}
    for a in job['actions']:
        action=bpy.data.actions.get(f"cr_{job['stage']}_{a['id']}")
        check(action is not None,'Blend action missing: '+a['id'])
        if action is None:continue
        rig.animation_data.action=action
        bpy.context.scene.frame_set(0);x=deformed_coords(mesh)
        bpy.context.scene.frame_set(max(1,a['f']//3));y=deformed_coords(mesh)
        check(np.isfinite(y).all(),'Nonfinite deformation: '+a['id'])
        displacement=float(np.max(np.linalg.norm(y-x,axis=1)))
        movement[a['id']]=displacement
        check(displacement>1e-7,'Static animation: '+a['id'])
        if a.get('loop'):
            bpy.context.scene.frame_set(a['f']);z=deformed_coords(mesh)
            error=float(np.max(np.linalg.norm(z-x,axis=1)));looperror[a['id']]=error
            check(error<.0005,'Loop seam: '+a['id']+' '+str(error))
    evidence['blend_deformation_max_m']=movement;evidence['loop_position_error_m']=looperror
    if job['family']!='sun':
        from mathutils import Vector
        rig.animation_data.action=bpy.data.actions[f"cr_{job['stage']}_faint"]
        bpy.context.scene.frame_set(40)
        up=rig.pose.bones['Hips'].matrix.to_3x3() @ Vector((0,0,1))
        ground=float(deformed_coords(mesh)[:,2].min())
        evidence['faint_body_up_axis_z']=float(up.normalized().z)
        evidence['faint_final_lowest_vertex_m']=ground
        check(abs(up.normalized().z)<.4,'Faint ends upright rather than lying on side')
        check(abs(ground)<.002,'Faint final ground contact is incorrect: '+str(ground))
    render_motion_review(job,rig,mesh)
    # Reimport the actual GLB into a new empty Blender scene.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    rigs=[o for o in bpy.data.objects if o.type=='ARMATURE'];meshes=[o for o in bpy.data.objects if o.type=='MESH']
    check(len(rigs)==1 and bool(meshes),'Reimport did not recover rig and geometry')
    evidence['glb_reimport_meshes']=len(meshes)
    if rigs:
        r=rigs[0]
        check(len(r.data.bones)<=60,'Reimport bone budget exceeded')
        actions={a.name.split('.')[0] for a in bpy.data.actions}
        check(expected<=actions,'Reimport animations missing: '+str(expected-actions))
        walk=next((a for a in bpy.data.actions if a.name.startswith(f"cr_{job['stage']}_walk")),None)
        if walk:
            r.animation_data.action=walk
            m=max(meshes,key=lambda o:len(o.data.vertices))
            bpy.context.scene.frame_set(0);x=deformed_coords(m)
            bpy.context.scene.frame_set(8);y=deformed_coords(m)
            delta=float(np.max(np.linalg.norm(y-x,axis=1)))
            evidence['glb_reimport_walk_deformation_m']=delta
            check(delta>1e-6,'Reimport walk does not deform the mesh')
        r.animation_data.action=next(a for a in bpy.data.actions if a.name.startswith(f"cr_{job['stage']}_idle"))
        bpy.context.scene.frame_set(0)
        cam,center,extent,_=setup_render(max(meshes,key=lambda o:len(o.data.vertices)))
        from mathutils import Vector
        cam.location=center+Vector((3.5,-5,1.1))*extent
        cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
        bpy.context.scene.render.resolution_x=384;bpy.context.scene.render.resolution_y=384;bpy.context.scene.cycles.samples=8
        bpy.context.scene.render.filepath=str(out/'review/glb_reopened.png')
        bpy.ops.render.render(write_still=True)
        if job.get('refinement'):
            # Independent views of the imported delivery, without studio floor,
            # for direct front/side/back comparison against the concept sheet.
            scene=bpy.context.scene;scene.render.film_transparent=True
            scene.render.image_settings.color_mode='RGBA'
            bpy.data.objects['studio_floor'].hide_render=True
            for suffix,direction in [('front',(0,-5,0)),('side',(5,0,0)),('back',(0,5,0))]:
                cam.location=center+Vector(direction)*extent
                cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
                scene.render.filepath=str(out/f'review/glb_{suffix}.png')
                bpy.ops.render.render(write_still=True)
    result=dict(task_id=job['task_id'],passed=not errors,errors=errors,evidence=evidence)
    (out/'review/verification.json').write_text(json.dumps(result,indent=2),encoding='utf8')
    build=json.loads((out/'review/build_report.json').read_text(encoding='utf8'));build['review_status']='technical_pass' if not errors else 'technical_failed'
    (out/'review/build_report.json').write_text(json.dumps(build,ensure_ascii=False,indent=2),encoding='utf8')
    manifest=json.loads((out/'manifest.json').read_text(encoding='utf8'))
    manifest['files']=[{**f,'sha256':hashlib.sha256((out/f['path']).read_bytes()).hexdigest()} for f in manifest['files']]
    manifest['files']=[f for f in manifest['files'] if f['path']!='review/verification.json']
    for p in sorted((out/'review').rglob('*.png'))+[out/'review/verification.json']:
        rel=p.relative_to(out).as_posix()
        manifest['files']=[f for f in manifest['files'] if f['path']!=rel]
        manifest['files'].append(dict(path=rel,kind='report',level='L1',sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
    (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
    print('VERIFY',job['task_id'],'PASS' if not errors else errors,flush=True)
    return result


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--jobs',required=True);ap.add_argument('--only');args=ap.parse_args(sys.argv[sys.argv.index('--')+1:])
    jobs=json.loads(Path(args.jobs).read_text(encoding='utf8'));results=[]
    for job in jobs:
        if args.only and f"{job['family']}:{job['stage']}" not in args.only.split(','):continue
        results.append(audit(job))
    Path(args.jobs).with_name('verification_summary.json').write_text(json.dumps(results,indent=2),encoding='utf8')
    if not all(r['passed'] for r in results):raise RuntimeError('Stage verification failed')


if __name__=='__main__':main()
