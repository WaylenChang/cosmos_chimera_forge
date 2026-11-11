import json,hashlib
from pathlib import Path
root=Path('Art/_incoming/pipeline_migration');zs=json.loads((root/'expanded.json').read_text(encoding='utf-8'));plan={}
for z in zs:
 for f in z['files']:
  parts=f['path'].split('/');asset=parts[0] if len(parts)>1 and parts[0].startswith(('mdl-','cr-','chr-')) else None
  data=Path(f['local']).read_bytes();sha=hashlib.sha256(data).hexdigest()
  dest=('01_portraits/' if asset and asset.startswith(('cr-','chr-')) else '02_3d/legacy/')+f['path'] if asset else 'backup/legacy_archives/expanded_reference/'+f['path']
  if dest in plan and plan[dest]['sha']!=sha:
   if asset:raise ValueError('conflicting asset '+dest)
   dest='backup/legacy_archives/expanded_reference/'+z['name'][:-4]+'/'+f['path']
  plan[dest]={'dest':dest,'src':z['id']+'/expanded/'+f['path'],'size':len(data),'sha':sha}
# Add indexing manifests to old structure-only models; they remain pending human review.
for asset in sorted({x.split('/')[2]for x in plan if x.startswith('02_3d/legacy/mdl-20261111') }):
 dest='02_3d/legacy/'+asset+'/manifest.json'
 if dest in plan:continue
 seed=asset.split('-')[2];line={'a111':'sun','b111':'moon','c111':'star'}[seed];stage=['juvenile','adolescent','adult','overload'][int(asset[-1])]
 files=[x.split(asset+'/',1)[1]for x in plan if x.startswith('02_3d/legacy/'+asset+'/')]
 m={'spec':'cosmimera-art-task/1','task_id':asset,'task_type':'creature-model-rig','subject_id':'starter_'+line+'_line','stage':stage,'source_pack':'cr-20261111-'+seed+'-1200','produced_by':'legacy migration index','files':[{'path':x,'kind':'model'if x.endswith(('.glb','.blend')) else 'report','level':'L1'if x.endswith(('.glb','.blend')) else 'L2'}for x in files],'missing':[],'notes':'Migration index only; existing bytes preserved. Pending human visual and animation review.'}
 local=root/'generated'/asset/'manifest.json';local.parent.mkdir(exist_ok=True,parents=True);local.write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8');data=local.read_bytes()
 plan[dest]={'dest':dest,'src':'generated/'+asset+'/manifest.json','size':len(data),'sha':hashlib.sha256(data).hexdigest()}
items=list(plan.values());(root/'upload_plan.json').write_text(json.dumps(items,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(items,ensure_ascii=False,separators=(',',':')))
