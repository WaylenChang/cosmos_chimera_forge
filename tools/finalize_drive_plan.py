import json,sys,re,hashlib
from pathlib import Path
root=Path('Art/_incoming/pipeline_migration');plan=json.loads((root/'upload_plan.json').read_text(encoding='utf-8'));uploaded=set(json.load(sys.stdin))
def include(x):
 d=x['dest']
 if d.startswith('backup/'):return False
 if re.search(r'\.(fbx|gif|txt|py|ps1)$|\.prompt\.md$',d,re.I):return False
 if '/review/' in d:return bool(re.search(r'/(anatomy_review|material_front|material_side|material_back|motion_diagnostic)\.jpg$',d)) or d.endswith('.json')
 return True
selected=[x for x in plan if include(x)];present={x['dest']for x in selected}|uploaded
changed=[]
for x in selected:
 local=root/x['src']
 if x['dest'].endswith('/manifest.json'):
  m=json.loads(local.read_text(encoding='utf-8-sig'))
  if isinstance(m,dict):
   prefix=x['dest'][:-len('manifest.json')]
   m['files']=[f for f in m.get('files',[])if prefix+f.get('path','') in present]
   note='Directory migration: this index lists active direct files; the complete original delivery, including intermediate previews and alternate formats, remains in the historical archive. Pending human review.'
   if note not in str(m.get('notes','')):m['notes']=(str(m.get('notes',''))+'\n'+note).strip()
   local.write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8');changed.append(x['dest'])
 data=local.read_bytes();x['size']=len(data);x['sha']=hashlib.sha256(data).hexdigest()
(root/'active_upload_plan.json').write_text(json.dumps(selected,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'plan':selected,'changed':changed},ensure_ascii=False,separators=(',',':')))
