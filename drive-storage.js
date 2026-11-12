// Private Drive assets use directories; archives are import-only.
(function () {
"use strict";
const config=window.COSMI_DRIVE_CONFIG, API="https://www.googleapis.com/drive/v3/files", MIME="application/vnd.google-apps.folder";
let accessToken="",expiry=0,expiryTimer,tokenClient,initialized=false,syncing,busy=false,accountNamespace="",sessionGeneration=0;
// sessionStorage survives refreshes within the same browser tab, but not a closed session.
// Never persist a full-Drive bearer token in localStorage or in a URL.
const SESSION_KEY="cosmi.drive.oauth.v1",SESSION_SKEW=30000;
function clearSavedSession(){
 try{window.sessionStorage?.removeItem(SESSION_KEY);}catch(_){}
}
function saveSession(){
 try{window.sessionStorage?.setItem(SESSION_KEY,JSON.stringify({
  clientId:config.clientId,rootId:config.rootId,accessToken,expiry
 }));}catch(_){}
}
function readSession(){
 try{
  const raw=window.sessionStorage?.getItem(SESSION_KEY);
  if(!raw)return null;
  const saved=JSON.parse(raw);
  if(saved.clientId!==config.clientId||saved.rootId!==config.rootId||
     typeof saved.accessToken!=="string"||!saved.accessToken||
     !Number.isFinite(saved.expiry)||saved.expiry<=Date.now()+SESSION_SKEW){
   clearSavedSession();return null;
  }
  return saved;
 }catch(_){clearSavedSession();return null;}
}
const folders=new Map(), $=id=>document.getElementById(id);
function limitConcurrent(max) {
 let running=0;const waiting=[];
 function drain(){
  while(running<max&&waiting.length){
   const [task,resolve,reject]=waiting.shift();running++;
   Promise.resolve().then(task).then(resolve,reject).finally(()=>{running--;drain();});
  }
 }
 return task=>new Promise((resolve,reject)=>{waiting.push([task,resolve,reject]);drain();});
}
const dirs=["01_portraits","02_3d/colab","02_3d/ai_blender","02_3d/legacy","03_completed/portraits","03_completed/models"];
function relative(path) {
 if(typeof path!=="string"||!path||path.includes("\\")||/[:?#\x00-\x1f]/.test(path)) throw Error("請使用 Drive 專案內的相對路徑");
 const parts=path.split("/"); if(parts.some(p=>!p||p==="."||p===".."))throw Error("不允許空白或上層目錄路徑"); return parts;
}
function lock(message) {
 const previousNamespace=accountNamespace;
 sessionGeneration++;accessToken="";expiry=0;accountNamespace="";folders.clear();clearTimeout(expiryTimer);clearSavedSession();
 // Invalidate the private cache on any logout, expiry or permission failure.
 void window.COSMI_DRIVE_CACHE?.clear(previousNamespace);
 $("driveApp").hidden=true;$("driveGate").hidden=false;$("driveGateStatus").textContent=message;
 if(initialized)window.location.reload();
}
async function request(url,options={}) {
 if(!accessToken||Date.now()>=expiry){lock("登入已到期，請重新登入 Google");throw Error("請先登入 Google");}
 const headers=new Headers(options.headers);headers.set("Authorization","Bearer "+accessToken);
 const r=await fetch(url,{...options,headers,cache:"no-store"});
 if(r.status===401)lock("登入已到期，請重新登入 Google");
 if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d.error?.message||"Google Drive HTTP "+r.status);}return r;
}
const escapeQuery=s=>s.replace(/\\/g,"\\\\").replace(/'/g,"\\'");
async function list(parent,extra="") {
 const files=[];let pageToken="";
 do{const p=new URLSearchParams({q:"'"+escapeQuery(parent)+"' in parents and trashed = false"+(extra?" and "+extra:""),
 fields:"nextPageToken,files(id,name,mimeType,modifiedTime,size,parents)",pageSize:"1000"});
 if(pageToken)p.set("pageToken",pageToken);
 const d=await(await request(API+"?"+p)).json();files.push(...d.files);pageToken=d.nextPageToken||"";}while(pageToken);return files;
}
async function folder(path,create=false) {
 if(!path)return config.rootId;let parent=config.rootId,prefix="";
 for(const part of relative(path)){
 prefix=prefix?prefix+"/"+part:part;
 if(!folders.has(prefix)){
 let m=await list(parent,"name = '"+escapeQuery(part)+"' and mimeType = '"+MIME+"'");
 if(!m.length&&create)m=[await(await request(API+"?fields=id,name",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:part,mimeType:MIME,parents:[parent]})})).json()];
 if(m.length!==1)throw Error(prefix+" 資料夾"+(m.length?"名稱重複":"不存在"));folders.set(prefix,m[0].id);
 }parent=folders.get(prefix);}return parent;
}
async function find(path,create=false){
 const parts=relative(path),name=parts.pop(),parent=await folder(parts.join("/"),create),m=await list(parent,"name = '"+escapeQuery(name)+"'");
 if(m.length>1)throw Error(path+" 名稱重複，請先在 Drive 整理");return{file:m[0],parent,name};
}
async function read(path){
 const{file}=await find(path);if(!file)throw Error(path+" 不存在");return(await request(API+"/"+file.id+"?alt=media")).blob();
}
async function write(path,blob){
 const{file,parent,name}=await find(path,true),boundary="cosmi_"+crypto.randomUUID();
 const body=new Blob(["--"+boundary+"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"+JSON.stringify(file?{name}:{name,parents:[parent]})+"\r\n",
 "--"+boundary+"\r\nContent-Type: "+(blob.type||"application/octet-stream")+"\r\n\r\n",blob,"\r\n--"+boundary+"--"]);
 const result=await(await request("https://www.googleapis.com/upload/drive/v3/files"+(file?"/"+file.id:"")+"?uploadType=multipart&fields=id,name,size",
 {method:file?"PATCH":"POST",headers:{"Content-Type":"multipart/related; boundary="+boundary},body})).json();
 // A write may change asset metadata or references: never serve a stale package afterward.
 void window.COSMI_DRIVE_CACHE?.clear(accountNamespace);
 return result;
}
const jsonWrite=(path,data)=>write(path,new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
async function walk(id,prefix="",depth=0){
 if(depth>12)throw Error("資產目錄超過 12 層");
 const result=[],names=new Set(),subfolders=[];
 for(const f of await list(id)){
  if(names.has(f.name))throw Error(prefix+f.name+" 名稱重複");names.add(f.name);
  if(/\.zip$/i.test(f.name))continue;
  if(f.mimeType===MIME)subfolders.push(walk(f.id,prefix+f.name+"/",depth+1));
  else result.push({...f,path:prefix+f.name});
 }
 for(const children of await Promise.all(subfolders))result.push(...children);
 return result;
}
async function record(id,reviewIndex){
 const file=reviewIndex?reviewIndex.get(id+".json"):(await find("reviews/"+id+".json")).file;
 return file?JSON.parse(await(await request(API+"/"+file.id+"?alt=media")).text()):null;
}
async function syncPackages({force=false}={}){
 if(syncing)return syncing;if(busy)throw Error("審查寫入中，請稍後重新載入");
 syncing=(async()=>{
  const generation=sessionGeneration,ns=accountNamespace,cache=window.COSMI_DRIVE_CACHE;
  const options=cache?.preferences();
  const errors=[];let count=0,finished=0,next=0;const ids=new Set();
  const cachedRecords=!force&&options?.cacheEnabled&&ns?await cache.getPackages(ns):[];
  const prior=new Map(cachedRecords.map(record=>[record.entry.id,record]));
  const checkSession=()=>{if(generation!==sessionGeneration)throw Error("Google 工作階段已變更");};
  const importPackage=async(dir,entry,files,raw,reviewRecord)=>{
   checkSession();
   const pkg=await window.COSMI_FORGE.loadAssetFiles(raw,{name:entry.name},{silent:true});
   checkSession();
   if(ids.has(pkg.id))throw Error(pkg.id+" 在多個目錄重複");
   ids.add(pkg.id);pkg.drivePath=dir+"/"+entry.name;pkg.driveFolderId=entry.id;pkg.driveFiles=files;
   const glb=files.find(f=>/\.glb$/i.test(f.path));
   if(glb&&!pkg.glbFile)pkg.glbFile={path:glb.path,deferred:true};
   if(reviewRecord){pkg.status=reviewRecord.status;pkg.sourcePack=reviewRecord.source_pack;pkg.reviewRecord=reviewRecord;}
   if(dir.startsWith("03_completed/"))pkg.completed=true;
   return pkg;
  };
  const status=message=>{$("driveStatus").textContent=message;};
  status(cachedRecords.length?"正在顯示本機快取…":"正在取得 Drive 資產清單…");
  window.COSMI_FORGE.clearDrivePackages?.();
  if(cachedRecords.length){
   for(const item of cachedRecords){
    try{await importPackage(item.dir,item.entry,item.files,item.raw,item.reviewRecord || null);}
    catch(e){errors.push("快取 "+item.entry.name+": "+e.message);await cache.removePackage(ns,item.entry.id);}
   }
   window.COSMI_FORGE.refresh();
   status("已從快取顯示 "+ids.size+" 個資產，正在確認雲端更新…");
  }
  const reviewIndexPromise=(async()=>{
   try{
    const reviewFiles=await list(await folder("reviews"));
    return new Map(reviewFiles.filter(f=>f.name.endsWith(".json")).map(f=>[f.name,f]));
   }catch(e){if(!/不存在/.test(e.message))errors.push("reviews: "+e.message);return new Map();}
  })();
  const groups=await Promise.all(dirs.map(async dir=>{
   try{
    const entries=await list(await folder(dir));
    return entries.filter(f=>f.mimeType===MIME&&!f.name.startsWith("_")).map(entry=>({dir,entry}));
   }catch(e){errors.push(dir+": "+e.message);return [];}
  }));
  checkSession();
  const entries=groups.flat(),reviewIndex=await reviewIndexPromise;
  const currentFolders=new Set(entries.map(item=>item.entry.id));
  // Folder removals are not safely observable from local cache; remove any missing folder.
  for(const item of cachedRecords.filter(record=>!currentFolders.has(record.entry.id))){
   await cache.removePackage(ns,item.entry.id);
  }
  if(cachedRecords.some(record=>!currentFolders.has(record.entry.id))){
   window.COSMI_FORGE.clearDrivePackages?.();
   ids.clear();
   for(const item of cachedRecords.filter(record=>currentFolders.has(record.entry.id))){
    try{await importPackage(item.dir,item.entry,item.files,item.raw,item.reviewRecord || null);}
    catch(e){errors.push("快取 "+item.entry.name+": "+e.message);}
   }
   window.COSMI_FORGE.refresh();
  }
  const download=limitConcurrent(6);
  const workers=Array.from({length:Math.min(3,entries.length)},async()=>{
   while(next<entries.length){
    const {dir,entry}=entries[next++];
    try{
     checkSession();
     const files=await walk(entry.id),raw={};
     const old=prior.get(entry.id);
     const fingerprint=items=>JSON.stringify(items.map(f=>[f.id,f.path,f.modifiedTime||"",f.size||""]).sort((a,b)=>a[1].localeCompare(b[1])));
     const reuse=!!old&&fingerprint(old.files)===fingerprint(files);
     if(reuse){
      // Refresh the review record even for a cached asset, since it can change independently.
      const r=await download(()=>record(old.pkgId||entry.name,reviewIndex));
      if(ids.has(old.pkgId||entry.name)){
       const pkg=window.COSMI_FORGE.packages().find(p=>p.driveFolderId===entry.id);
       if(pkg){pkg.driveFiles=files;pkg.status=r?.status||pkg.status;pkg.sourcePack=r?.source_pack||pkg.sourcePack;pkg.reviewRecord=r||pkg.reviewRecord;count++;continue;}
      }
      await importPackage(dir,entry,files,old.raw,r);
      count++;continue;
     }
     const needed=files.filter(f=>/\.(json|md|png|jpe?g|webp)$/i.test(f.name)&&!f.mimeType.startsWith("application/vnd.google-apps."));
     await Promise.all(needed.map(f=>download(async()=>{
      raw[entry.name+"/"+f.path]=new Uint8Array(await(await request(API+"/"+f.id+"?alt=media")).arrayBuffer());
     })));
     if(!Object.keys(raw).length)continue;
     // Avoid rendering the whole review desk for every downloaded file/package.
     const r=await download(()=>record(entry.name,reviewIndex));
     const pkg=await importPackage(dir,entry,files,raw,r);
     if(ns && generation===sessionGeneration)await cache?.putPackage(ns,{dir,entry,files,raw,reviewRecord:r,pkgId:pkg.id});
     count++;
     if(count%5===0)window.COSMI_FORGE.refresh();
    }catch(e){if(generation!==sessionGeneration)throw e;errors.push(entry.name+": "+e.message);}
    finally{
     finished++;
     status("Drive 正在載入 "+finished+"/"+entries.length+" 個資產目錄（成功 "+count+"）");
    }
   }
  });
  await Promise.all(workers);
  checkSession();
  window.COSMI_FORGE.refresh();
  const errorText=errors.length?"；"+errors.slice(0,3).join("；")+(errors.length>3?"；另有 "+(errors.length-3)+" 項錯誤":""):"";
  status("Drive 已載入 "+count+" 個資產目錄"+(cachedRecords.length?"（已使用快取）":"")+errorText);
  return count;
 })().finally(()=>{syncing=null;});return syncing;
}
const modelType=p=>/model|rig|anim/.test(p.type);
async function metadata(id){return(await request(API+"/"+encodeURIComponent(id)+"?fields=id,name,mimeType,parents,trashed")).json();}
async function move(id,from,to){
 const m=await metadata(id);if(m.trashed||!m.parents?.includes(from))throw Error("來源已移動，請重新載入 Drive");
 const p=new URLSearchParams({addParents:to,removeParents:from,fields:"id,name,parents"});
 const r=await(await request(API+"/"+encodeURIComponent(id)+"?"+p,{method:"PATCH"})).json();
 void window.COSMI_DRIVE_CACHE?.clear(accountNamespace);
 if(!r.parents?.includes(to)||r.parents?.includes(from))throw Error("Drive 移動結果未確認");folders.clear();return r;
}
async function review(pkg,status,note=""){
 if(!pkg?.driveFolderId)throw Error("請先將資產資料夾儲存至 Drive");
 if(syncing||busy)throw Error("Drive 處理中，請稍後重試");
 if(!["ok","pending","reject"].includes(status))throw Error("無效審查狀態");
 if(pkg.completed)throw Error("資產已完成，請建立新版本後審查");
 busy=true;
 try{
 const isModel=modelType(pkg),sourceId=pkg.sourcePack||pkg.manifest?.source_pack||"",ops=[];
 const r={task_id:pkg.id,status,source_pack:sourceId,note,time:new Date().toISOString()};
 if(status==="ok"&&!isModel&&!pkg.images?.length)throw Error("立繪必須具有可預覽影像");
 if(status==="reject"){
 const dir="backup/"+(isModel?"rejected_3d":"rejected_portraits")+"/"+pkg.id+"_"+Date.now();
 ops.push({pkg,from:await folder(pkg.drivePath.split("/").slice(0,-1).join("/")),to:await folder(dir,true),path:dir+"/"+pkg.drivePath.split("/").pop()});
 }else if(status==="ok"&&isModel){
 const src=window.COSMI_FORGE.packages().find(p=>p.id===sourceId);
 if(!src||modelType(src)||src.status!=="ok"||!src.images?.length||!src.driveFolderId)throw Error("請先綁定已核准的來源立繪；prompt 建模需補立繪並審查通過");
 if(pkg.glbLoadError)throw Error("GLB 載入失敗，修復後才能完成");
 if(!pkg.glbFile||!pkg.driveFiles.some(f=>f.path.toLowerCase().endsWith(".blend")))throw Error("3D 需同時具有可預覽 GLB 與 .blend 原檔");
 if(pkg.stage&&src.stage&&pkg.stage!==src.stage&&!src.images.some(im=>im.path.includes(pkg.stage)))throw Error("來源立繪與模型型態不符");
 for(const[asset,dir]of[[pkg,"03_completed/models"],[src,"03_completed/portraits"]]){
 if(asset.completed)continue;
 const name=asset.drivePath.split("/").pop(),to=await folder(dir);
 if((await list(to,"name = '"+escapeQuery(name)+"'")).length)throw Error("完成區已有同名資產，請使用新版本 ID");
 ops.push({pkg:asset,from:await folder(asset.drivePath.split("/").slice(0,-1).join("/")),to,path:dir+"/"+name});
 }}
 const done=[];
 try{
 for(const op of ops){await move(op.pkg.driveFolderId,op.from,op.to);done.push(op);}
 r.drive_path=ops.find(o=>o.pkg===pkg)?.path||pkg.drivePath;await jsonWrite("reviews/"+pkg.id+".json",r);
 }catch(e){
 const failures=[];for(const op of done.reverse()){try{await move(op.pkg.driveFolderId,op.to,op.from);}catch(err){failures.push(err.message);}}
 if(failures.length)throw Error(e.message+"；回復未完成，請重新載入核對："+failures.join("；"));throw e;
 }
 for(const op of ops){op.pkg.drivePath=op.path;if(status==="ok")op.pkg.completed=true;}
 pkg.status=status;pkg.reviewRecord=r;window.COSMI_FORGE.persistReview?.(pkg,note);
 if(status==="reject")window.COSMI_FORGE.removePackage?.(pkg.id);
 window.COSMI_FORGE.refresh();
 $("driveStatus").textContent=status==="reject"?"已退件並移至 "+pkg.drivePath:isModel&&status==="ok"?"已核准並將立繪與 3D 移入完成區":"已儲存審查；立繪留在原位";
 return r;
 }finally{busy=false;}
}
async function saveNote(pkg,note){
 if(!pkg?.driveFolderId)throw Error("請先將資產儲存至 Drive");
 if(syncing||busy)throw Error("Drive 處理中，請稍後重試");
 busy=true;
 try{
 const r={...pkg.reviewRecord,task_id:pkg.id,status:pkg.status,source_pack:pkg.sourcePack||pkg.manifest?.source_pack||"",drive_path:pkg.drivePath,note,time:new Date().toISOString()};
 await jsonWrite("reviews/"+pkg.id+".json",r);pkg.reviewRecord=r;window.COSMI_FORGE.persistReview?.(pkg,note);return r;
 }finally{busy=false;}
}
async function uploadAsset(pkg){
 if(!pkg?.rawFiles)throw Error("請先載入資產資料夾");if(pkg.driveFolderId)return pkg.drivePath;
 const dir=modelType(pkg)?"02_3d/"+($("pipelineStage")?.value==="colab"?"colab":"ai_blender"):"01_portraits",path=dir+"/"+pkg.id;
 if((await find(path)).file)throw Error("已有同名資產，請重新載入或使用新版本 ID");
 const keys=Object.keys(pkg.rawFiles),rooted=keys.every(k=>k.startsWith(pkg.id+"/"));
 for(const key of keys){const rel=rooted?key.slice(pkg.id.length+1):key;relative(rel);if(/\.zip$/i.test(rel))throw Error("正式目錄不接受 ZIP");}
 const id=await folder(path,true);
 for(const key of keys){const rel=rooted?key.slice(pkg.id.length+1):key;await write(path+"/"+rel,new Blob([pkg.rawFiles[key]]));}
 pkg.drivePath=path;pkg.driveFolderId=id;pkg.driveFiles=await walk(id);return path;
}

async function ensureWiki(ctx) {
  if(syncing||busy)throw Error("Drive 正在處理其他資產，請稍後再建立圖鑑");
  const wiki=window.COSMI_WIKI.describe(ctx);
  await folder("wiki/"+wiki.kind,true);
  // Name equality and exact folder resolution are the idempotency contract.
  // Existing content is never regenerated or overwritten by another pipeline.
  const existing=(await find(wiki.path)).file;
  if(existing)return {path:wiki.path,created:false,id:existing.id};
  const text=window.COSMI_WIKI.initialMarkdown(ctx);
  const destination=await folder("wiki/"+wiki.kind,true);
  const duplicates=await list(destination,"name = '"+escapeQuery(wiki.path.split("/").pop())+"'");
  if(duplicates.length)return {path:wiki.path,created:false,id:duplicates[0].id};
  const written=await write(wiki.path,new Blob([text],{type:"text/markdown"}));
  return {path:wiki.path,created:true,id:written.id};
}
async function migrateWikis() {
  if(syncing||busy)throw Error("Drive 正在同步或審查，請稍後再執行");
  busy=true;
  const report={sources:0,created:0,skipped:0,archived:0,errors:[]};
  try{
    const oldFolder="04_encyclopedia/creatures";
    const sourceFiles=await list(await folder(oldFolder));
    await folder("wiki/creatures",true);
    await folder("wiki/_legacy/creatures",true);
    const backupId=await folder("wiki/_legacy/creatures");
    const targetId=await folder("wiki/creatures");
    const archiveFiles=await list(backupId);
    const existingArchive=new Set(archiveFiles.map(f=>f.name));
    // Include previously archived family wikis on repeat runs to repair missing stages.
    const candidates=[...sourceFiles,...archiveFiles].filter(f=>/^cr_[a-z0-9_]+_wiki\.md$/.test(f.name));
    const done=new Set();
    for(const file of candidates){
      const id=/^(cr_[a-z0-9_]+)_wiki\.md$/.exec(file.name)[1];
      if(done.has(id))continue;
      done.add(id);report.sources++;
      try{
        let data="";
        if(file.mimeType==="application/vnd.google-apps.document") {
          // Native Docs must be exported, not requested with alt=media.
          const p=new URLSearchParams({mimeType:"text/plain"});
          data=await(await request(API+"/"+file.id+"/export?"+p)).text();
        }else data=await(await request(API+"/"+file.id+"?alt=media")).text();
        if(!data.trim())throw Error("來源圖鑑沒有內容");
        const present=await list(targetId);
        const known=new Set(present.map(f=>f.name));
        let allGood=true;
        for(const stage of window.COSMI_WIKI.STAGES){
          const name=id+"_"+stage+"_wiki.md";
          if(known.has(name)){report.skipped++;continue;}
          try{
            const content=window.COSMI_WIKI.splitLegacy(data,id,stage,file.name);
            await write("wiki/creatures/"+name,new Blob([content],{type:"text/markdown"}));
            const saved=await read("wiki/creatures/"+name);
            if(!(await saved.text()).includes("- stage: "+stage))throw Error("圖鑑回讀不符");
            report.created++;known.add(name);
          }catch(e){allGood=false;report.errors.push(name+": "+e.message);}
        }
        // Never remove legacy bytes. Archive the original only after all stages exist.
        if(allGood&&!existingArchive.has(file.name)){
          const meta=await(await request(API+"/"+file.id+"?fields=parents")).json();
          const previous=(meta.parents||[]).join(",");
          const q=new URLSearchParams({addParents:backupId,removeParents:previous,fields:"id,parents"});
          await request(API+"/"+file.id+"?"+q,{method:"PATCH"});
          existingArchive.add(file.name);report.archived++;
        }
      }catch(e){report.errors.push(id+": "+e.message);}
    }
    void window.COSMI_DRIVE_CACHE?.clear(accountNamespace);
    return report;
  }finally{busy=false;}
}

async function migratePrompt3dAssets() {
 // One-time, idempotent migration of EXISTING original Prompt-to-3D models.
 // No mesh is modified, copied or claimed to have passed geometry/animation QA.
 if(syncing||busy)throw Error("Drive 正在同步或審查，請稍後再執行");
 busy=true;
 const report={total:0,updated:0,skipped:0,errors:[]};
 try {
  const entries=await list(await folder("02_3d/ai_blender"));
  const assets=entries.filter(f=>f.mimeType===MIME&&/^asset_cr_[a-z0-9_]+_(juvenile|adolescent|adult|overload)$/.test(f.name));
  const wikiFiles=await list(await folder("wiki/creatures"));
  const wikiNames=new Set(wikiFiles.map(f=>f.name));
  report.total=assets.length;
  for(const asset of assets){
   try {
    const children=await list(asset.id);
    const modelFolder=children.find(f=>f.mimeType===MIME&&f.name==="models");
    if(!modelFolder){report.skipped++;report.errors.push(asset.name+": 缺 models/");continue;}
    const models=await list(modelFolder.id);
    const glbs=models.filter(f=>/\.glb$/i.test(f.name));
    if(!glbs.length){report.skipped++;report.errors.push(asset.name+": 無 .glb");continue;}
    const modelEntries=models.filter(f=>/\.(glb|blend)$/i.test(f.name)).map(f=>({
     path:"models/"+f.name,kind:"model",level:"L1"
    }));
    const manifestFile=children.find(f=>f.name==="manifest.json"&&f.mimeType!==MIME);
    let manifest={};
    if(manifestFile){
     try{manifest=JSON.parse(await(await request(API+"/"+manifestFile.id+"?alt=media")).text());}
     catch(e){report.skipped++;report.errors.push(asset.name+": 既有 manifest 不可解析；未覆寫");continue;}
     if(!manifest||Array.isArray(manifest)||typeof manifest!=="object"){report.skipped++;continue;}
    }
    const matched=/^asset_(cr_[a-z0-9_]+)_(juvenile|adolescent|adult|overload)$/.exec(asset.name);
    const subject=matched[1], stage=matched[2], wiki=subject+"_"+stage+"_wiki.md";
    const existingEntries=Array.isArray(manifest.files)?manifest.files.filter(e=>e&&typeof e.path==="string"):[];
    const indexed=new Map(existingEntries.map(e=>[e.path,e]));
    for(const entry of modelEntries)indexed.set(entry.path,entry);
    const missing=Array.isArray(manifest.missing)?manifest.missing.filter(e=>e&&typeof e.item==="string"):[];
    const addMissing=(item,reason)=>{if(!missing.some(m=>m.item===item))missing.push({item,level:"L1",reason});};
    if(!models.some(f=>/\.blend$/i.test(f.name)))addMissing(".blend","Only source GLB exists; editable Blender file not found");
    if(!manifest.source_pack)addMissing("source portrait","Prompt-to-3D requires a reviewed post-model portrait");
    if(!children.some(f=>f.name==="rig"))addMissing("rig QA","Rig was not verified from existing model");
    if(!children.some(f=>f.name==="animations"))addMissing("animation QA","Motion clips were not verified from existing model");
    if(!children.some(f=>f.name==="qa"))addMissing("visual QA","Pose/visual QA has not been reviewed");
    if(!wikiNames.has(wiki))addMissing("encyclopedia","Matching stage-specific creature wiki not yet found");
    const next={...manifest,
     spec:manifest.spec||"cosmimera-art-task/1",
     task_id:manifest.task_id||asset.name,
     task_type:manifest.task_type||"creature-model-rig",
     subject_id:manifest.subject_id||subject,
     stage:manifest.stage||stage,
     source_pack:manifest.source_pack||"",
     produced_by:manifest.produced_by||"historical Prompt-to-3D",
     input_mode:"text",pipeline:"ai_blender",
     encyclopedia_path:wikiNames.has(wiki)?"wiki/creatures/"+wiki:"",
     qa_status:"REVIEW_REQUIRED",
     files:[...indexed.values()],missing,
     notes:manifest.notes||"Historical Prompt-to-3D source. Pending manual pose, rig, clip and portrait review."
    };
    if(JSON.stringify(next)===JSON.stringify(manifest)){report.skipped++;continue;}
    // Preserve all historical manifest bytes in a separate backup before update.
    if(manifestFile){
     const backupPath="backup/manifest_snapshots/"+asset.name+".before_prompt3d_migration.json";
     await folder("backup/manifest_snapshots",true);
     if(!(await find(backupPath)).file)await jsonWrite(backupPath,manifest);
    }
    const target="02_3d/ai_blender/"+asset.name+"/manifest.json";
    await jsonWrite(target,next);
    const check=JSON.parse(await(await read(target)).text());
    if(check.task_id!==next.task_id||check.input_mode!=="text")throw Error("Manifest 回讀驗證失敗");
    report.updated++;
   }catch(e){report.errors.push(asset.name+": "+e.message);}
  }
  void window.COSMI_DRIVE_CACHE?.clear(accountNamespace);
  return report;
 }finally{busy=false;}
}

async function run(action){try{return await action();}catch(e){$("driveStatus").textContent=e.message;}}
async function authorize(response,restoredSession=null){
 if(response.error||!response.access_token){$("driveGateStatus").textContent=response.error_description||response.error||"Google 登入失敗";return;}
 try{
 accessToken=response.access_token;expiry=restoredSession?.expiry??(Date.now()+Number(response.expires_in||3600)*1000);
 const root=await metadata(config.rootId);if(root.trashed||root.mimeType!==MIME)throw Error("Drive 專案資料夾無法存取");
 // A permission ID is stable for this account. Never mix cached data between Google accounts.
 let permissionId="";
 try{const about=await(await request("https://www.googleapis.com/drive/v3/about?fields=user(permissionId)")).json();
  permissionId=about.user?.permissionId||"";}catch(_){}
 accountNamespace=window.COSMI_DRIVE_CACHE?.namespace(config.rootId,permissionId)||"";
 // Persist only after Drive permissions have been validated.
 saveSession();
 expiryTimer=setTimeout(()=>lock("登入已到期，請重新登入 Google"),Math.max(0,expiry-Date.now()));
 // Unlock the UI as soon as folder permission is verified; synchronize assets afterward.
 if(!initialized){window.dispatchEvent(new Event("cosmi:authorized"));initialized=true;}
 $("driveGate").hidden=true;$("driveApp").hidden=false;
 $("driveStatus").textContent="已登入，正在讀取雲端資料…";
 if(window.COSMI_PIPELINE){
  Promise.resolve().then(()=>window.COSMI_PIPELINE.loadTemplates()).then(()=>window.COSMI_FORGE.refresh()).catch(e=>{
   $("driveStatus").textContent+="；管線模板讀取失敗："+e.message;
  });
 }
 if(window.COSMI_DRIVE_CACHE?.preferences().autoSync!==false)await run(()=>syncPackages());
 else $("driveStatus").textContent="已登入，已依設定暫停自動同步；可手動重新載入 Drive。";
 }catch(e){lock(e.message);}
}
window.COSMI_DRIVE=Object.freeze({relative,read,write,folder,list,move,review,saveNote,uploadAsset,syncPackages,migratePrompt3dAssets,migrateWikis,ensureWiki,
 cacheStats:()=>window.COSMI_DRIVE_CACHE?.stats(accountNamespace)||Promise.resolve({count:0,bytes:0,supported:false}),
 clearCache:async()=>{await window.COSMI_DRIVE_CACHE?.clear(accountNamespace);return true;},
 signOut:()=>lock("已登出"),rootPath:config.rootPath,
 packageDir:type=>/model|rig|anim/.test(type)?"02_3d/ai_blender":"01_portraits"});
document.addEventListener("DOMContentLoaded",()=>{
 $("driveSignIn").addEventListener("click",()=>{
 if(window.location?.protocol==="file:"){$("driveGateStatus").textContent="本機請先以 http://localhost:8000 啟動網頁，不能直接開啟 HTML 檔。";return;}
 if(!config.clientId){$("driveGateStatus").textContent="尚未設定 Google 登入，請設定 GOOGLE_OAUTH_CLIENT_ID 後部署。";return;}
 if(!window.google?.accounts?.oauth2){$("driveGateStatus").textContent="Google 登入元件尚未載入，請稍後重試。";return;}
 tokenClient ||= google.accounts.oauth2.initTokenClient({client_id:config.clientId,scope:"https://www.googleapis.com/auth/drive",callback:authorize,
 error_callback:e=>{$("driveGateStatus").textContent=e.type==="popup_closed"?"登入視窗已關閉":"Google 登入視窗無法開啟";}});
 tokenClient.requestAccessToken({prompt:"select_account"});
 });
 $("driveSync").addEventListener("click",()=>run(()=>syncPackages({force:true})));
 $("settingsMigrateWiki")?.addEventListener("click",()=>{
  if(!window.confirm("將現有 15 份系列圖鑑拆成各型態獨立 Markdown？原圖鑑移至 wiki/_legacy 備份；既有階段圖鑑不覆寫。"))return;
  run(async()=>{
    $("driveStatus").textContent="正在依型態拆分圖鑑…";
    const report=await migrateWikis();
    $("driveStatus").textContent="圖鑑整理："+report.created+" 新增、"+report.skipped+" 既有、"+report.archived+" 備份；"+report.errors.length+" 項錯誤";
    $("settingsMessage").textContent=report.errors.slice(0,6).join("；")||"各型態圖鑑已整理，原始系列文件保留於 wiki/_legacy。";
  });
 });
 $("settingsMigratePrompt3d")?.addEventListener("click",()=>{
  if(!window.confirm("整理 02_3d/ai_blender 的歷史 Prompt-to-3D 資產描述檔？原 GLB/Blend 不會修改；既有 manifest 先備份，全部保持待審狀態。"))return;
  run(async()=>{
   $("driveStatus").textContent="正在建立 Prompt-to-3D 資產索引…";
   const report=await migratePrompt3dAssets();
   $("driveStatus").textContent="Prompt-to-3D 整理："+report.updated+" 已更新、"+report.skipped+" 跳過、"+report.errors.length+" 項待檢查";
   $("settingsMessage").textContent=report.errors.slice(0,8).join("；")||"歷史模型已建立待審索引，未自動核准。";
   await syncPackages({force:true});
  });
 });
 $("driveSavePrompt").addEventListener("click",()=>{if(["portrait","portrait_3d"].includes($("pipelineStage").value)&&!window.COSMI_PIPELINE?.isPortraitAuto())return;run(async()=>{const{path,text}=window.COSMI_FORGE.currentPrompt();await write(path,new Blob([text],{type:"text/markdown"}));$("driveStatus").textContent="已儲存 "+path;});});
 $("driveLoadPrompt").addEventListener("click",()=>run(async()=>{const path=$("drivePromptPath").value.trim();if(!path.startsWith("prompts/")||!path.endsWith(".md"))throw Error("請輸入 prompts/ 下的 Markdown 相對路徑");window.COSMI_FORGE.showPrompt(await(await read(path)).text());$("driveStatus").textContent="已讀取 "+path;}));
 $("pipelineRead").addEventListener("click",()=>{
  if(["portrait","portrait_3d"].includes($("pipelineStage").value)){
   if(!window.COSMI_PIPELINE?.isPortraitAuto()){$("copy").click();return;}
   run(async()=>{
    const {path,text}=window.COSMI_FORGE.currentPrompt();
    await write(path,new Blob([text],{type:"text/markdown"}));
    $("drivePromptPath").value=path;
    $("driveStatus").textContent="立繪管線已建立並上傳 "+path;
   });
   return;
  }
  run(async()=>{const key=$("pipelineStage").value;
   if(key==="encyclopedia"){
     const ctx=window.COSMI_FORGE.currentContext?.();
     if(!ctx)throw Error("目前沒有可用的圖鑑概念設定");
     const wiki=await ensureWiki(ctx);
     window.COSMI_FORGE.showPrompt(window.COSMI_FORGE.currentPrompt().text);
     $("driveStatus").textContent=(wiki.created?"已建立":"已存在，未重複生成")+" "+wiki.path;
     return;
   }
   if(["appearance","portrait","review_portrait","colab","blender","review_3d","portrait_3d","move_vfx"].includes(key)){
     const context=window.COSMI_FORGE.currentContext?.();
     if(context)await ensureWiki(context);
   }
   const name=window.COSMI_PIPELINE.stages[key];window.COSMI_PIPELINE.templates[key]=await(await read("prompts/"+name+".prompt.md")).text();window.COSMI_FORGE.refresh();window.COSMI_FORGE.showPrompt(window.COSMI_FORGE.currentPrompt().text);});
 });
 $("pipelineSaveSettings").addEventListener("click",()=>run(async()=>{
 const d=window.COSMI_FORGE.settings(),p=window.COSMI_PIPELINE.parameters();
 await jsonWrite("00_settings/"+d.assetId+".parameters.json",{...p,delivery:d.delivery});
 $("driveStatus").textContent="已儲存格式參數（外觀由概念參數提供）";
 }));
 $("pipelineLoadSettings").addEventListener("click",()=>run(async()=>{
 const id=window.COSMI_FORGE.settings().assetId,p=await(await read("00_settings/"+id+".parameters.json")).text();
 JSON.parse(p);$("pipelineParameters").value=p;window.COSMI_PIPELINE.parameters();
 window.COSMI_FORGE.refresh();$("driveStatus").textContent="已載入格式參數";
 }));
 $("pipelineBindSource").addEventListener("click",()=>run(async()=>{
 const pkg=window.COSMI_FORGE.activePackage(),id=$("pipelineSource").value.trim(),src=window.COSMI_FORGE.packages().find(p=>p.id===id&&!modelType(p));
 if(!pkg?.driveFolderId||!modelType(pkg)||pkg.completed||!src)throw Error("請選取待審 3D 並填入已載入的立繪資產 ID");
 await jsonWrite("reviews/"+pkg.id+".json",{task_id:pkg.id,status:pkg.status,source_pack:id,time:new Date().toISOString()});pkg.sourcePack=id;window.COSMI_FORGE.refresh();$("driveStatus").textContent="已綁定來源立繪 "+id;
 }));
 $("driveUploadPackage").addEventListener("click",()=>run(async()=>{$("driveStatus").textContent="已儲存資產目錄 "+await uploadAsset(window.COSMI_FORGE.activePackage());}));
 const saved=readSession();
 if(saved){
  $("driveGateStatus").textContent="正在恢復 Google Drive 登入…";
  void authorize({access_token:saved.accessToken},saved);
 }else{
  $("driveGateStatus").textContent=window.location?.protocol==="file:"?"本機請先以 http://localhost:8000 啟動網頁，不能直接開啟 HTML 檔。":config.clientId?"登入後可讀取你有權限的專案資產。":"尚未設定 Google 登入，請設定 GOOGLE_OAUTH_CLIENT_ID 後部署。";
 }
});
})();
