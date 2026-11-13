import sys,json,urllib.request,zipfile,hashlib
from pathlib import Path,PurePosixPath
from concurrent.futures import ThreadPoolExecutor
root=Path('Art/_incoming/pipeline_migration').resolve();root.mkdir(exist_ok=True,parents=True)
plan=json.load(sys.stdin)
def process(item):
 dest=root/item['id'];dest.mkdir(exist_ok=True)
 archive=dest/item['name']
 if not archive.exists() or archive.stat().st_size!=int(item['size']):
  urllib.request.urlretrieve(item['url'],archive)
 if archive.stat().st_size!=int(item['size']):raise ValueError('size mismatch '+item['name'])
 result=[]
 with zipfile.ZipFile(archive) as z:
  bad=z.testzip()
  if bad:raise ValueError('CRC failed '+bad)
  entries=[x for x in z.infolist() if not x.is_dir()]
  for x in entries:
   pp=PurePosixPath(x.filename)
   if pp.is_absolute() or '..' in pp.parts or '\\' in x.filename or ':' in x.filename:raise ValueError('unsafe path')
   path=dest/'expanded'/Path(*pp.parts)
   if not path.resolve().is_relative_to(dest):raise ValueError('unsafe path')
   path.parent.mkdir(exist_ok=True,parents=True);path.write_bytes(z.read(x))
   result.append({'path':x.filename,'local':str(path),'size':x.file_size})
 return {'id':item['id'],'parent':item['parent'],'name':item['name'],'files':result,'sha256':hashlib.file_digest(archive.open('rb'),'sha256').hexdigest()}
with ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(process,plan))
previous=json.loads((root/'expanded.json').read_text(encoding='utf-8')) if (root/'expanded.json').exists() else []
by_id={x['id']:x for x in previous}
by_id.update({x['id']:x for x in results})
(root/'expanded.json').write_text(json.dumps(list(by_id.values()),ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps([{'name':r['name'],'files':len(r['files']),'top':list(dict.fromkeys(f['path'].split('/')[0] for f in r['files']))}for r in results],ensure_ascii=False))
