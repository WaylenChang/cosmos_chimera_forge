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


test('all concurrent Prompt-to-Image and 3D wiki calls create one stage-specific Markdown', async()=>{
  let created=false, uploads=0;
  const h=harness({handle:(u,options)=>{
    const q=u.searchParams.get('q')||'';
    if(q.includes("_05_wiki.md"))return Response.json({files:created?[{id:'wiki-item',name:'cr_new_juvenile_05_wiki.md'}]:[]});
    if(u.pathname.includes('/upload/')){
      uploads++;created=true;return Response.json({id:'wiki-item',name:'cr_new_juvenile_05_wiki.md'});
    }
  }});
  vm.runInNewContext(fs.readFileSync(path.join(root,'wiki.js'),'utf8'),h.context);
  await h.login();
  const ctx={task:{id:'creature-concept'},subjectId:'cr_new',opts:{stage:'juvenile'},concept:{name_zh:'新宙獸'}};
  const [a,b,c]=await Promise.all([
    h.context.COSMI_DRIVE.ensureWiki(ctx),
    h.context.COSMI_DRIVE.ensureWiki({...ctx,task:{id:'creature-model-rig'}}),
    h.context.COSMI_DRIVE.ensureWiki(ctx)
  ]);
  assert.equal(uploads,1);
  assert.equal(a.path,'creatures/cr_new/cr_new_juvenile_05_wiki.md');
  assert.equal(a.id,b.id);
  assert.equal(c.id,a.id);
  const later=await h.context.COSMI_DRIVE.ensureWiki(ctx);
  assert.equal(later.created,false);
  assert.equal(uploads,1);
});

test('legacy migration control and encyclopedia directory are present in the build',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/id="settingsMigratePrompt3d"/);
  assert.match(source,/wiki\/creatures/);
  assert.match(source,/before_prompt3d_migration\.json/);
  assert.match(source,/migratePrompt3dAssets/);
   assert.match(source,/migrateWikis/);
   assert.match(html,/id="settingsMigrateWiki"/);
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
  const builtHtml = fs.readFileSync(path.join(root, '_site/index.html'), 'utf8');
  assert.ok(!names.includes('model-review.css'), 'retired duplicate 3D viewer CSS must not ship');
  assert.doesNotMatch(builtHtml, /model-review\.css/);
  for (const asset of ['forge.js','drive-storage.js','model-review.js','drive-config.js']) {
    const digest = require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,'_site',asset))).digest('hex').slice(0,12);
    assert.ok(builtHtml.includes(`="${asset}?v=${digest}"`), asset+' must bypass stale Pages cache using its content hash');
  }
  fs.rmSync(path.join(root, '_site'), { recursive: true });
});

function reviewHarness({failSource=false, failRecord=false}={}) {
  const assets = [
    {id:'cr_fox_adult_03a_colab',subjectId:'cr_fox',type:'creature-model-rig',driveFolderId:'cr_fox-folder',drivePath:'creatures/cr_fox',sourcePack:'cr_fox_adult_01_portrait',stage:'adult',glbFile:{},driveFiles:[{id:'glb-1',path:'cr_fox_adult_03a_colab.glb'},{id:'blend-1',path:'cr_fox_adult_03a_colab.blend'}],status:'pending'},
    {id:'cr_fox_adult_01_portrait',subjectId:'cr_fox',type:'creature-concept',driveFolderId:'cr_fox-folder',drivePath:'creatures/cr_fox',stage:'adult',images:[{path:'cr_fox_adult_01_portrait_front.png'}],status:'ok'}
  ];
  const parents={'cr_fox-folder':'creatures-id','glb-1':'cr_fox-folder','blend-1':'cr_fox-folder'};
  const h=harness({handle:(u,o)=>{
    const q=u.searchParams.get('q')||'';
    if(q.includes("name = 'cr_fox_adult_02_review_portrait.json'")||q.includes("name = 'cr_fox_adult_04_review_3d.json'"))return Response.json({files:[]});
    const id=u.pathname.split('/').pop();
    if(id in parents) {
      if(o.method==='PATCH') {
        if(failSource&&id==='blend-1')return Response.json({error:{message:'move failed'}},{status:503});
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
 assert.equal(parents['cr_fox-folder'],'creatures-id');
 assert.equal(h.calls.filter(c=>c.options.method==='PATCH'&&!c.url.pathname.includes('/upload/')).length,0);
 assert.ok(h.calls.some(c=>c.url.pathname.includes('/upload/')));
});

test('final approval keeps files in subject folder and marks model and source completed',async()=>{
 const {h,assets,parents}=reviewHarness();await h.login();
 await h.context.COSMI_DRIVE.review(assets[0],'ok');
 assert.equal(parents['cr_fox-folder'],'creatures-id');
 assert.equal(assets[0].drivePath,'creatures/cr_fox');assert.equal(assets[0].completed,true);assert.equal(assets[1].completed,true);
});

test('prompt-only model can complete without a bound portrait, while image-to-3d still requires one',async()=>{
 const {h,assets,parents}=reviewHarness();await h.login();assets[0].sourcePack='';assets[0].id='cr_fox_adult_03b_blender';
 await h.context.COSMI_DRIVE.review(assets[0],'ok');
 assert.equal(parents['cr_fox-folder'],'creatures-id');
 assert.equal(assets[0].status,'ok');

 const {h:h2,assets:a2,parents:p2}=reviewHarness();await h2.login();a2[0].sourcePack='';
 await assert.rejects(h2.context.COSMI_DRIVE.review(a2[0],'ok'),/綁定已核准/);
 assert.equal(p2['cr_fox-folder'],'creatures-id');assert.equal(a2[0].status,'pending');
});

test('missing blend prevents completion',async()=>{
 const {h,assets}=reviewHarness();await h.login();assets[0].driveFiles=[{path:'cr_fox_adult_03a_colab.glb'}];
 await assert.rejects(h.context.COSMI_DRIVE.review(assets[0],'ok'),/blend/);
});

test('rejection move failure rolls back moved files and leaves status pending',async()=>{
 const {h,assets,parents}=reviewHarness({failSource:true});await h.login();
 await assert.rejects(h.context.COSMI_DRIVE.review(assets[0],'reject','bad'),/move failed/);
 assert.equal(parents['glb-1'],'cr_fox-folder');assert.equal(parents['blend-1'],'cr_fox-folder');assert.equal(assets[0].status,'pending');
});

test('review record failure rolls back rejected file moves',async()=>{
 const {h,assets,parents}=reviewHarness({failRecord:true});await h.login();
 await assert.rejects(h.context.COSMI_DRIVE.review(assets[0],'reject','bad'),/record failed/);
 assert.equal(parents['glb-1'],'cr_fox-folder');assert.equal(parents['blend-1'],'cr_fox-folder');
});

test('rejection moves only the rejected package files to backup without moving subject folder',async()=>{
 const {h,assets,parents}=reviewHarness();await h.login();const p=assets[0];
 await h.context.COSMI_DRIVE.review(p,'reject','bad anatomy');
 assert.match(p.drivePath,/^creatures\/backup\/rejected_3d\//);assert.equal(parents['cr_fox-folder'],'creatures-id');
 assert.equal(assets.length,1);assert.equal(p.status,'reject');
});


 test('sync reads subject folders, ignores ZIP, and keeps blend metadata without preview download', async()=>{
 let loaded;
 const h=harness({handle:u=>{
  const q=u.searchParams.get('q')||'';
  if(q.includes("'creatures-id' in parents")||q.includes("'moves-id' in parents"))return Response.json({files:[]});
  if(q.includes("name = 'chr_hero.json'"))return Response.json({files:[]});
  if(q==="'characters-id' in parents and trashed = false")return Response.json({files:[{id:'asset-folder',name:'chr_hero',mimeType:'application/vnd.google-apps.folder'},{id:'prompts-folder',name:'prompts',mimeType:'application/vnd.google-apps.folder'},{id:'old-zip',name:'old.zip',mimeType:'application/zip'}]});
  if(q==="'asset-folder' in parents and trashed = false")return Response.json({files:[{id:'mf',name:'chr_hero_01_portrait_manifest.json',mimeType:'application/json'},{id:'png',name:'chr_hero_01_portrait_front.png',mimeType:'image/png'},{id:'blend',name:'chr_hero_03b_blender.blend',mimeType:'application/octet-stream'}]});
  if(u.searchParams.get('alt')==='media')return u.pathname.endsWith('/mf')?Response.json({task_id:'chr_hero_01_portrait',task_type:'character-concept'}):new Response(new Uint8Array([1,2,3]));
 }});
 h.context.COSMI_FORGE.loadAssetFiles=async(raw,file)=>{loaded={raw,file,pkg:{id:file.name,type:'character-concept',images:[],status:'pending'}};return loaded.pkg;};
 await h.login();
 assert.equal(loaded.file.name,'chr_hero_01_portrait');
 assert.ok(loaded.raw['chr_hero_01_portrait/chr_hero_01_portrait_front.png']);
 assert.equal(loaded.pkg.driveFolderId,'asset-folder');
 assert.equal(loaded.pkg.driveFiles.length,2);
 assert.ok(!h.calls.some(c=>c.url.searchParams.get('alt')==='media'&&/(blend|old-zip)$/.test(c.url.pathname)));
 assert.match(h.node('driveStatus').textContent,/1 個資產目錄/);
});


test('AI Blender Drive scan imports flat GLB and BLEND entries as one reviewable creature package and separates multi-version packages', async () => {
  const review = require('../../model-review.js');
  const subjectId = 'cr_chrono_beetle';
  const stemV1 = 'cr_chrono_beetle_adult_03b_blender';
  const stemV2 = 'cr_chrono_beetle_adult_03b_blender_v2';
  const manifestV1 = {
    spec:'cosmimera-art-task/1', task_id:stemV1, task_type:'creature-model-rig',
    subject_id:subjectId, stage:'adult', pipeline:'ai_blender',
    files:[
      {path:stemV1+'.glb',kind:'model',level:'L1'},
      {path:stemV1+'.blend',kind:'model',level:'L1'}
    ],
    missing:[{item:'source portrait'}]
  };
  const manifestV2 = {
    ...manifestV1, task_id:stemV2,
    files:[{path:stemV2+'.glb',kind:'model',level:'L1'},{path:stemV2+'.blend',kind:'model',level:'L1'}]
  };
  const directory = {
    "'creatures-id' in parents and trashed = false": [
      {id:'cr-folder-id',name:subjectId,mimeType:'application/vnd.google-apps.folder'}
    ],
    "'cr-folder-id' in parents and trashed = false": [
      {id:'mf1-id',name:stemV1+'_manifest.json',mimeType:'application/json',size:'400'},
      {id:'glb1-id',name:stemV1+'.glb',mimeType:'model/gltf-binary',size:'2012168'},
      {id:'blend1-id',name:stemV1+'.blend',mimeType:'application/octet-stream',size:'263628'},
      {id:'mf2-id',name:stemV2+'_manifest.json',mimeType:'application/json',size:'400'},
      {id:'glb2-id',name:stemV2+'.glb',mimeType:'model/gltf-binary',size:'2012168'},
      {id:'blend2-id',name:stemV2+'.blend',mimeType:'application/octet-stream',size:'263628'}
    ]
  };
  const h = harness({handle:url=>{
    const q=url.searchParams.get('q') || '';
    if(q.includes("'project-root' in parents")&&(q.includes("name = 'characters'")||q.includes("name = 'moves'"))) return Response.json({files:[]});
    if(Object.hasOwn(directory,q)) return Response.json({files:directory[q]});
    if(url.pathname.endsWith('/mf1-id'))
      return new Response(JSON.stringify(manifestV1),{headers:{'Content-Type':'application/json'}});
    if(url.pathname.endsWith('/mf2-id'))
      return new Response(JSON.stringify(manifestV2),{headers:{'Content-Type':'application/json'}});
  }});
  const packages = [];
  h.context.COSMI_MODEL_REVIEW = {
    selectModelFile:review.selectModelFile, descriptorFor:()=>null,
    onPackagesChanged(){}
  };
  h.context.COSMI_FORGE.clearDrivePackages = () => {packages.length=0;};
  h.context.COSMI_FORGE.packages = () => packages;
  h.context.COSMI_FORGE.loadAssetFiles = async (raw,{name}) => {
    const m=JSON.parse(new TextDecoder().decode(raw[name+'/'+name+'_manifest.json']));
    const pkg={id:m.task_id,type:m.task_type,subjectId:m.subject_id,
      manifest:m,stage:m.stage,status:'missing'};
    packages.push(pkg);
    return pkg;
  };
  await h.login();
  assert.equal(packages.length,2);
  const pkg=packages[0];
  assert.equal(pkg.drivePath,'creatures/'+subjectId);
  assert.equal(pkg.driveFiles.length,3);
  assert.equal(pkg.glbFile.path,stemV1+'.glb');
  assert.equal(pkg.glbFile.deferred,true);
  assert.equal(review.matchesCategory(pkg,'mdl'),true);
  assert.match(h.node('driveStatus').textContent,/Drive 已載入 2 個資產目錄/);
  assert.ok(!h.calls.some(c=>c.url.pathname.endsWith('/glb1-id') ||
    c.url.pathname.endsWith('/blend1-id')), 'never fetch large model binaries when listing');
});

test('pipelineRoot and packageDir route character, creature, and move pipelines separately', () => {
  const h = harness();
  const d = h.context.COSMI_DRIVE;
  assert.equal(d.pipelineRoot('character-concept'), 'characters');
  assert.equal(d.pipelineRoot('creature-model-rig'), 'creatures');
  assert.equal(d.pipelineRoot('move-vfx'), 'moves');
  assert.equal(d.pipelineRoot('chr-20261114-abcd-0001'), 'characters');
  assert.equal(d.pipelineRoot('cr-20261114-abcd-0001'), 'creatures');
  assert.equal(d.pipelineRoot('fx-20261114-abcd-0001'), 'moves');
  assert.equal(d.packageDir('character-concept', 'chr_hero'), 'characters/chr_hero');
  assert.equal(d.packageDir('character-model-rig', 'chr_hero', 'colab'), 'characters/chr_hero');
  assert.equal(d.packageDir('creature-model-rig', 'cr_fox_adult', 'blender'), 'creatures/cr_fox');
  assert.equal(d.packageDir('move-vfx', 'fx_burst'), 'moves/fx_burst');
});

test('migratePipelineDirectories classifies and moves legacy Drive items into characters/creatures/moves', async () => {
  const parents = {
    'chr-folder': 'legacy-portraits-id',
    'cr-folder': 'legacy-ai-id',
    'chr-rev': 'legacy-reviews-id',
    'cr-set': 'legacy-settings-id',
    'def-set': 'legacy-settings-id',
    'fx-job': 'legacy-jobs-id',
    'cr-wiki': 'legacy-wiki-creatures-id'
  };
  const folderIds = {
    'project-root:01_portraits': 'legacy-portraits-id',
    'project-root:02_3d': 'legacy-02_3d-id',
    'legacy-02_3d-id:ai_blender': 'legacy-ai-id',
    'project-root:reviews': 'legacy-reviews-id',
    'project-root:00_settings': 'legacy-settings-id',
    'project-root:prompts': 'legacy-prompts-id',
    'legacy-prompts-id:jobs': 'legacy-jobs-id',
    'project-root:wiki': 'legacy-wiki-id',
    'legacy-wiki-id:creatures': 'legacy-wiki-creatures-id'
  };
  const listByParent = {
    'legacy-portraits-id': [{ id: 'chr-folder', name: 'chr-20261106-7f3a', mimeType: 'application/vnd.google-apps.folder' }],
    'legacy-ai-id': [{ id: 'cr-folder', name: 'asset_cr_fox_adult', mimeType: 'application/vnd.google-apps.folder' }],
    'legacy-reviews-id': [{ id: 'chr-rev', name: 'chr-20261106-7f3a.json', mimeType: 'application/json' }],
    'legacy-settings-id': [
      { id: 'cr-set', name: 'cr-20261106-7f3a.parameters.json', mimeType: 'application/json' },
      { id: 'def-set', name: 'default.parameters.json', mimeType: 'application/json' }
    ],
    'legacy-jobs-id': [{ id: 'fx-job', name: 'fx-20261106-7f3a.move_vfx.prompt.md', mimeType: 'text/markdown' }],
    'legacy-wiki-creatures-id': [{ id: 'cr-wiki', name: 'cr_fox_adult_wiki.md', mimeType: 'text/markdown' }]
  };
  const h = harness({
    handle: (u, o) => {
      const q = u.searchParams.get('q') || '';
      if (u.pathname.endsWith('/files') && o.method === 'POST') {
        const body = JSON.parse(o.body);
        const key = body.parents[0] + ':' + body.name;
        const id = folderIds[key] ||= 'created:' + key;
        return Response.json({ id, name: body.name });
      }
      const pMatch = q.match(/^'([^']+)' in parents and trashed = false(.*)$/);
      if (pMatch) {
        const [, pid, extra] = pMatch;
        const nameMatch = extra.match(/name = '([^']+)'/);
        if (nameMatch) {
          const name = nameMatch[1];
          const key = pid + ':' + name;
          if (folderIds[key]) return Response.json({ files: [{ id: folderIds[key], name }] });
          return Response.json({ files: [] });
        }
        return Response.json({ files: listByParent[pid] || [] });
      }
      const id = decodeURIComponent(u.pathname.split('/').pop());
      if (id in parents) {
        if (o.method === 'PATCH') {
          parents[id] = u.searchParams.get('addParents');
          return Response.json({ id, parents: [parents[id]] });
        }
        return Response.json({ id, parents: [parents[id]] });
      }
    }
  });
  await h.login();
  const report = await h.context.COSMI_DRIVE.migratePipelineDirectories();
  assert.equal(report.errors.length, 0, report.errors.join('; '));
  assert.equal(report.moved, 6);
  assert.equal(report.skipped, 1); // default.parameters.json stays in root 00_settings
  assert.match(parents['chr-folder'], /characters.*01_portraits/);
  assert.match(parents['cr-folder'], /creatures.*ai_blender/);
  assert.match(parents['chr-rev'], /characters.*reviews/);
  assert.match(parents['cr-set'], /creatures.*00_settings/);
  assert.equal(parents['def-set'], 'legacy-settings-id');
  assert.match(parents['fx-job'], /moves.*jobs/);
  assert.match(parents['cr-wiki'], /creatures.*wiki/);
});

test('3-level flat Drive sync loads migrated 3D manifests, manifest-less portraits, and subject-scoped wikis', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2XioAAAAASUVORK5CYII=', 'base64');
  const h = harness({
    handle: (u) => {
      if (u.searchParams.get('alt') === 'media') {
        const id = decodeURIComponent(u.pathname.split('/').pop());
        if (id === 'mf-3d') {
          return new Response(JSON.stringify({
            task_id: 'mdl-20261111-a111-1301',
            task_type: 'creature-model-rig',
            subject_id: 'starter_sun_line',
            stage: 'adolescent',
            pipeline: 'ai_blender',
            files: [{ path: 'models/cr_starter_sun_line_adolescent_v3_structure.glb', kind: 'model', level: 'L1' }],
            missing: []
          }));
        }
        return new Response(png);
      }
      const q = u.searchParams.get('q') || '';
      if (!q) return undefined;
      if (q) {
        if (q.includes("'project-root' in parents") && q.includes("name = 'creatures'")) {
          return Response.json({ files: [{ id: 'cat-creatures', name: 'creatures', mimeType: 'application/vnd.google-apps.folder' }] });
        }
        if (q.includes("'cat-creatures' in parents") && q.includes("name = 'starter_sun_line'")) {
          return Response.json({ files: [{ id: 'sub-sun', name: 'starter_sun_line', mimeType: 'application/vnd.google-apps.folder' }] });
        }
        if (q.includes("'cat-creatures' in parents") && !q.includes('name =')) {
          return Response.json({ files: [{ id: 'sub-sun', name: 'starter_sun_line', mimeType: 'application/vnd.google-apps.folder' }] });
        }
        if (q.includes("'sub-sun' in parents") && q.includes("name = 'starter_sun_line_adolescent_05_wiki.md'")) {
          return Response.json({ files: [{ id: 'wiki-sun', name: 'starter_sun_line_adolescent_05_wiki.md', mimeType: 'text/markdown' }] });
        }
        if (q.includes("'sub-sun' in parents") && !q.includes('name =')) {
          return Response.json({
            files: [
              { id: 'img-front', name: 'starter_sun_line_adolescent_01_portrait_front.png', mimeType: 'image/png', modifiedTime: '2026-11-16T00:00:00Z', size: '68' },
              { id: 'glb-3d', name: 'starter_sun_line_adolescent_03b_blender.glb', mimeType: 'model/gltf-binary', modifiedTime: '2026-11-16T00:00:00Z', size: '128' },
              { id: 'mf-3d', name: 'starter_sun_line_adolescent_03b_blender_manifest.json', mimeType: 'application/json', modifiedTime: '2026-11-16T00:00:00Z', size: '256' },
              { id: 'wiki-sun', name: 'starter_sun_line_adolescent_05_wiki.md', mimeType: 'text/markdown', modifiedTime: '2026-11-16T00:00:00Z', size: '64' }
            ]
          });
        }
        return Response.json({ files: [] });
      }
    }
  });
  const packages = [];
  h.context.URL = URL;
  h.context.location.href = 'https://example.test/';
  vm.runInNewContext(fs.readFileSync(path.join(root, 'wiki.js'), 'utf8'), h.context);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'model-review.js'), 'utf8'), h.context);
  h.context.COSMI_FORGE.clearDrivePackages = () => { packages.length = 0; };
  h.context.COSMI_FORGE.packages = () => packages;
  h.context.COSMI_FORGE.loadAssetFiles = async (raw, { name }) => {
    const mfKey = Object.keys(raw).find(k => k.endsWith('_manifest.json'));
    const m = mfKey ? JSON.parse(new TextDecoder().decode(raw[mfKey])) : null;
    const pkg = {
      id: m?.task_id || name,
      type: m?.task_type || 'unknown',
      subjectId: m?.subject_id || '',
      manifest: m,
      stage: m?.stage || null,
      status: 'provisional'
    };
    packages.push(pkg);
    return pkg;
  };
  await h.login();
  await h.context.COSMI_DRIVE.syncPackages({ force: true });
  const pkgs = h.context.COSMI_FORGE.packages();
  const modelPkg = pkgs.find(p => p.id === 'mdl-20261111-a111-1301');
  const portraitPkg = pkgs.find(p => p.id === 'starter_sun_line_adolescent_01_portrait');
  assert.ok(modelPkg, 'migrated 3D package must load despite old models/*.glb manifest path');
  assert.equal(modelPkg.glbFile?.path, 'starter_sun_line_adolescent_03b_blender.glb');
  assert.ok(portraitPkg, 'manifest-less portrait package must load');
  assert.equal(portraitPkg.subjectId, 'starter_sun_line');
  const wiki = await h.context.COSMI_DRIVE.ensureWiki({ task: { id: 'creature-concept' }, subjectId: 'starter_sun_line', opts: { stage: 'adolescent' } });
  assert.equal(wiki.created, false);
  assert.equal(wiki.id, 'wiki-sun');
});

test('syncPackages prioritizes currently selected subject ahead of earlier folders and refreshes immediately', async () => {
  const folderNames = ['item_a', 'item_b', 'item_c', 'item_d', 'item_selected'];
  const importedOrder = [];
  let refreshAtSelected = -1;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const h = harness({
    handle: u => {
      if (u.pathname.endsWith('/permissions')) return Response.json({ permissions: [{ id: 'perm-1' }] });
      if (u.pathname.endsWith('/files/file-selected') && u.searchParams.get('alt') === 'media') return new Response(png);
      if (u.searchParams.get('alt') === 'media') {
        return new Promise(r => setTimeout(() => r(new Response(png)), 15));
      }
      const q = u.searchParams.get('q') || '';
      if (!q) return undefined;
      if (!q) return undefined;
      if (q.includes("'project-root' in parents") && q.includes("name = 'creatures'")) {
        return Response.json({ files: [{ id: 'cat-creatures', name: 'creatures', mimeType: 'application/vnd.google-apps.folder' }] });
      }
      if (q.includes("'cat-creatures' in parents") && !q.includes('name =')) {
        return Response.json({
          files: folderNames.map(n => ({ id: 'dir-' + n, name: n, mimeType: 'application/vnd.google-apps.folder' }))
        });
      }
      for (const n of folderNames) {
        if (q.includes(`'dir-${n}' in parents`) && !q.includes('name =')) {
          return Response.json({
            files: [{ id: 'file-' + n.replace('item_', ''), name: `${n}_adult_01_portrait_front.png`, mimeType: 'image/png', modifiedTime: '2026-11-16T00:00:00Z', size: '68' }]
          });
        }
      }
      return Response.json({ files: [] });
    }
  });
  const packages = [];
  h.context.URL = URL;
  h.context.location.href = 'https://example.test/';
  h.context.COSMI_DRIVE_CACHE = {
    preferences: () => ({ autoSync: false, cacheEnabled: false }),
    namespace: () => 'test-ns',
    putPackage: async () => {},
    clear: async () => {},
  };
  h.context.COSMI_FORGE.priorityDriveTargets = () => ({ ids: ['creature:item_selected'] });
  h.context.COSMI_FORGE.clearDrivePackages = () => { packages.length = 0; };
  h.context.COSMI_FORGE.packages = () => packages;
  h.context.COSMI_FORGE.refresh = () => {
    if (packages.some(p => p.subjectId === 'item_selected') && refreshAtSelected === -1) {
      refreshAtSelected = importedOrder.length;
    }
  };
  h.context.COSMI_FORGE.loadAssetFiles = async (raw, { name }) => {
    const subjectId = name.replace(/_adult_01_portrait$/, '');
    importedOrder.push(subjectId);
    const pkg = { id: name, type: 'creature-concept', subjectId, stage: 'adult', status: 'provisional' };
    packages.push(pkg);
    return pkg;
  };
  await h.login();
  await h.context.COSMI_DRIVE.syncPackages({ force: true });
  assert.equal(importedOrder[0], 'item_selected', 'selected item should finish importing first');
  assert.equal(refreshAtSelected, 1, 'UI refresh should fire immediately after the selected item imports');
});

test('readById jumps ahead of queued syncPackages downloads in the shared priority queue', async () => {
  const downloadStartOrder = [];
  let releaseBatch;
  const batchGate = new Promise(r => { releaseBatch = r; });
  const folderNames = ['bg_1', 'bg_2', 'bg_3'];
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const h = harness({
    handle: u => {
      if (u.pathname.endsWith('/permissions')) return Response.json({ permissions: [{ id: 'perm-1' }] });
      if (u.searchParams.get('alt') === 'media') {
        const fileId = u.pathname.split('/').pop();
        downloadStartOrder.push(fileId);
        if (downloadStartOrder.length <= 6) {
          return batchGate.then(() => new Response(png));
        }
        return new Response(png);
      }
      const q = u.searchParams.get('q') || '';
      if (!q) return undefined;
      if (!q) return undefined;
      if (q.includes("'project-root' in parents") && q.includes("name = 'creatures'")) {
        return Response.json({ files: [{ id: 'cat-creatures', name: 'creatures', mimeType: 'application/vnd.google-apps.folder' }] });
      }
      if (q.includes("'cat-creatures' in parents") && !q.includes('name =')) {
        return Response.json({
          files: folderNames.map(n => ({ id: 'dir-' + n, name: n, mimeType: 'application/vnd.google-apps.folder' }))
        });
      }
      for (const n of folderNames) {
        if (q.includes(`'dir-${n}' in parents`) && !q.includes('name =')) {
          return Response.json({
            files: [1, 2, 3].map(i => ({
              id: `${n}-f${i}`,
              name: `${n}_adult_01_portrait_v${i}.png`,
              mimeType: 'image/png',
              modifiedTime: '2026-11-16T00:00:00Z',
              size: '68'
            }))
          });
        }
      }
      return Response.json({ files: [] });
    }
  });
  h.context.URL = URL;
  h.context.location.href = 'https://example.test/';
  h.context.COSMI_DRIVE_CACHE = {
    preferences: () => ({ autoSync: false, cacheEnabled: false }),
    namespace: () => 'test-ns',
    putPackage: async () => {},
    clear: async () => {},
  };
  h.context.COSMI_FORGE.loadAssetFiles = async (raw, { name }) => ({ id: name, type: 'creature-concept', status: 'provisional' });
  await h.login();
  const syncPromise = h.context.COSMI_DRIVE.syncPackages({ force: true });
  while (downloadStartOrder.length < 6) {
    await new Promise(r => setTimeout(r, 5));
  }
  const urgentPromise = h.context.COSMI_DRIVE.readById('urgent-glb');
  releaseBatch();
  await Promise.all([syncPromise, urgentPromise]);
  assert.equal(downloadStartOrder[6], 'urgent-glb', 'readById must preempt queued background sync downloads');
});

test('assetSubpath keeps main portrait, GLB, and wiki at Level 3 and routes intermediate files to step/version subdirs', () => {
  const h = harness();
  const { assetSubpath, isLevel3Deliverable, parseAssetFilename } = h.context.COSMI_DRIVE;
  assert.equal(assetSubpath('chr_1286_01_portrait_main.png', 'characters'), 'chr_1286_01_portrait_main.png');
  assert.equal(assetSubpath('chr_1286_03a_colab.glb', 'characters'), 'chr_1286_03a_colab.glb');
  assert.equal(assetSubpath('cr_aqua_slime_adult_03b_blender_v2.glb', 'creatures'), 'cr_aqua_slime_adult_03b_blender_v2.glb');
  assert.equal(assetSubpath('cr_aqua_slime_adult_05_wiki.md', 'creatures'), 'cr_aqua_slime_adult_05_wiki.md');

  assert.equal(assetSubpath('chr_1286_00_appearance.md', 'characters'), '00_settings/chr_1286_00_appearance.md');
  assert.equal(assetSubpath('chr_1286_00_parameters_v2.json', 'characters'), '00_settings/v2/chr_1286_00_parameters_v2.json');
  assert.equal(assetSubpath('chr_1286_01_portrait_front.png', 'characters'), '01_portrait/chr_1286_01_portrait_front.png');
  assert.equal(assetSubpath('chr_1286_02_review_portrait.json', 'characters'), '02_review_portrait/chr_1286_02_review_portrait.json');
  assert.equal(assetSubpath('chr_1286_03a_colab.blend', 'characters'), '03a_colab/chr_1286_03a_colab.blend');
  assert.equal(assetSubpath('cr_aqua_slime_adult_03b_blender_v2_manifest.json', 'creatures'), '03b_blender/v2/cr_aqua_slime_adult_03b_blender_v2_manifest.json');
  assert.equal(assetSubpath('cr_aqua_slime_adult_04_review_3d.json', 'creatures'), '04_review_3d/cr_aqua_slime_adult_04_review_3d.json');

  assert.equal(isLevel3Deliverable(parseAssetFilename('01_portrait/chr_1286_01_portrait_main.png', 'characters')), true);
  assert.equal(isLevel3Deliverable(parseAssetFilename('03a_colab/chr_1286_03a_colab_manifest.json', 'characters')), false);
});

test('syncPackages and syncPipelineIndex read files from step/version subdirectories and review writes into step subdir', async () => {
  const writes = [];
  const manifest = JSON.stringify({ task_id: 'cr_test_adult_03b_blender_v2', subject_id: 'cr_test', stage: 'adult', version: 'v2', pipeline: 'ai_blender', input_mode: 'text' });
  const reviewJson = JSON.stringify({ task_id: 'cr_test_adult_03b_blender_v2', status: 'ok', note: 'good' });
  const h = harness({
    handle: (u, o) => {
      if (u.pathname.endsWith('/permissions')) return Response.json({ permissions: [{ id: 'perm-1' }] });
      if (u.searchParams.get('alt') === 'media') {
        const fid = u.pathname.split('/').pop();
        if (fid === 'f-manifest') return new Response(manifest);
        if (fid === 'f-review') return new Response(reviewJson);
        if (fid === 'f-param') return new Response('{"style":"anime"}');
        if (fid === 'f-wiki') return new Response('# Wiki');
        return new Response('ok');
      }
      if (u.pathname.startsWith('/upload/')) {
        writes.push({ path: u.pathname, body: String(o?.body || '') });
        return Response.json({ id: 'written-1', name: 'written.json' });
      }
      if (o?.method === 'POST' && u.pathname.endsWith('/files')) {
        return Response.json({ id: 'new-folder-id', name: 'created' });
      }
      const q = u.searchParams.get('q') || '';
      if (!q) return undefined;
      if (q.includes("'project-root' in parents") && q.includes("name = 'creatures'")) {
        return Response.json({ files: [{ id: 'cat-creatures', name: 'creatures', mimeType: 'application/vnd.google-apps.folder' }] });
      }
      if (q.includes("'cat-creatures' in parents") && !q.includes('name =')) {
        return Response.json({ files: [{ id: 'dir-cr-test', name: 'cr_test', mimeType: 'application/vnd.google-apps.folder' }] });
      }
      if (q.includes("'dir-cr-test' in parents") && !q.includes('name =')) {
        return Response.json({
          files: [
            { id: 'f-glb', name: 'cr_test_adult_03b_blender_v2.glb', mimeType: 'model/gltf-binary' },
            { id: 'f-wiki', name: 'cr_test_adult_05_wiki.md', mimeType: 'text/markdown' },
            { id: 'sub-settings', name: '00_settings', mimeType: 'application/vnd.google-apps.folder' },
            { id: 'sub-blender', name: '03b_blender', mimeType: 'application/vnd.google-apps.folder' },
            { id: 'sub-rev3d', name: '04_review_3d', mimeType: 'application/vnd.google-apps.folder' },
          ]
        });
      }
      if (q.includes("'sub-settings' in parents")) {
        return Response.json({ files: [{ id: 'f-param', name: 'cr_test_adult_00_parameters.json', mimeType: 'application/json' }] });
      }
      if (q.includes("'sub-blender' in parents")) {
        return Response.json({ files: [{ id: 'sub-blender-v2', name: 'v2', mimeType: 'application/vnd.google-apps.folder' }] });
      }
      if (q.includes("'sub-blender-v2' in parents")) {
        return Response.json({
          files: [
            { id: 'f-manifest', name: 'cr_test_adult_03b_blender_v2_manifest.json', mimeType: 'application/json' },
            { id: 'f-blend', name: 'cr_test_adult_03b_blender_v2.blend', mimeType: 'application/octet-stream' },
          ]
        });
      }
      if (q.includes("'sub-rev3d' in parents")) {
        return Response.json({ files: [{ id: 'sub-rev3d-v2', name: 'v2', mimeType: 'application/vnd.google-apps.folder' }] });
      }
      if (q.includes("'sub-rev3d-v2' in parents")) {
        return Response.json({ files: [{ id: 'f-review', name: 'cr_test_adult_04_review_3d_v2.json', mimeType: 'application/json' }] });
      }
      return Response.json({ files: [] });
    }
  });
  h.context.COSMI_FORGE.loadAssetFiles = async (raw, { name }) => {
    const manifestKey = Object.keys(raw).find(k => k.endsWith('_manifest.json'));
    return {
      id: name,
      subjectId: 'cr_test',
      stage: 'adult',
      type: 'model',
      manifest: manifestKey ? JSON.parse(Buffer.from(raw[manifestKey]).toString('utf8')) : {},
      status: 'pending',
    };
  };
  await h.login();
  await h.context.COSMI_DRIVE.syncPackages({ force: true });
  await h.context.COSMI_DRIVE.syncPipelineIndex();
  const idx = h.context.COSMI_DRIVE.pipelineIndex();
  assert.equal(idx.settings.some(f => f.name === 'cr_test_adult_00_parameters.json'), true);
  assert.equal(idx.wikiCreatures.some(f => f.name === 'cr_test_adult_05_wiki.md'), true);
});


