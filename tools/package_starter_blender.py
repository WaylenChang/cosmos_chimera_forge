"""Build traceable delivery ZIPs only from verified Blender/GLB pairs."""
import argparse
import hashlib
import json
import shutil
import zipfile
from pathlib import Path


def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--root',default='Art/_incoming/starter_blender_20261111');ap.add_argument('--only');args=ap.parse_args()
    root=Path(args.root).resolve();jobs=json.loads((root/'jobs.json').read_text(encoding='utf8'));index=[]
    delivery=root/'delivery';delivery.mkdir(exist_ok=True)
    for job in jobs:
        if args.only and f"{job['family']}:{job['stage']}" not in args.only.split(','):continue
        out=Path(job['output']);report=json.loads((out/'review/verification.json').read_text(encoding='utf8'))
        assert report['passed'],f'Unverified stage: {job["task_id"]}'
        assert (out/'review/verification.json').stat().st_mtime>=max(p.stat().st_mtime for p in (out/'models').glob('*.glb')), 'GLB changed since verification'
        assert (out/'review/verification.json').stat().st_mtime>=max(p.stat().st_mtime for p in (out/'models').glob('*.blend')), 'Blend changed since verification'
        integrity=json.loads((out/'review/mesh_integrity.json').read_text(encoding='utf8'))
        assert integrity['open_components']==0
        assert (out/'review/appearance_review.png').exists()
        assert (out/'review/animation_review_1.png').exists() and (out/'review/animation_review_2.png').exists()
        # Keep the reproducible modeling/validation code with the delivery.
        pipe=out/'pipeline';pipe.mkdir(exist_ok=True)
        for name in ['blender_starters.py','verify_starter_blender.py','finalize_starter_blender.py','fix_starter_faint.py','prepare_starter_blender.cjs','starter_review_sheets.ps1','package_starter_blender.py']:
            shutil.copy2(Path(__file__).parent/name,pipe/name)
        if job.get('refinement'):
            for name in ['refine_starter_models.py','refined_comparison_sheets.ps1','run_refined_starter_checks.ps1']:
                shutil.copy2(Path(__file__).parent/name,pipe/name)
        publicjob={k:v for k,v in job.items() if k not in ('source_dir','output','prompt')}
        (pipe/'job.json').write_text(json.dumps(publicjob,ensure_ascii=False,indent=2),encoding='utf8')
        (pipe/'readme.md').write_text('Reconstruction: original reference-directed Blender procedural modeling, with packed front/turnaround references. No pre-existing model was reused.\n\nReproduce locally: download and extract the source pack identified in job.json; regenerate jobs.json with prepare_starter_blender.cjs from the Forge repository, then run Blender scripts in order: blender_starters.py, finalize_starter_blender.py, fix_starter_faint.py (quadrupeds), verify_starter_blender.py. Build review sheets with starter_review_sheets.ps1 and package using package_starter_blender.py.\n\nFiles remain review assets, not approved/imported game assets. GLB includes named skeletal animation clips and embedded PBR atlases. Blender contains editable geometry, armature, action clips, source references and a hidden studio. For editing the model, enable the model collection; reference and studio collections are hidden from the normal modeling viewport. Event markers require engine import from anim_spec.json. The normal atlas is neutral; geometric detail is modeled, no high-poly bake is claimed.\n',encoding='utf8')
        if job.get('refinement'):
            text=(pipe/'readme.md').read_text(encoding='utf8').replace('blender_starters.py, finalize_starter_blender.py','refine_starter_models.py, finalize_starter_blender.py').replace('The normal atlas is neutral; geometric detail is modeled, no high-poly bake is claimed.','Refinement 2 includes locally unwrapped painted albedo/ORM regions and authored fiber/ridge tangent normals; no high-poly bake is claimed. review/reference_front_side_back.png compares the source front and extracted side/back views, the actual GLB reimport and the previous model. The concept views are generative and not perfectly aligned; images are fitted separately and no numerical likeness score is claimed.')
            (pipe/'readme.md').write_text(text,encoding='utf8')
        unit=f"cr_{job['subject_id']}_{job['stage']}"
        manifest=json.loads((out/'manifest.json').read_text(encoding='utf8'))
        manifest['files']=[]
        for p in sorted(out.rglob('*')):
            if not p.is_file() or p.name=='manifest.json' or p.suffix in ('.blend1','.blend2') or p.name.startswith('.'):continue
            rel=p.relative_to(out).as_posix()
            kind='model' if rel.startswith('models/') else 'anim' if rel.startswith('anims/') and p.suffix=='.fbx' else 'view' if rel.startswith('images/') else 'spec' if p.suffix=='.json' else 'report'
            manifest['files'].append(dict(path=rel,kind=kind,level='L1',sha256=sha(p)))
        manifest['technical_validation']='pass'
        manifest['visual_review']='reference_interpretation_reviewed; art differences recorded in review/build_report.json'
        (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
        archive=delivery/(job['task_id']+'.zip')
        with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
            z.write(out/'manifest.json',job['task_id']+'/manifest.json')
            for f in manifest['files']:z.write(out/f['path'],job['task_id']+'/'+f['path'])
        with zipfile.ZipFile(archive) as z:
            assert z.testzip() is None
            assert len(z.namelist())==len(manifest['files'])+1
        index.append(dict(task_id=job['task_id'],family=job['family'],stage=job['stage'],creature_id=job['stage_data']['creature_id'],name_zh=job['stage_data']['name_zh'],source_pack=job['source_pack'],zip=str(archive),zip_bytes=archive.stat().st_size,zip_sha256=sha(archive),glb=str(out/'models'/(unit+'.glb')),blend=str(out/'models'/(unit+'.blend')),triangles=report['evidence']['triangles'],bones=report['evidence']['bones'],clips=len(job['actions']),passed=True))
        print('PACKAGED',job['task_id'],archive.stat().st_size,flush=True)
    existing=[]
    if (root/'delivery_index.json').exists():existing=json.loads((root/'delivery_index.json').read_text(encoding='utf8'))
    selected={x['task_id'] for x in index}
    combined=sorted([x for x in existing if x['task_id'] not in selected]+index,key=lambda x:x['task_id'])
    (root/'delivery_index.json').write_text(json.dumps(combined,ensure_ascii=False,indent=2),encoding='utf8')


if __name__=='__main__':main()
