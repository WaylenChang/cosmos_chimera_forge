// Private Drive assets use directories; archives are import-only.
(function () {
"use strict";
const config=window.COSMI_DRIVE_CONFIG, API="https://www.googleapis.com/drive/v3/files", MIME="application/vnd.google-apps.folder";
let accessToken="",expiry=0,expiryTimer,tokenClient,initialized=false,syncing,busy=false;
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
 accessToken="";expiry=0;folders.clear();clearTimeout(expiryTimer);clearSavedSession();
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
 return(await request("https://www.googleapis.com/upload/drive/v3/files"+(file?"/"+file.id:"")+"?uploadType=multipart&fields=id,name,size",
 {method:file?"PATCH":"POST",headers:{"Content-Type":"multipart/related; boundary="+boundary},body})).json();
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
async function syncPackages(){
 if(syncing)return syncing;if(busy)throw Error("審查寫入中，請稍後重新載入");
 syncing=(async()=>{
  const errors=[];let count=0,finished=0,next=0;const ids=new Set();
  const status=message=>{$("driveStatus").textContent=message;};
  status("正在取得 Drive 資產清單…");
  window.COSMI_FORGE.clearDrivePackages?.();
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
  const entries=groups.flat(),reviewIndex=await reviewIndexPromise;
  const download=limitConcurrent(6);
  const workers=Array.from({length:Math.min(3,entries.length)},async()=>{
   while(next<entries.length){
    const {dir,entry}=entries[next++];
    try{
     const files=await walk(entry.id),raw={};
     const needed=files.filter(f=>/\.(json|md|png|jpe?g|webp)$/i.test(f.name)&&!f.mimeType.startsWith("application/vnd.google-apps."));
     await Promise.all(needed.map(f=>download(async()=>{
      raw[entry.name+"/"+f.path]=new Uint8Array(await(await request(API+"/"+f.id+"?alt=media")).arrayBuffer());
     })));
     if(!Object.keys(raw).length)continue;
     // Avoid rendering the whole review desk for every downloaded file/package.
     const pkg=await window.COSMI_FORGE.loadAssetFiles(raw,{name:entry.name},{silent:true});
     if(ids.has(pkg.id))throw Error(pkg.id+" 在多個目錄重複");ids.add(pkg.id);
     pkg.drivePath=dir+"/"+entry.name;pkg.driveFolderId=entry.id;pkg.driveFiles=files;
     // Large GLB files are downloaded only when the user opens their 3D preview.
     const glb=files.find(f=>/\.glb$/i.test(f.path));
     if(glb&&!pkg.glbFile)pkg.glbFile={path:glb.path,deferred:true};
     const r=await download(()=>record(pkg.id,reviewIndex));
     if(r){pkg.status=r.status;pkg.sourcePack=r.source_pack;pkg.reviewRecord=r;}
     if(dir.startsWith("03_completed/"))pkg.completed=true;
     count++;
     if(count%5===0)window.COSMI_FORGE.refresh();
    }catch(e){errors.push(entry.name+": "+e.message);}
    finally{
     finished++;
     status("Drive 正在載入 "+finished+"/"+entries.length+" 個資產目錄（成功 "+count+"）");
    }
   }
  });
  await Promise.all(workers);
  window.COSMI_FORGE.refresh();
  const errorText=errors.length?"；"+errors.slice(0,3).join("；")+(errors.length>3?"；另有 "+(errors.length-3)+" 項錯誤":""):"";
  status("Drive 已載入 "+count+" 個資產目錄"+errorText);
  return count;
 })().finally(()=>{syncing=null;});return syncing;
}
const modelType=p=>/model|rig|anim/.test(p.type);
async function metadata(id){return(await request(API+"/"+encodeURIComponent(id)+"?fields=id,name,mimeType,parents,trashed")).json();}
async function move(id,from,to){
 const m=await metadata(id);if(m.trashed||!m.parents?.includes(from))throw Error("來源已移動，請重新載入 Drive");
 const p=new URLSearchParams({addParents:to,removeParents:from,fields:"id,name,parents"});
 const r=await(await request(API+"/"+encodeURIComponent(id)+"?"+p,{method:"PATCH"})).json();
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
async function run(action){try{return await action();}catch(e){$("driveStatus").textContent=e.message;}}
async function authorize(response,restoredSession=null){
 if(response.error||!response.access_token){$("driveGateStatus").textContent=response.error_description||response.error||"Google 登入失敗";return;}
 try{
 accessToken=response.access_token;expiry=restoredSession?.expiry??(Date.now()+Number(response.expires_in||3600)*1000);
 const root=await metadata(config.rootId);if(root.trashed||root.mimeType!==MIME)throw Error("Drive 專案資料夾無法存取");
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
 await run(syncPackages);
 }catch(e){lock(e.message);}
}
window.COSMI_DRIVE=Object.freeze({relative,read,write,folder,list,move,review,saveNote,uploadAsset,syncPackages,rootPath:config.rootPath,
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
 $("driveSignOut").addEventListener("click",()=>lock("已登出"));
 $("driveSync").addEventListener("click",()=>run(syncPackages));
 $("driveSavePrompt").addEventListener("click",()=>{if($("pipelineStage").value==="portrait"&&!window.COSMI_PIPELINE?.isPortraitAuto())return;run(async()=>{const{path,text}=window.COSMI_FORGE.currentPrompt();await write(path,new Blob([text],{type:"text/markdown"}));$("driveStatus").textContent="已儲存 "+path;});});
 $("driveLoadPrompt").addEventListener("click",()=>run(async()=>{const path=$("drivePromptPath").value.trim();if(!path.startsWith("prompts/")||!path.endsWith(".md"))throw Error("請輸入 prompts/ 下的 Markdown 相對路徑");window.COSMI_FORGE.showPrompt(await(await read(path)).text());$("driveStatus").textContent="已讀取 "+path;}));
 $("pipelineRead").addEventListener("click",()=>{
  if($("pipelineStage").value==="portrait"){
   if(!window.COSMI_PIPELINE?.isPortraitAuto()){$("copy").click();return;}
   run(async()=>{
    const {path,text}=window.COSMI_FORGE.currentPrompt();
    await write(path,new Blob([text],{type:"text/markdown"}));
    $("drivePromptPath").value=path;
    $("driveStatus").textContent="立繪管線已建立並上傳 "+path;
   });
   return;
  }
  run(async()=>{const key=$("pipelineStage").value,name=window.COSMI_PIPELINE.stages[key];window.COSMI_PIPELINE.templates[key]=await(await read("prompts/"+name+".prompt.md")).text();window.COSMI_FORGE.refresh();window.COSMI_FORGE.showPrompt(window.COSMI_FORGE.currentPrompt().text);});
 });
 $("pipelineSaveSettings").addEventListener("click",()=>run(async()=>{
 const d=window.COSMI_FORGE.settings(),p=window.COSMI_PIPELINE.parameters();
 await write("00_settings/"+d.assetId+".appearance.md",new Blob([d.appearance],{type:"text/markdown"}));await jsonWrite("00_settings/"+d.assetId+".parameters.json",{...p,delivery:d.delivery});$("driveStatus").textContent="已分別儲存外觀設定與格式參數";
 }));
 $("pipelineLoadSettings").addEventListener("click",()=>run(async()=>{
 const id=window.COSMI_FORGE.settings().assetId,a=await(await read("00_settings/"+id+".appearance.md")).text(),p=await(await read("00_settings/"+id+".parameters.json")).text();
 JSON.parse(p);$("pipelineAppearance").value=a;$("pipelineParameters").value=p;window.COSMI_PIPELINE.parameters();window.COSMI_FORGE.refresh();$("driveStatus").textContent="已載入外觀與參數";
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
