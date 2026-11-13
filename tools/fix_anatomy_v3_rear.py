"""Rebuild only equine rear keys after checking support reach; retain geometry."""
import argparse
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
import anatomy_starters_v3 as a

ap=argparse.ArgumentParser();ap.add_argument('--jobs',required=True);args=ap.parse_args(sys.argv[sys.argv.index('--')+1:])
for job in json.loads(Path(args.jobs).read_text(encoding='utf-8-sig')):
    if job['family']!='star':continue
    out=Path(job['output']);blend=next((out/'models').glob('*.blend'))
    bpy.ops.wm.open_mainfile(filepath=str(blend));mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.endswith('_v3_structure'));rig=mesh.parent
    spec=json.loads((out/'rig_spec.json').read_text(encoding='utf8'));build=json.loads((out/'build_report.json').read_text(encoding='utf8'));motion=json.loads((out/'motion_spec.json').read_text(encoding='utf8'))
    a.b.BONES=spec['bones'];a.LEGS=spec['legs'];a.WINGS=spec['wings'];a.SCALE=build['scale'];a.FEATHERS=[]
    for name,info in a.b.BONES.items():
        if not name.startswith('Feather_'):continue
        _,label,group,index=name.split('_')
        a.FEATHERS.append(dict(name=name,parent=info['parent'],head=tuple(Vector(info['head'])/a.SCALE),tail=tuple(Vector(info['tail'])/a.SCALE),sign=1 if label=='L' else -1,group=group,index=int(index)))
    name='v3_'+job['stage']+'_rear';rig.animation_data.action=None;bpy.data.actions.remove(bpy.data.actions[name])
    original=a.motion_defs;a.motion_defs=lambda j:[dict(id='rear',f=64,loop=False)]
    clips,checks=a.animate(job,rig);a.motion_defs=original
    assert checks[0]['max_foot_target_error_m']<.003,checks[0]['max_foot_target_error_m']
    motion['checks']=[checks[0] if c['action']=='rear' else c for c in motion['checks']]
    a.b.write_json(out/'motion_spec.json',motion)
    # Refresh all camera views to use the same motion envelope after repair.
    for collection in list(bpy.data.collections):
        if collection.name.startswith('STUDIO_'):
            for ob in list(collection.objects):bpy.data.objects.remove(ob,do_unlink=True)
            bpy.data.collections.remove(collection)
    for ob in list(bpy.data.objects):
        if ob.name.startswith('QA_BARE_BODY'):bpy.data.objects.remove(ob,do_unlink=True)
    a.render(job,mesh,rig,motion['clips'])
    bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(next((out/'models').glob('*.glb'))),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,export_skins=True,export_extras=True,export_cameras=False,export_lights=False)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend),compress=True)
    print('REAR_FIXED',job['task_id'],checks[0]['max_foot_target_error_m'],flush=True)
