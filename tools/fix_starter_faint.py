"""Correct quadruped collapse about the anatomical spine axis and ground contact."""
import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Vector

sys.path.insert(0,str(Path(__file__).resolve().parent))
from blender_starters import export


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--jobs',required=True);ap.add_argument('--only');args=ap.parse_args(sys.argv[sys.argv.index('--')+1:])
    for job in json.loads(Path(args.jobs).read_text(encoding='utf8')):
        if job['family']=='sun':continue
        if args.only and f"{job['family']}:{job['stage']}" not in args.only.split(','):continue
        out=Path(job['output']);unit=f"cr_{job['subject_id']}_{job['stage']}"
        bpy.ops.wm.open_mainfile(filepath=str(out/'models'/(unit+'.blend')))
        bpy.context.preferences.filepaths.save_version=0
        mesh=bpy.data.objects[unit];rig=mesh.parent;scene=bpy.context.scene
        action=bpy.data.actions[f"cr_{job['stage']}_faint"]
        rig.animation_data.action=action
        endz=None
        for frame in range(0,41,2):
            scene.frame_set(frame);t=frame/40;ease=3*t*t-2*t*t*t
            hips=rig.pose.bones['Hips'];root=rig.pose.bones['Root']
            hips.rotation_quaternion=Euler((0,1.45*ease,0),'XYZ').to_quaternion()
            root.location=(0,0,0)
            bpy.context.view_layer.update()
            evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());m=evaluated.to_mesh()
            minz=min((evaluated.matrix_world@v.co).z for v in m.vertices)
            evaluated.to_mesh_clear()
            world_lift=-minz*min(1,t*2)
            root.location=root.bone.matrix_local.to_3x3().inverted() @ Vector((0,0,world_lift))
            if frame==40:endz=minz+world_lift
            hips.keyframe_insert('rotation_quaternion',frame=frame,group='Hips')
            root.keyframe_insert('location',frame=frame,group='Root')
        clips=json.loads((out/'anims/anim_spec.json').read_text(encoding='utf8'))['clips']
        export(job,mesh,rig,clips,clip_filter=['faint'])
        (out/'review/faint_correction.json').write_text(json.dumps(dict(anatomical_roll_axis='local Y of longitudinal Hips bone',end_roll_radians=1.45,final_lowest_vertex_m=endz),indent=2),encoding='utf8')
        print('FAINT_CORRECTED',job['task_id'],flush=True)


if __name__=='__main__':main()
