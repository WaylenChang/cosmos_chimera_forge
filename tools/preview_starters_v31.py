"""Compact material-lit reopening views, without changing delivery files."""
import argparse
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
import blender_starters as b

ap=argparse.ArgumentParser();ap.add_argument('--jobs',required=True);ap.add_argument('--only');ap.add_argument('--glb',action='store_true');ap.add_argument('--open-wings',action='store_true');args=ap.parse_args(sys.argv[sys.argv.index('--')+1:])
for job in json.loads(Path(args.jobs).read_text(encoding='utf-8-sig')):
    if args.only and job['family']+':'+job['stage'] not in args.only.split(','):continue
    out=Path(job['output'])
    if args.glb:
        bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=30;bpy.ops.import_scene.gltf(filepath=str(next((out/'models').glob('*.glb'))))
        mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH');rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    else:
        bpy.ops.wm.open_mainfile(filepath=str(next((out/'models').glob('*.blend'))));mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.endswith('_v3_structure'));rig=mesh.parent
    rig.animation_data.action=bpy.data.actions['v3_'+job['stage']+'_idle'];bpy.context.scene.frame_set(0)
    if args.open_wings:
        action=bpy.data.actions.get('v3_'+job['stage']+'_flap') or bpy.data.actions.get('v3_'+job['stage']+'_wing_fold')
        if not action:continue
        rig.animation_data.action=action;bpy.context.scene.frame_set(24 if action.name.endswith('_flap') else 40)
    for collection in list(bpy.data.collections):
        if collection.name.startswith('STUDIO_'):
            for ob in list(collection.objects):bpy.data.objects.remove(ob,do_unlink=True)
            bpy.data.collections.remove(collection)
    cam,center,extent,studio=b.setup_render(mesh);scene=bpy.context.scene;scene.cycles.samples=12;scene.render.resolution_x=640;scene.render.resolution_y=640
    for ob in studio.objects:
        if ob.name.startswith('studio_floor'):ob.location.z=-.0005*extent
    (out/'review').mkdir(exist_ok=True)
    for name,direction in [('front',(0,-6,.2)),('side',(6,0,.2)),('back',(0,6,.2)),('quarter',(4,-6,1.1))]:
        cam.location=center+Vector(direction)*extent;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/'review'/('material_'+('open_' if args.open_wings else '')+name+'.png'));bpy.ops.render.render(write_still=True)
