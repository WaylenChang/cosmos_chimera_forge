"""Independent V3.1 reopening, canonical clip, PBR and gait-flight checks."""
import argparse
import json
import sys
from pathlib import Path
import bpy
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parent))
import verify_anatomy_v3 as v
import blender_starters as b


def verify(job):
    v.verify(job,False)
    out=Path(job['output']);rpath=out/'review/structure_verification.json';report=json.loads(rpath.read_text(encoding='utf8'));motion=json.loads((out/'motion_spec.json').read_text(encoding='utf8'))
    expected={'cr_'+job['stage']+'_'+d['id'] for d in job['actions']};canonical={c['id'] for c in motion['clips'] if c.get('category')=='canonical'}
    report.update(revision='3.1',scope='canonical animation and reference-surface revision; technical validation',canonical_clips=len(canonical),supplemental_clips=len(motion['clips'])-len(canonical))
    if canonical!=expected:report['errors'].append('Canonical clip set mismatch')
    if any(c not in report['clip_max_deformation_m'] or report['clip_max_deformation_m'][c]<1e-6 for c in [x['action'] for x in motion['clips']]):report['errors'].append('Static clip')
    mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH');rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    report['uv_present']=bool(mesh.data.uv_layers);report['embedded_images']=len([im for im in bpy.data.images if im.type=='IMAGE' and im.name!='Render Result'])
    if not report['uv_present'] or report['embedded_images']<3:report['errors'].append('Missing embedded PBR assets')
    report['flight_checks']=[]
    groups={n:mesh.vertex_groups.get(n+'_Foot') for n in ('L_Front','R_Front','L_Hind','R_Hind')};indices={n:[p.index for p in mesh.data.vertices if g and any(w.group==g.index and w.weight>.999 for w in p.groups)] for n,g in groups.items()}
    for check in motion['checks']:
        if check['semantic'] not in ('gallop','canter','trot','run') or job['family']=='sun':continue
        samples=check.get('flight_samples',[])
        rig.animation_data.action=bpy.data.actions[check['id']];lowest=1e9
        offset=int(round(rig.animation_data.action.frame_range[0]))
        for sample in samples:
            bpy.context.scene.frame_set(sample['frame']+offset);co=v.coords(mesh)
            minima=[float(co[ids,2].min()) for ids in indices.values() if ids];lowest=min(lowest,min(minima))
        item=dict(clip=check['id'],flight_frames=len(samples),lowest_flight_sole_m=lowest if samples else None)
        report['flight_checks'].append(item)
        if not samples or lowest<.0001:report['errors'].append('Missing/grounded suspension: '+check['id'])
    # Canonical event frames must match the task; glTF events use a sidecar.
    for d in job['actions']:
        clip=next(c for c in motion['clips'] if c['id']=='cr_'+job['stage']+'_'+d['id'])
        if clip['frames']!=d['f'] or clip.get('events',[])!=d.get('ev',[]):report['errors'].append('Timing/event mismatch: '+d['id'])
    report['passed']=not report['errors'];b.write_json(rpath,report)
    print('V31_VERIFIED',job['task_id'],report['passed'],json.dumps(report['errors']),flush=True)


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--jobs',required=True);ap.add_argument('--only');ap.add_argument('--media',action='store_true');ap.add_argument('--media-only',action='store_true');args=ap.parse_args(sys.argv[sys.argv.index('--')+1:])
    for job in json.loads(Path(args.jobs).read_text(encoding='utf-8-sig')):
        if args.only and job['family']+':'+job['stage'] not in args.only.split(','):continue
        if args.media_only:
            out=Path(job['output']);report_path=out/'review/structure_verification.json';report=json.loads(report_path.read_text(encoding='utf8'))
            assert report['passed'] and report_path.stat().st_mtime>=max(p.stat().st_mtime for p in (out/'models').iterdir() if p.suffix in ('.glb','.blend'))
            bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=30;bpy.ops.import_scene.gltf(filepath=str(next((out/'models').glob('*.glb'))))
        else:verify(job)
        if args.media or args.media_only:
            out=Path(job['output']);motion=json.loads((out/'motion_spec.json').read_text(encoding='utf8'))
            # Full cycles for the most diagnostic canonical poses and gaits.
            selected=[c for c in motion['clips'] if c['id'].startswith('v3_') and c['semantic'] in ('idle','walk','gallop','canter','flap','wing_fold') or c['id'].startswith('cr_') and c['semantic'] in ('run','faint','atk_melee_front')]
            v.media(job,next(o for o in bpy.context.scene.objects if o.type=='MESH'),next(o for o in bpy.context.scene.objects if o.type=='ARMATURE'),dict(clips=selected))
            print('V31_MEDIA',job['task_id'],flush=True)


if __name__=='__main__':main()
