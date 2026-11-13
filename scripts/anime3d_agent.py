#!/usr/bin/env python3
"""Anime3D: resumable Tripo API orchestration. Plan-only by default."""
import argparse, hashlib, json, os, shutil, subprocess, sys, time, urllib.request, urllib.error, uuid
from pathlib import Path

BASE="https://openapi.tripo3d.ai/v3"
BIPED={"idle","walk","run","dive","climb","jump","slash","shoot","hurt","fall","turn"}
NONBIPED={"quadruped":{"walk":"quadruped:walk"},"hexapod":{"walk":"hexapod:walk"},"octopod":{"walk":"octopod:walk"},"serpentine":{"march":"serpentine:march"},"aquatic":{"march":"aquatic:march"}}
CLASSES={"humanoid","monster","animal","fantasy_creature","mechanical","robot"}

def save(path,obj):
    path=Path(path); path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix(path.suffix+".tmp")
    tmp.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    tmp.replace(path)

def load(path):return json.loads(Path(path).read_text(encoding="utf8"))

def digest(path):
    h=hashlib.sha256()
    with open(path,"rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""):h.update(chunk)
    return h.hexdigest()

def api(key,method,path,payload=None,upload=None):
    headers={"Authorization":"Bearer "+key}
    data=None
    if upload is not None:
        boundary="----cosmimera"+uuid.uuid4().hex
        ext=Path(upload).suffix.lower()
        mime={".png":"image/png", ".webp":"image/webp"}.get(ext,"image/jpeg")
        prefix=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="source{ext}"\r\nContent-Type: {mime}\r\n\r\n').encode()
        data=prefix+Path(upload).read_bytes()+f'\r\n--{boundary}--\r\n'.encode()
        headers["Content-Type"]="multipart/form-data; boundary="+boundary
    elif payload is not None:
        data=json.dumps(payload).encode()
        headers["Content-Type"]="application/json"
    # A failed POST response may still have created a billable task. Only GET
    # requests can be retried without a provider idempotency guarantee.
    for attempt in range(4 if method == "GET" else 1):
        req=urllib.request.Request(BASE+path,headers=headers,data=data,method=method)
        try:
            with urllib.request.urlopen(req,timeout=90) as response:obj=json.load(response)
            if obj.get("code")!=0 or not isinstance(obj.get("data"),dict):
                raise RuntimeError("Tripo API rejection code "+str(obj.get("code")))
            return obj["data"]
        except urllib.error.HTTPError as exc:
            if method != "GET" or exc.code not in (429,500,502,503,504) or attempt==3:
                raise RuntimeError("Tripo HTTP "+str(exc.code)) from None
            retry=exc.headers.get("Retry-After","")
            time.sleep(min(int(retry) if retry.isdigit() else 3*2**attempt,120))
    raise RuntimeError("API retries exhausted")

def poll(key,task_id,timeout=1200):
    end=time.monotonic()+timeout
    while time.monotonic()<end:
        data=api(key,"GET","/tasks/"+task_id)
        if data.get("status")=="success":return data
        if data.get("status") in ("failed","cancelled","expired","banned"):
            raise RuntimeError("Task "+task_id+" failed: "+str(data.get("status")))
        time.sleep(8)
    raise TimeoutError("Task still pending; resume using stored task ID: "+task_id)

def route(spec):
    kind=spec.get("asset_class","humanoid")
    if kind=="mechanical" or (kind=="robot" and spec.get("surface_mode")=="rigid"):
        return {"mode":"manual_parts","rig_type":None,"clips":[],"unsupported":spec.get("requested_clips",[])}
    anatomy=spec.get("anatomy","biped")
    rig=spec.get("rig_type") or (anatomy if anatomy in NONBIPED else "biped" if anatomy in ("biped","humanoid") else "others")
    clips=spec.get("requested_clips",["idle","walk"])
    supported=[x for x in clips if (x in BIPED if rig=="biped" else x in NONBIPED.get(rig,{}))]
    return {"mode":"tripo","rig_type":rig,"clips":supported,"unsupported":[x for x in clips if x not in supported]}

def validate(root,spec,asset_id):
    for item in (asset_id,spec.get("source_pack")):
        if not isinstance(item,str) or not item or item in (".","..") or "/" in item or "\\" in item:raise ValueError("unsafe asset ID")
    if spec.get("asset_class","humanoid") not in CLASSES:raise ValueError("unknown asset class")
    if spec.get("license_status") not in ("verified","internal_only"):raise ValueError("license status requires review")
    source=spec["source_pack"]
    review=root/"reviews"/(source+".json")
    if not review.exists() or load(review).get("status")!="ok":raise ValueError("source portrait not approved")
    folders=[root/"01_portraits"/source, root/"03_completed"/"portraits"/source]
    available=[p for p in folders if p.is_dir()]
    if len(available)>1:raise ValueError("ambiguous source portrait location")
    folder=available[0].resolve() if available else folders[0].resolve()
    manifest=folder/"manifest.json"
    if manifest.is_file() and spec.get("subject_id") and load(manifest).get("subject_id")!=spec["subject_id"]:
        raise ValueError("source portrait subject mismatch")
    extensions=(".png",".jpg",".jpeg",".webp")
    explicit=spec.get("source_image")
    if explicit:
        candidate=(folder/explicit).resolve()
        if not candidate.is_relative_to(folder):raise ValueError("source_image escapes approved portrait")
        files=[candidate] if candidate.is_file() and candidate.suffix.lower() in extensions else []
    else:
        files=sorted((p for p in folder.rglob("*") if p.is_file() and not p.is_symlink() and p.suffix.lower() in extensions),key=lambda p:(0 if "front" in p.stem.lower() else 1,str(p))) if folder.exists() else []
    if not files:raise ValueError("source image missing")
    if files[0].stat().st_size>20*1024*1024:raise ValueError("image larger than Tripo 20MB limit")
    return files[0]

def task(key,state,name,endpoint,payload,path):
    item=state["steps"].setdefault(name,{})
    if item.get("status")=="success" and isinstance(item.get("data"),dict):
        return item["data"]
    if not item.get("task_id"):
        if item.get("status") in ("SUBMITTING", "SUBMISSION_UNKNOWN"):
            raise ValueError("Task submission outcome unknown; reconcile provider task ID before resuming: " + name)
        item["status"]="SUBMITTING"
        save(path,state)
        try:
            item["task_id"]=api(key,"POST",endpoint,payload)["task_id"]
        except Exception:
            item["status"]="SUBMISSION_UNKNOWN"
            save(path,state)
            raise
        save(path,state)
    data=poll(key,item["task_id"])
    item.update({"status":"success","data":data})
    save(path,state)
    return data

def download(url,path):
    from urllib.parse import urlparse
    parsed=urlparse(url)
    if parsed.scheme!="https" or not parsed.hostname:raise ValueError("invalid download URL")
    tmp=path.with_suffix(".partial")
    req=urllib.request.Request(url,headers={"User-Agent":"COSMIMERA-Anime3D/1.0"})
    with urllib.request.urlopen(req,timeout=120) as stream,open(tmp,"wb") as out:shutil.copyfileobj(stream,out)
    if not tmp.stat().st_size:raise RuntimeError("download returned empty model")
    tmp.replace(path)

def run(args):
    root=Path(args.root).resolve()
    spec=load(args.spec)
    image=validate(root,spec,args.asset_id)
    decision=route(spec)
    job=root/"02_3d"/"colab"/args.asset_id
    state_file=job/"agent_state.json"
    fingerprint=hashlib.sha256((digest(image)+json.dumps(spec,sort_keys=True,ensure_ascii=False)).encode()).hexdigest()
    if state_file.exists():
        state=load(state_file)
        if state["input_sha256"]!=fingerprint:raise ValueError("input changed: create new asset_id")
    else:
        state={"schema":"cosmimera-anime3d-agent/1","asset_id":args.asset_id,"source_pack":spec["source_pack"],"input_sha256":fingerprint,"route":decision,"status":"QUEUED","steps":{},"errors":[]}
        save(state_file,state)
    if not args.execute:
        print(json.dumps({"mode":"plan","image":str(image),"route":decision,"output":str(job)},ensure_ascii=False,indent=2))
        return 0
    if decision["mode"]!="tripo" or decision["rig_type"]=="others" or decision["unsupported"]:
        state["status"]="REVIEW_REQUIRED";state["errors"].append({"step":"route","error":"Unsupported rig or motion presets"})
        save(state_file,state);return 2
    if len(decision["clips"])>5:raise ValueError("Retarget supports up to 5 clips per request; split into jobs before executing")
    key=os.environ.get("TRIPO_API_KEY")
    if not key:raise ValueError("TRIPO_API_KEY not set")
    try:
        state["status"]="RUNNING";save(state_file,state)
        uploaded=state["steps"].get("upload")
        if uploaded and uploaded.get("file_token"):token=uploaded["file_token"]
        else:
            token=api(key,"POST","/files",upload=image)["file_token"]
            state["steps"]["upload"]={"status":"success","file_token":token};save(state_file,state)
        task(key,state,"generate","/generation/image-to-model",{"input":token,"model":"P2-20260801","texture":True,"pbr":True},state_file)
        gen_id=state["steps"]["generate"]["task_id"]
        check=task(key,state,"rig_check","/animations/rig-check",{"input":gen_id},state_file)
        info=check.get("output") or {}
        if not info.get("riggable") or info.get("rig_type")!=decision["rig_type"]:
            raise ValueError("rig-check failed or topology mismatch")
        rig_payload={"input":gen_id,"model":"v3.0-20260909","rig_type":decision["rig_type"],"out_format":"glb"}
        if decision["rig_type"]=="biped":rig_payload["spec"]=spec.get("rig_spec","unity")
        rig=task(key,state,"rig","/animations/rig",rig_payload,state_file)
        rig_id=state["steps"]["rig"]["task_id"]
        clips=decision["clips"]
        if len(clips)>5:raise ValueError("Retarget supports up to 5 clips per request")
        final=rig
        if clips:
            presets=["preset:"+x if decision["rig_type"]=="biped" else "preset:"+NONBIPED[decision["rig_type"]][x] for x in clips]
            final=task(key,state,"retarget","/animations/retarget",{"input":rig_id,"animations":presets,"out_format":"glb"},state_file)
        uri=(final.get("output") or {}).get("model_url")
        if not uri:raise ValueError("Tripo returned no model_url")
        model=job/"models"/(args.asset_id+".glb")
        model.parent.mkdir(parents=True,exist_ok=True)
        if not model.exists():download(uri,model)
        save(job/"animations"/"animations_manifest.json",{"clips":clips,"source":"tripo","rig_type":decision["rig_type"]})
        save(job/"material_profile.json",{"name":"anime_cel_2band","shadow_bands":2,"outline_width_px":2,"target_engine":spec.get("target_engine","unity"),"note":"Apply Toon shader in target engine"})
        blender=args.blender or shutil.which("blender")
        if not blender:
            state["status"]="QA_PENDING";save(state_file,state);return 2
        qa_script=Path(__file__).with_name("anime3d_blender.py")
        result=subprocess.run([blender,"-b","--factory-startup","--python-exit-code","3","--python",str(qa_script),"--",str(model),str(job),str(spec.get("poly_budget_triangles",30000))],capture_output=True,text=True,timeout=600)
        if result.returncode:raise ValueError("Blender QA failed: "+(result.stderr or result.stdout)[-1000:])
        metrics=load(job/"qa"/"metrics.json")
        found=[]
        for filename,kind in [(f"models/{args.asset_id}.glb","model"),(f"models/{args.asset_id}.blend","model"),("animations/animations_manifest.json","spec"),("material_profile.json","spec"),("qa/metrics.json","report")]:
            if (job/filename).exists():found.append({"path":filename,"kind":kind,"level":"L1"})
        state["status"]="QA_PENDING" if metrics.get("passed") else "REVIEW_REQUIRED"
        save(job/"manifest.json",{"spec":"cosmimera-art-task/1","task_header":spec.get("task_header",""),"task_id":args.asset_id,"task_type":spec.get("task_type","model-rig"),"subject_id":spec.get("subject_id","unknown"),"source_pack":spec["source_pack"],"produced_by":"Anime3D Colab Agent","files":found,"missing":[],"notes":"Requires final human approval; automated QA is preliminary","qa_status":state["status"]})
        save(state_file,state)
        return 0 if metrics.get("passed") else 2
    except Exception as exc:
        state["status"]="REVIEW_REQUIRED" if isinstance(exc,ValueError) else "RETRY"
        state["errors"].append({"error":str(exc)})
        save(state_file,state)
        raise

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--root",required=True)
    p.add_argument("--asset-id",required=True)
    p.add_argument("--spec",required=True)
    p.add_argument("--blender")
    p.add_argument("--execute",action="store_true",help="Explicitly allow paid external API calls")
    args=p.parse_args()
    try:return run(args)
    except Exception as exc:print("ERROR:",str(exc),file=sys.stderr);return 2

if __name__=="__main__":sys.exit(main())
