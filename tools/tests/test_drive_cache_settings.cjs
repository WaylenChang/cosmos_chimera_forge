const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const cacheSource=fs.readFileSync(path.join(root,'drive-cache.js'),'utf8');
const driveSource=fs.readFileSync(path.join(root,'drive-storage.js'),'utf8');
const settingsSource=fs.readFileSync(path.join(root,'settings.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

function fixture(){
 const saved=new Map();
 const context={
  localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)},
  indexedDB:null,Date
 };
 context.window=context;
 vm.runInNewContext(cacheSource,context);
 return context.COSMI_DRIVE_CACHE;
}
test('default cache preferences and user edits are persisted and validated',()=>{
 const cache=fixture();
 assert.equal(cache.preferences().cacheEnabled,true);
 assert.equal(cache.preferences().autoSync,true);
 assert.equal(cache.preferences().ttlMinutes,60);
 cache.updatePreferences({cacheEnabled:false,autoSync:false,ttlMinutes:360});
 assert.equal(cache.preferences().cacheEnabled,false);
 assert.equal(cache.preferences().autoSync,false);
 assert.equal(cache.preferences().ttlMinutes,360);
 cache.updatePreferences({ttlMinutes:123456});
 assert.equal(cache.preferences().ttlMinutes,360);
});
test('cache namespace requires verified account permission and project root',()=>{
 const cache=fixture();
 assert.equal(cache.namespace('root',''), '');
 assert.equal(cache.namespace('', 'user'),'');
 assert.notEqual(cache.namespace('root','user-a'),cache.namespace('root','user-b'));
 assert.notEqual(cache.namespace('root-a','user'),cache.namespace('root-b','user'));
});
test('private cache safely degrades if browser IndexedDB is unavailable',async()=>{
 const cache=fixture(),ns=cache.namespace('root','user-a');
 assert.equal((await cache.getPackages(ns)).length,0);
 assert.equal(await cache.putPackage(ns,{entry:{id:'a'},raw:{'a/x.png':new Uint8Array([1,2])}}),false);
 assert.equal((await cache.stats(ns)).supported,false);
});
test('Drive restores cached previews after OAuth verification and checks current cloud metadata',()=>{
 assert.match(driveSource,/accountNamespace=window\.COSMI_DRIVE_CACHE\?\.namespace\(config\.rootId,permissionId\)/);
 assert.match(driveSource,/getPackages\(ns\)/);
 assert.match(driveSource,/importPackage\(item\.dir,item\.entry,item\.files,item\.raw/);
 assert.match(driveSource,/fingerprint\(old\.files\)===fingerprint\(files\)/);
 assert.match(driveSource,/syncPackages\(\{force:true\}\)/);
 assert.match(driveSource,/sessionGeneration\+\+/);
 assert.match(driveSource,/\.clear\(previousNamespace\)/);
});
test('settings has accessible responsive controls and is present in production allowlist',()=>{
 for(const id of ['viewBtnSettings','settingsView','settingsCacheEnabled','settingsAutoSync',
  'settingsCacheTTL','settingsClearCache','settingsSignOut',
  'settingsPortraitMode','settingsToolVersion','settingsCatalogVersion','settingsCheckVersion']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/#settingsView\.active\s*\{\s*display:block/);
 assert.match(settingsSource,/COSMI_DRIVE\?\.clearCache\(\)/);
 assert.match(settingsSource,/COSMI_DRIVE\?\.signOut\(\)/);
 const build=fs.readFileSync(path.join(root,'tools/build-site.mjs'),'utf8');
 assert.match(build,/'drive-cache\.js'/);
 assert.match(build,/'settings\.js'/);
 assert.match(build,/'version\.json'/);
});
