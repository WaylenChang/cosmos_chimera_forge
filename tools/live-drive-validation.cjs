// Runs production modules against real Drive through the MCP transport adapter.
// OAuth/CORS/browser rendering are deliberately not simulated as verified.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const readline=require('node:readline');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const workspace=path.join(root,'Art/_incoming/live_drive_validation');
fs.mkdirSync(workspace,{recursive:true});
const scopeId=process.argv[2];if(!scopeId)throw Error('Isolated Drive root ID required');
const pending=new Map();let seq=0;
const rl=readline.createInterface({input:process.stdin});
rl.on('line',line=>{try{const m=JSON.parse(line);if(m.reply&&pending.has(m.reply)){pending.get(m.reply)(m);pending.delete(m.reply);}}catch{}});
function rpc(op){return new Promise(resolve=>{const id=++seq;pending.set(id,resolve);process.stdout.write('@@RPC@@'+JSON.stringify({id,...op})+'\n');});}
async function transport(url,options={}){
 const u=new URL(url),method=options.method||'GET';let op;
 assert.equal(u.hostname,'www.googleapis.com');
 if(method==='GET'&&u.searchParams.has('q')){
  const q=u.searchParams.get('q'),unescape=s=>s?.replace(/\\(.)/g,'$1');
  const parent=q.match(/^'((?:\\.|[^'])*)' in parents/),name=q.match(/ and name = '((?:\\.|[^'])*)'/),mime=q.match(/ and mimeType = '([^']+)'/);
  if(!parent)throw Error('Unexpected list query');op={op:'list',parent:unescape(parent[1]),name:unescape(name?.[1]),mime:mime?.[1]};
 }else if(method==='GET'&&u.searchParams.get('alt')==='media')op={op:'read',fileId:u.pathname.split('/').pop(),target:path.join(workspace,'download-'+(seq+1)+'.bin')};
 else if(method==='GET')op={op:'metadata',fileId:u.pathname.split('/').pop()};
 else if(method==='PATCH'&&u.searchParams.has('addParents'))op={op:'move',fileId:u.pathname.split('/').pop(),addParents:u.searchParams.get('addParents'),removeParents:u.searchParams.get('removeParents')};
 else if(u.pathname.startsWith('/upload/')){
  const body=Buffer.from(await options.body.arrayBuffer()),boundary=options.headers.get('Content-Type').split('boundary=')[1];
  const first=body.indexOf('\r\n\r\n')+4,separator=body.indexOf('\r\n--'+boundary,first);
  const metadata=JSON.parse(body.subarray(first,separator).toString('utf8'));
  const secondStart=body.indexOf('\r\n\r\n',separator)+4,end=body.lastIndexOf('\r\n--'+boundary+'--');
  assert.ok(first>3&&separator>first&&secondStart>separator&&end>=secondStart);
  const mime=body.subarray(separator,secondStart).toString().match(/Content-Type: ([^\r\n]+)/)[1];
  const file=path.join(workspace,'upload-'+(seq+1)+'.bin');fs.writeFileSync(file,body.subarray(secondStart,end));
  op={op:'write',fileId:method==='PATCH'?u.pathname.split('/').pop():null,name:metadata.name,parent:metadata.parents?.[0],mime,file};
 }else if(method==='POST'){
  const m=JSON.parse(options.body);assert.equal(m.mimeType,'application/vnd.google-apps.folder');op={op:'mkdir',name:m.name,parent:m.parents[0]};
 }else throw Error('Unexpected request '+method+' '+u.pathname);
 if(failMoveOnce&&op.op==='move'&&op.fileId===failMoveOnce){failMoveOnce='';return Response.json({error:{message:'injected source move failure'}},{status:503});}
 const response=await rpc(op);
 if(response.status>=400)return Response.json({error:{message:response.error}},{status:response.status});
 if(op.op==='metadata'&&op.fileId===scopeId&&!response.data?.name?.startsWith('_live_validation_'))throw Error('Refusing to test a non-isolated Drive root');
 if(op.op==='read')return new Response(fs.readFileSync(response.file));
 return Response.json(response.data);
}
const nodes={};const node=id=>nodes[id]??={value:id==='pipelineStage'?'portrait':'',hidden:false,textContent:'',listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}};
let auth,selected='',failMoveOnce='';
function actualForge(){
 const toast={classList:{add(){},remove(){}}};
 const c={Blob,File,URL,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,DataView,crypto,console:{log(){},warn(){},error(){}},setTimeout(){return 1;},clearTimeout(){},localStorage:{getItem(){return null;},setItem(){}},document:{addEventListener(){},querySelector:s=>s==='#toast'?toast:null,getElementById(){return null;}},addEventListener(){}};c.window=c;
 for(const file of ['catalog.js','tasks.js','designed.js','pipeline.js','model-review.js','forge.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),c,{filename:file});return c.COSMI_FORGE;
}
const forge=actualForge();
const ctx={task:{id:'creature-concept'},taskId:'cr_live_prompt',subjectId:'test_transport',concept:{appearance:'isolated transport fixture'},opts:{stage:'adult'}};
const c={Blob,File,Headers,URLSearchParams,TextEncoder,TextDecoder,Event,crypto,Date,fetch:transport,setTimeout(){return 1;},clearTimeout(){},
 document:{getElementById:node,addEventListener(_,fn){fn();}},dispatchEvent(){},location:{reload(){}},
 COSMI_DRIVE_CONFIG:{clientId:'123-adapter-only.apps.googleusercontent.com',rootId:scopeId,rootPath:'isolated-live-validation'},
 google:{accounts:{oauth2:{initTokenClient(o){auth=o.callback;return{requestAccessToken(){}};}}}}};c.window=c;
c.COSMI_FORGE={...forge,refresh(){},activePackage:()=>forge.packages().find(p=>p.id===selected)||forge.activePackage(),showPrompt:text=>{c.displayedPrompt=text;},currentPrompt:()=>({path:'prompts/jobs/'+ctx.taskId+'.prompt.md',text:c.COSMI_PIPELINE.build(ctx)}),settings:()=>({assetId:ctx.taskId,subjectId:ctx.subjectId,appearance:c.COSMI_PIPELINE.appearance(ctx),delivery:{task_id:ctx.taskId,task_type:ctx.task.id,subject_id:ctx.subjectId}})};
for(const file of ['pipeline.js','drive-storage.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),c,{filename:file});
const results=[],issues=[];
const record=(name,data={})=>{results.push({name,...data});process.stdout.write('@@CHECK@@'+JSON.stringify({name,...data})+'\n');};
const D=c.COSMI_DRIVE;
const jsonBlob=x=>new Blob([JSON.stringify(x)],{type:'application/json'});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2XioAAAAASUVORK5CYII=','base64');
const run=crypto.randomUUID().slice(0,8),ids={source:'cr_live_'+run,reject:'cr_live_reject_'+run,model:'mdl_live_'+run,rejectModel:'mdl_live_reject_'+run,duplicate:'cr_live_duplicate_'+run};
const readJSON=async p=>JSON.parse(await(await D.read(p)).text());
const meta=async id=>(await transport('https://www.googleapis.com/drive/v3/files/'+id)).json();
async function fixture(id,model=false,source=''){
 const base=(model?'02_3d/ai_blender/':'01_portraits/')+id;
 await D.write(base+'/manifest.json',jsonBlob({task_id:id,task_type:model?'creature-model-rig':'creature-concept',subject_id:'test_transport',stage:'adult',source_pack:source,files:[],missing:[],notes:'ISOLATED CONNECTOR INTEGRATION TEST; not a production approval'}));
 if(model){await D.write(base+'/models/fixture.glb',new Blob([fs.readFileSync(path.join(workspace,'fixture.glb'))],{type:'model/gltf-binary'}));await D.write(base+'/models/fixture.blend',new Blob([fs.readFileSync(path.join(workspace,'fixture.blend'))]));}
 else await D.write(base+'/images/front.png',new Blob([png],{type:'image/png'}));
 return base;
}
async function main(){
 node('driveSignIn').listeners.click();await auth({access_token:'transport-adapter-not-browser-oauth',expires_in:3600});
 assert.equal(node('driveApp').hidden,false,node('driveGateStatus').textContent);record('managed-connector app initialization; browser OAuth not tested');
 const pathMD='prompts/jobs/roundtrip_'+run+'.prompt.md';
 await D.write(pathMD,new Blob(['# 讀寫測試\n第一版'],{type:'text/markdown'}));
 const before=(await D.list(await D.folder('prompts/jobs'))).find(x=>x.name===pathMD.split('/').pop()).id;
 assert.equal(await(await D.read(pathMD)).text(),'# 讀寫測試\n第一版');
 await D.write(pathMD,new Blob(['# 讀寫測試\n第二版'],{type:'text/markdown'}));
 assert.equal(await(await D.read(pathMD)).text(),'# 讀寫測試\n第二版');
 assert.equal((await D.list(await D.folder('prompts/jobs'))).find(x=>x.name===pathMD.split('/').pop()).id,before);record('Markdown create/read/update preserves Drive ID',{fileId:before});
 await node('pipelineRead').listeners.click();assert.match(c.displayedPrompt,/生成立繪/);assert.doesNotMatch(c.displayedPrompt,/\{\{/);record('Drive stage prompt read and template expansion');
 await node('pipelineSaveSettings').listeners.click();
 assert.equal((await readJSON('00_settings/'+ctx.taskId+'.parameters.json')).delivery.task_id,ctx.taskId);record('separate appearance Markdown and parameters JSON write');
 await fixture(ids.source);await fixture(ids.reject);await fixture(ids.model,true,ids.source);await fixture(ids.rejectModel,true,ids.source);
 await D.syncPackages();const pick=id=>{const p=forge.packages().find(p=>p.id===id);assert.ok(p?.driveFolderId,id);return p;};
 const src=pick(ids.source),model=pick(ids.model),rej=pick(ids.reject),rejModel=pick(ids.rejectModel);
 const portraitParent=(await meta(src.driveFolderId)).parents[0];
 await D.review(src,'ok','isolated portrait pass');assert.equal((await meta(src.driveFolderId)).parents[0],portraitParent);record('portrait approval stays in place');
 selected=model.id;await D.saveNote(model,'preserve this review note');node('pipelineSource').value=src.id;
 await node('pipelineBindSource').listeners.click();const bound=await readJSON('reviews/'+model.id+'.json');
 if(bound.note!=='preserve this review note')issues.push({code:'binding_erases_note',actual:bound});else record('source binding preserves review note');
 const originalParent=(await meta(model.driveFolderId)).parents[0];failMoveOnce=src.driveFolderId;
 await assert.rejects(D.review(model,'ok','failure injection'),/injected source move failure/);
 assert.equal((await meta(model.driveFolderId)).parents[0],originalParent);assert.equal((await meta(src.driveFolderId)).parents[0],portraitParent);record('injected second move failure rolls back real first move');
 await D.review(model,'ok','isolated final pass');
 assert.equal((await meta(model.driveFolderId)).parents[0],await D.folder('03_completed/models'));
 assert.equal((await meta(src.driveFolderId)).parents[0],await D.folder('03_completed/portraits'));
 assert.equal((await readJSON('reviews/'+model.id+'.json')).status,'ok');record('final approval moves both original folder IDs',{modelFolder:model.driveFolderId,portraitFolder:src.driveFolderId});
 await D.review(rej,'reject','isolated portrait rejection');assert.match(rej.drivePath,/^backup\/rejected_portraits\//);assert.equal((await meta(rej.driveFolderId)).parents[0],await D.folder(rej.drivePath.split('/').slice(0,-1).join('/')));record('portrait rejection moves to backup');
 await D.review(rejModel,'reject','isolated model rejection');assert.match(rejModel.drivePath,/^backup\/rejected_3d\//);assert.equal((await meta(src.driveFolderId)).parents[0],await D.folder('03_completed/portraits'));record('model rejection preserves approved portrait');
 await fixture(ids.duplicate);
 await D.write('01_portraits/'+ids.duplicate+'_copy/manifest.json',jsonBlob({task_id:ids.duplicate,task_type:'creature-concept',subject_id:'duplicate_test',files:[],missing:[]}));
 await D.write('01_portraits/'+ids.duplicate+'_copy/images/front.png',new Blob([png],{type:'image/png'}));
 await D.syncPackages();const dup=forge.packages().find(p=>p.id===ids.duplicate);
 if(!dup?.driveFolderId)issues.push({code:'duplicate_id_replaces_valid_package',status:node('driveStatus').textContent});else record('duplicate ID does not replace valid Drive-backed package');
 const result={scopeId,run,results,issues,requests:seq,browser_oauth_verified:false,transport:'production JavaScript with managed Drive connector adapter'};
 fs.writeFileSync(path.join(workspace,'result-'+run+'.json'),JSON.stringify(result,null,2));
 process.stdout.write('@@RESULT@@'+JSON.stringify(result)+'\n');rl.close();process.exit(issues.length?2:0);
}
main().catch(e=>{process.stdout.write('@@FATAL@@'+JSON.stringify({message:e.message,stack:e.stack,requests:seq,issues,results})+'\n');rl.close();process.exit(1);});
