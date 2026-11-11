const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
function forge(){
 const toast={classList:{add(){},remove(){}},textContent:''};
 const c={Blob,URL,TextDecoder,TextEncoder,Uint8Array,ArrayBuffer,DataView,File,crypto,
  console:{log(){},warn(){},error(){}},setTimeout(){return 1;},clearTimeout(){},
  localStorage:{getItem(){return null;},setItem(){}},
  document:{addEventListener(){},querySelector:s=>s==='#toast'?toast:null,getElementById(){return null;}},
  addEventListener(){}};c.window=c;
 for(const file of ['catalog.js','tasks.js','designed.js','pipeline.js','forge.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),c,{filename:file});
 return c.COSMI_FORGE;
}
test('directory loader preserves actual files and does not inject a legacy staged prompt',async()=>{
 const f=forge(),encode=x=>new TextEncoder().encode(JSON.stringify(x)),raw={
  'mdl-one/manifest.json':encode({task_id:'mdl-one',task_type:'creature-model-rig',subject_id:'beast',stage:'juvenile',source_pack:'portrait-one',files:[],missing:[]}),
  'mdl-one/models/beast.glb':new Uint8Array([1,2,3]),
  'mdl-one/images/front.png':new Uint8Array([4,5,6])};
 const pkg=await f.loadAssetFiles(raw,{name:'mdl-one'});
 assert.equal(pkg.id,'mdl-one');assert.equal(pkg.type,'creature-model-rig');assert.equal(pkg.stage,'juvenile');
 assert.equal(pkg.groupKey,'portrait-one');assert.equal(pkg.images.length,1);assert.ok(pkg.glbFile);assert.equal(pkg.isZip,false);
 assert.equal(Object.keys(raw).length,3);assert.equal(pkg.aligned,false);assert.equal(pkg.rawPrompt,'');
});
test('four model stages sharing one source appear under one review group',async()=>{
 const f=forge();let key;
 for(const stage of ['juvenile','adolescent','adult','overload']){
  const id='mdl-'+stage;
  const raw={[id+'/manifest.json']:new TextEncoder().encode(JSON.stringify({task_id:id,task_type:'creature-model-rig',subject_id:'beast',stage,source_pack:'portrait-one',missing:[]}))};
  const p=await f.loadAssetFiles(raw,{name:id});key??=p.groupKey;assert.equal(p.groupKey,key);assert.equal(p.stage,stage);
 }
 assert.equal(f.packages().length,4);
});
