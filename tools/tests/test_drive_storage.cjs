const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'drive-storage.js'), 'utf8');

function harness({ clientId = '123-test.apps.googleusercontent.com', handle, sessionStorage: providedStorage } = {}) {
  const nodes = {}, calls = [], events = [], timers = [];
  const saved = new Map();
  const sessionStorage = providedStorage || {
    getItem(key) { return saved.get(key) ?? null; },
    setItem(key, value) { saved.set(key, value); },
    removeItem(key) { saved.delete(key); }
  };
  let callback, requested = false, reloaded = false;
  function node(id) {
    return nodes[id] ||= { hidden: id === 'driveApp', textContent: '', value: '', listeners: {},
      addEventListener(event, fn) { this.listeners[event] = fn; } };
  }
  const context = {
    Blob, File, Headers, URLSearchParams, Event, crypto, Date, sessionStorage,
    setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {},
    document: { getElementById: node, addEventListener(_, fn) { fn(); } },
    COSMI_DRIVE_CONFIG: { clientId, rootId: 'project-root', rootPath: 'project/cosmos_chimera_forge' },
    COSMI_FORGE: { refresh() {}, loadZipFile() { throw Error('unexpected ZIP'); } },
    dispatchEvent(event) { events.push(event.type); },
    location: { protocol: 'https:', reload() { reloaded = true; } },
    google: { accounts: { oauth2: { initTokenClient(options) {
      callback = options.callback;
      return { requestAccessToken() { requested = true; } };
    } } } },
    async fetch(url, options) {
      const parsed = new URL(url); calls.push({ url: parsed, options });
      assert.equal(options.headers.get('Authorization'), 'Bearer test-token');
      assert.equal(parsed.searchParams.has('access_token'), false);
      const result = handle?.(parsed, options, calls.length);
      if (result) return result;
      if (parsed.pathname.endsWith('/project-root')) return Response.json({ id: 'project-root', mimeType: 'application/vnd.google-apps.folder' });
      const q = parsed.searchParams.get('q') || '';
      const match = q.match(/name = '([^']+)'/);
      if (match) return Response.json({ files: [{ id: match[1] + '-id', name: match[1] }] });
      return Response.json({ files: [] });
    }
  };
  context.window = context;
  vm.runInNewContext(source, context);
  return { context, node, calls, events, timers, sessionStorage,
    get requested() { return requested; }, get reloaded() { return reloaded; },
    async login() { node('driveSignIn').listeners.click(); await callback({ access_token: 'test-token', expires_in: 3600 }); }
  };
}

test('unauthenticated requests never reach Drive and leave the app hidden', async () => {
  const h = harness();
  await assert.rejects(h.context.COSMI_DRIVE.read('prompts/test.prompt.md'), /登入/);
  assert.equal(h.calls.length, 0);
  assert.equal(h.node('driveApp').hidden, true);
  assert.equal(h.requested, false);
});
test('missing OAuth configuration stays locked', () => {
  const h = harness({ clientId: '' });
  h.node('driveSignIn').listeners.click();
  assert.equal(h.requested, false);
  assert.equal(h.node('driveApp').hidden, true);
  assert.match(h.node('driveGateStatus').textContent, /GOOGLE_OAUTH_CLIENT_ID/);
});
test('Google account without project permission cannot unlock the app', async () => {
  const h = harness({ handle: u => u.pathname.endsWith('/project-root') ? Response.json({ error: { message: 'Forbidden' } }, { status: 403 }) : null });
  await h.login();
  assert.equal(h.node('driveApp').hidden, true);
  assert.deepEqual(h.events, []);
  assert.match(h.node('driveGateStatus').textContent, /Forbidden/);
});
test('authorized project access unlocks, and expiry clears the session', async () => {
  const h = harness(); await h.login();
  assert.equal(h.node('driveApp').hidden, false);
  assert.deepEqual(h.events, ['cosmi:authorized']);
  assert.match(h.node('driveStatus').textContent, /0 個資產目錄/);
  h.timers[0]();
  assert.equal(h.node('driveApp').hidden, true);
  assert.equal(h.reloaded, true);
  const count = h.calls.length;
  await assert.rejects(h.context.COSMI_DRIVE.read('prompts/test.prompt.md'), /登入/);
  assert.equal(h.calls.length, count);
});
test('a verified Google session survives refresh and restores Drive without a popup', async () => {
  const first = harness();
  await first.login();
  const restored = harness({ sessionStorage: first.sessionStorage });
  // The session is rechecked against the Drive project root before UI unlock.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(restored.requested, false);
  assert.equal(restored.node('driveApp').hidden, false);
  assert.deepEqual(restored.events, ['cosmi:authorized']);
  assert.ok(restored.calls.some(c => c.url.pathname.endsWith('/project-root')));
});

test('sign out and expiry clear cached tokens instead of reviving login', async () => {
  const h = harness();
  await h.login();
  assert.ok(h.sessionStorage.getItem('cosmi.drive.oauth.v1'));
  h.context.COSMI_DRIVE.signOut();
  assert.equal(h.sessionStorage.getItem('cosmi.drive.oauth.v1'), null);
  assert.equal(h.node('driveApp').hidden, true);
  assert.equal(h.reloaded, true);
});

test('invalid cached Drive permissions are rejected and the session removed', async () => {
  const first = harness();
  await first.login();
  const restored = harness({
    sessionStorage: first.sessionStorage,
    handle: u => u.pathname.endsWith('/project-root')
      ? Response.json({ error: { message: 'Forbidden' } }, { status: 403 })
      : null
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(restored.node('driveApp').hidden, true);
  assert.equal(restored.sessionStorage.getItem('cosmi.drive.oauth.v1'), null);
});

test('relative paths reject absolute paths, traversal and empty components', () => {
  const h = harness();
  for (const name of ['../secret', '/secret', 'C:/secret', 'a/../secret', 'a//b', 'a\\b', 'a?b', 'a/./b']) {
    assert.throws(() => h.context.COSMI_DRIVE.relative(name));
  }
  assert.equal(h.context.COSMI_DRIVE.relative('prompts/a.prompt.md').join('/'), 'prompts/a.prompt.md');
});
test('Drive pagination is followed when resolving an existing prompt', async () => {
  const h = harness({ handle: u => {
    if ((u.searchParams.get('q') || '').includes("name = 'page.prompt.md'")) {
      return u.searchParams.has('pageToken') ? Response.json({ files: [{ id: 'prompt-file' }] }) : Response.json({ files: [], nextPageToken: 'second-page' });
    }
    if (u.searchParams.get('alt') === 'media') return new Response('private prompt');
  } });
  await h.login();
  assert.equal(await (await h.context.COSMI_DRIVE.read('prompts/page.prompt.md')).text(), 'private prompt');
  assert.ok(h.calls.some(c => c.url.searchParams.get('pageToken') === 'second-page'));
});
test('prompt writes replace the existing file rather than creating duplicates', async () => {
  const h = harness({ handle: (u, options) => {
    if (u.pathname.includes('/upload/')) return Response.json({ id: 'save.prompt.md-id' });
  } });
  await h.login();
  await h.context.COSMI_DRIVE.write('prompts/save.prompt.md', new Blob(['new prompt'], { type: 'text/markdown' }));
  const upload = h.calls.find(c => c.url.pathname.includes('/upload/'));
  assert.equal(upload.options.method, 'PATCH');
  assert.equal(upload.url.pathname, '/upload/drive/v3/files/save.prompt.md-id');
  assert.match(await upload.options.body.text(), /new prompt/);
});
test('ambiguous duplicate Drive names fail instead of overwriting arbitrary data', async () => {
  const h = harness({ handle: u => (u.searchParams.get('q') || '').includes("name = 'duplicate.prompt.md'") ? Response.json({ files: [{ id: 'a' }, { id: 'b' }] }) : null });
  await h.login();
  await assert.rejects(h.context.COSMI_DRIVE.write('prompts/duplicate.prompt.md', new Blob(['x'])), /名稱重複/);
  assert.ok(!h.calls.some(c => c.url.pathname.includes('/upload/')));
});
test('legacy Prompt-to-3D migration never invents model or overwrites missing GLB', async () => {
  const h=harness({handle:u=>{
    const q=u.searchParams.get('q')||'';
    if(q==="'ai_blender-id' in parents and trashed = false")return Response.json({files:[
      {id:'old-model',name:'asset_cr_sample_adult',mimeType:'application/vnd.google-apps.folder'}]});
    if(q==="'old-model' in parents and trashed = false")return Response.json({files:[
      {id:'old-models',name:'models',mimeType:'application/vnd.google-apps.folder'}]});
    if(q==="'old-models' in parents and trashed = false")return Response.json({files:[]});
    if(q==="'creatures-id' in parents and trashed = false")return Response.json({files:[]});
  }});
  await h.login();
  const report=await h.context.COSMI_DRIVE.migratePrompt3dAssets();
  assert.equal(report.total,1);
  assert.equal(report.updated,0);
  assert.equal(report.skipped,1);
  assert.match(report.errors.join(','),/無 .glb/);
  assert.ok(!h.calls.some(call=>call.url.pathname.includes('/upload/')));
});

test('legacy migration control and encyclopedia directory are present in the build',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/id="settingsMigratePrompt3d"/);
  assert.match(source,/04_encyclopedia\/creatures/);
  assert.match(source,/before_prompt3d_migration\.json/);
  assert.match(source,/migratePrompt3dAssets/);
});

test('production build excludes asset and prompt directories and requires OAuth config', () => {
  const env = { ...process.env, GOOGLE_OAUTH_CLIENT_ID: 'invalid-client-id' };
  assert.notEqual(spawnSync(process.execPath, ['tools/build-site.mjs'], { cwd: root, env }).status, 0);
  env.GOOGLE_OAUTH_CLIENT_ID = '123-test.apps.googleusercontent.com';
  const result = spawnSync(process.execPath, ['tools/build-site.mjs'], { cwd: root, env });
  assert.equal(result.status, 0, result.stderr.toString());
  const names = fs.readdirSync(path.join(root, '_site'));
  assert.ok(!names.includes('Art') && !names.includes('Data') && !names.includes('.git'));
  assert.match(fs.readFileSync(path.join(root, '_site/drive-config.js'), 'utf8'), /123-test.apps.googleusercontent.com/);
  assert.match(fs.readFileSync(path.join(root, '_site/index.html'), 'utf8'), /id="driveApp" hidden/);
  fs.rmSync(path.join(root, '_site'), { recursive: true });
});

function reviewHarness({failSource=false, failRecord=false}={}) {
  const assets = [
    {id:'model',type:'creature-model-rig',driveFolderId:'model-folder',drivePath:'02_3d/legacy/model',sourcePack:'portrait',stage:'adult',glbFile:{},driveFiles:[{path:'models/x.glb'},{path:'models/x.blend'}],status:'pending'},
    {id:'portrait',type:'creature-concept',driveFolderId:'portrait-folder',drivePath:'01_portraits/portrait',stage:'adult',images:[{path:'images/front.png'}],status:'ok'}
  ];
  const parents={'model-folder':'legacy-id','portrait-folder':'01_portraits-id'};
  const h=harness({handle:(u,o)=>{
    const q=u.searchParams.get('q')||'';
    if(q.includes("name = 'model'")||q.includes("name = 'portrait'"))return Response.json({files:[]});
    const id=u.pathname.split('/').pop();
    if(id in parents) {
      if(o.method==='PATCH') {
        if(failSource&&id==='portrait-folder')return Response.json({error:{message:'move failed'}},{status:503});
        parents[id]=u.searchParams.get('addParents');
        return Response.json({id,parents:[parents[id]]});
      }
      return Response.json({id,parents:[parents[id]]});
    }
    if(u.pathname.includes('/upload/'))return failRecord?Response.json({error:{message:'record failed'}},{status:503}):Response.json({id:'record'});
  }});
  h.context.COSMI_FORGE.packages=()=>assets;
  h.context.COSMI_FORGE.removePackage=id=>{const at=assets.findIndex(p=>p.id===id);if(at>=0)assets.splice(at,1);};
  return {h,assets,parents};
}

test('portrait approval persists review without moving the portrait',async()=>{
 const {h,assets,parents}=reviewHarness();await h.login();
 await h.context.COSMI_DRIVE.review(assets[1],'ok','passed');
 assert.equal(parents['portrait-folder'],'01_portraits-id');
 assert.equal(h.calls.filter(c=>c.options.method==='PATCH'&&!c.url.pathname.includes('/upload/')).length,0);
 assert.ok(h.calls.some(c=>c.url.pathname.includes('/upload/')));
});

test('final approval moves model and approved source directories and preserves file identity',async()=>{
 const {h,assets,parents}=reviewHarness();await h.login();
 await h.context.COSMI_DRIVE.review(assets[0],'ok');
 assert.equal(parents['model-folder'],'models-id');assert.equal(parents['portrait-folder'],'portraits-id');
 assert.equal(assets[0].drivePath,'03_completed/models/model');assert.equal(assets[1].completed,true);
});

test('prompt-only model cannot complete until an approved portrait is bound',async()=>{
 const {h,assets,parents}=reviewHarness();await h.login();assets[0].sourcePack='';
 await assert.rejects(h.context.COSMI_DRIVE.review(assets[0],'ok'),/綁定已核准/);
 assert.equal(parents['model-folder'],'legacy-id');assert.equal(assets[0].status,'pending');
});

test('missing blend prevents completion',async()=>{
 const {h,assets}=reviewHarness();await h.login();assets[0].driveFiles=[{path:'models/x.glb'}];
 await assert.rejects(h.context.COSMI_DRIVE.review(assets[0],'ok'),/blend/);
});

test('second move failure rolls back the first move and leaves status pending',async()=>{
 const {h,assets,parents}=reviewHarness({failSource:true});await h.login();
 await assert.rejects(h.context.COSMI_DRIVE.review(assets[0],'ok'),/move failed/);
 assert.equal(parents['model-folder'],'legacy-id');assert.equal(parents['portrait-folder'],'01_portraits-id');assert.equal(assets[0].status,'pending');
});

test('review record failure rolls back both directory moves',async()=>{
 const {h,assets,parents}=reviewHarness({failRecord:true});await h.login();
 await assert.rejects(h.context.COSMI_DRIVE.review(assets[0],'ok'),/record failed/);
 assert.equal(parents['model-folder'],'legacy-id');assert.equal(parents['portrait-folder'],'01_portraits-id');
});

test('rejection moves only the rejected directory to backup',async()=>{
 const {h,assets,parents}=reviewHarness();await h.login();const p=assets[0];
 await h.context.COSMI_DRIVE.review(p,'reject','bad anatomy');
 assert.match(p.drivePath,/^backup\/rejected_3d\//);assert.equal(parents['portrait-folder'],'01_portraits-id');
 assert.equal(assets.length,1);assert.equal(p.status,'reject');
});


test('sync reads nested asset directories, ignores ZIP, and keeps blend metadata without preview download', async()=>{
 let loaded;
 const h=harness({handle:u=>{
  const q=u.searchParams.get('q')||'';
  if(q.includes("name = 'asset.json'"))return Response.json({files:[]});
  if(q==="'01_portraits-id' in parents and trashed = false")return Response.json({files:[{id:'asset-folder',name:'asset',mimeType:'application/vnd.google-apps.folder'},{id:'old-zip',name:'old.zip',mimeType:'application/zip'}]});
  if(q==="'asset-folder' in parents and trashed = false")return Response.json({files:[{id:'mf',name:'manifest.json',mimeType:'application/json'},{id:'imgs',name:'images',mimeType:'application/vnd.google-apps.folder'},{id:'blend',name:'model.blend',mimeType:'application/octet-stream'}]});
  if(q==="'imgs' in parents and trashed = false")return Response.json({files:[{id:'png',name:'front.png',mimeType:'image/png'}]});
  if(u.searchParams.get('alt')==='media')return u.pathname.endsWith('/mf')?Response.json({task_id:'asset',task_type:'character-concept'}):new Response(new Uint8Array([1,2,3]));
 }});
 h.context.COSMI_FORGE.loadAssetFiles=async(raw,file)=>{loaded={raw,file,pkg:{id:'asset',type:'character-concept',images:[],status:'pending'}};return loaded.pkg;};
 await h.login();
 assert.equal(loaded.file.name,'asset');
 assert.ok(loaded.raw['asset/images/front.png']);
 assert.equal(loaded.pkg.driveFolderId,'asset-folder');
 assert.equal(loaded.pkg.driveFiles.length,3);
 assert.ok(!h.calls.some(c=>c.url.searchParams.get('alt')==='media'&&/(blend|old-zip)$/.test(c.url.pathname)));
 assert.match(h.node('driveStatus').textContent,/1 個資產目錄/);
});
