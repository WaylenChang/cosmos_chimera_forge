const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const review = require('../../model-review.js');
const root = path.resolve(__dirname, '../..');

test('Drive AI Blender creature assets appear in 3D and creature filters regardless of asset_ prefix', () => {
  const model = {
    id: 'asset_cr_chrono_beetle_adult',
    type: 'creature-model-rig',
    manifest: {task_type:'creature-model-rig',stage:'adult',missing:[{item:'source portrait'}]},
    status: 'missing'
  };
  assert.equal(review.matchesCategory(model, 'mdl'), true);
  assert.equal(review.matchesCategory(model, 'cr'), true);
  assert.equal(review.matchesCategory(model, 'pending'), true);
  assert.equal(review.matchesCategory(model, 'chr'), false);
  assert.equal(review.matchesCategory({id:'asset_cr_aqua_slime_juvenile',type:'creature-model-rig',status:'provisional'},'mdl'),true);
  assert.equal(review.matchesCategory({id:'asset_chr_actor_adult',type:'character-model-rig',status:'ok'},'mdl'),true);
  assert.equal(review.matchesCategory({id:'asset_chr_actor_adult',type:'character-model-rig'},'chr'),true);
  assert.equal(review.matchesCategory({id:'cr_01',type:'creature-concept'},'mdl'),false);
});

test('unified review desk deduplicates catalog and Drive packages with acceptance stars', () => {
  const creature = {line_id:'cr_sun',code_zh:'日',title_zh:'太陽獸',
    concept:{locked:{stages:[{stage:'adult',creature_id:'sun_adult'}]}}};
  const char = {id:'chr_hero',name_zh:'英雄'};
  const packages = [
    {id:'cr-old-adult',type:'creature-concept',subjectId:'sun_adult',stage:'adult',status:'pending'},
    {id:'mdl-new-adult',type:'creature-model-rig',subjectId:'cr_sun',stage:'adult',status:'ok',
      manifest:{missing:['rig.blend']}},
    {id:'asset_cr_guest_adult',type:'creature-model-rig',subjectId:'cr_guest',stage:'adult',status:'provisional'},
    {id:'asset_chr_hero_adult',type:'character-model-rig',subjectId:'chr_hero',stage:'adult',status:'missing'},
    {id:'asset_chr_hero_juvenile',type:'character-model-rig',subjectId:'chr_hero',stage:'juvenile',status:'provisional'}
  ];
  const all=review.unifiedEntries(packages,[creature],[char]);
  assert.equal(all.length,3,'same subject has one row, regardless of stages or 2D/3D packages');
  const sun=all.find(x=>x.catalog?.id==='cr_sun');
  assert.equal(sun.star,'★');
  assert.equal(sun.packages.length,2);
  assert.equal(sun.packages[1].manifest.missing[0],'rig.blend','missing outputs do not demote approved state');
  const hero=all.find(x=>x.catalog?.id==='chr_hero');
  assert.equal(hero.star,'☆');
  assert.equal(hero.packages.length,2);
  const orphan=all.find(x=>x.label==='cr_guest');
  assert.equal(orphan.star,'☆','provisional Drive-only asset is a designed item');
  assert.equal(review.unifiedEntries(packages,[creature],[char],'designed').length,3);
  assert.equal(review.unifiedEntries(packages,[creature],[char],'mdl').length,3);
  assert.equal(review.unifiedEntries(packages,[creature],[char],'pending').length,2);
  assert.equal(review.unifiedEntries(packages,[creature],[char],'all','太陽獸').length,1);
});


test('AI Blender 3D category keeps the model visible and never opens a catalog portrait instead', () => {
  const portrait = {id:'cr_chrono_beetle_adult', type:'creature-concept',
    subjectId:'cr_chrono_beetle', stage:'adult', status:'ok'};
  const model = {id:'asset_cr_chrono_beetle_adult', type:'creature-model-rig',
    subjectId:'cr_chrono_beetle', stage:'adult', status:'missing',
    manifest:{task_type:'creature-model-rig',pipeline:'ai_blender',
      files:[{path:'models/cr_chrono_beetle_adult.glb',kind:'model',level:'L1'}],
      missing:[{item:'source portrait'}]}};
  const juvenile = {...model, id:'asset_cr_chrono_beetle_juvenile',stage:'juvenile'};
  const catalog = [{line_id:'cr_chrono_beetle',title_zh:'時序甲蟲'}];
  const all = review.unifiedEntries([portrait, model, juvenile],catalog,[]);
  assert.equal(all.length,1, 'do not duplicate the same creature across designs and Drive');
  const three = review.unifiedEntries([portrait, model, juvenile],catalog,[],'mdl');
  assert.equal(three.length,1);
  assert.deepEqual(three[0].visiblePackages.map(p=>p.id),
    ['asset_cr_chrono_beetle_adult','asset_cr_chrono_beetle_juvenile']);
  assert.equal(review.preferredVisiblePackage(three,portrait.id).id,model.id,
    'a previously selected 2D package must be replaced by the visible 3D model');
  assert.equal(review.preferredVisiblePackage(three,juvenile.id).id,juvenile.id,
    'retain a stage selection that is already valid for the current filter');
  assert.equal(review.preferredVisiblePackage([],model.id),null);
  assert.equal(review.matchesCategory(model,'pending'),true,
    'missing QA must not hide a valid GLB model from review');
});

test('designed-only catalog rows receive hollow stars before any delivery exists', () => {
  const rows=review.unifiedEntries([], [{line_id:'sun_01',title_zh:'日獸'}], []);
  assert.equal(rows.length,1);
  assert.equal(rows[0].star,'☆');
  assert.equal(rows[0].packages.length,0);
  assert.equal(review.unifiedEntries([], [{line_id:'sun_01'}], [], 'pending').length,0);
});

test('root manifest cannot be replaced by animation or video manifests', () => {
  assert.equal(review.selectRootManifest(['asset/qa/review_video_manifest.json', 'asset/animations/animations_manifest.json',
    'asset/manifest.json', 'asset/nested/manifest.json']), 'asset/manifest.json');
  assert.equal(review.selectRootManifest(['qa/review_video_manifest.json']), '');
});
test('declared delivery model wins over source and unanimated rig regardless of listing order', () => {
  const files = [{path:'source/input.glb'}, {path:'rig/input.glb'}, {path:'models/final.glb'}];
  for (const listing of [files, files.slice().reverse()]) {
    assert.equal(review.selectModelFile(listing).path, 'models/final.glb');
    assert.equal(review.selectModelFile(listing, {files:[{path:'models/final.glb',kind:'model',level:'L1'}]}).path, 'models/final.glb');
  }
  assert.throws(() => review.selectModelFile(files, {}, {model:{path:'models/missing.glb'}}), /不存在/);
  assert.throws(() => review.selectModelFile(files, {files:[{path:'models/missing.glb',kind:'model',level:'L1'}]}), /不存在/);
});
test('private resource references stay within their asset package', () => {
  for (const p of ['https://evil/model.glb','../a.glb','/a.glb','a/../b.glb','a\\b.glb','a?token=x','a//b.glb']) {
    assert.throws(() => review.relative(p));
    assert.throws(() => review.selectModelFile([], {}, {model:{path:p}}));
  }
  assert.equal(review.relative('models/角色.glb'), 'models/角色.glb');
});
test('typed-array subviews do not leak adjacent archive bytes into the GLB parser', () => {
  const archive = new Uint8Array([9,8,1,2,3,7]);
  assert.deepEqual(Array.from(new Uint8Array(review.exactBuffer(archive.subarray(2,5)))), [1,2,3]);
  assert.throws(() => review.exactBuffer('not binary'));
});
test('camera direction and descriptor are data, never executable HTML or remote URLs', () => {
  assert.equal(review.orbitFor({camera_orbit:'180deg 80deg auto'}), '180deg 80deg auto');
  assert.throws(() => review.orbitFor({camera_orbit:'url(https://evil)'}));
  assert.throws(() => review.descriptorFor({id:'asset',rawFiles:{'asset/review_viewer.json':new TextEncoder().encode('{"spec":"unknown"}')}}));
});
test('actual asset parser retains root identity and selects the final model with an exact byte view', async () => {
  const source = fs.readFileSync(path.join(root,'forge.js'),'utf8');
  const start = source.indexOf('  async function loadAssetFiles(');
  const end = source.indexOf('    function addPackage(', start);
  const context = {Blob,URL,TextDecoder,TextEncoder, window:{COSMI_MODEL_REVIEW:review},
    inferTaskType: (_, manifest) => manifest.task_type, addPackage(){}};
  const parse = vm.runInNewContext(source.slice(start,end)+'\nloadAssetFiles', context);
  const json = v => new TextEncoder().encode(JSON.stringify(v));
  const slab = new Uint8Array([9,1,2,3,8]);
  const pkg = await parse({
    'asset/animations/animations_manifest.json':json({clips:[{name:'idle'}]}),
    'asset/manifest.json':json({task_id:'asset',task_type:'character-model-rig',files:[{path:'models/final.glb',kind:'model',level:'L1'}]}),
    'asset/models/final.glb':slab.subarray(1,4),
    'asset/source/input.glb':new Uint8Array([4,5,6]),
    'asset/qa/review_video_manifest.json':json({clips:[{clip:'walk'}]})
  }, {name:'asset'}, {silent:true});
  assert.equal(pkg.id,'asset'); assert.equal(pkg.type,'character-model-rig');
  assert.equal(pkg.glbFile.path,'models/final.glb');
  assert.deepEqual(Array.from(new Uint8Array(pkg.glbFile.buffer)),[1,2,3]);
  URL.revokeObjectURL(pkg.glbFile.url);
  const deferred = await parse({
    'drive-asset/manifest.json':json({task_id:'drive-asset',task_type:'character-model-rig',files:[{path:'models/final.glb',kind:'model',level:'L1'}]}),
    'drive-asset/animations/animations_manifest.json':json({clips:[{name:'idle'}]})
  }, {name:'drive-asset'}, {silent:true});
  assert.equal(deferred.id,'drive-asset');
  assert.equal(deferred.glbFile,null,'metadata-only Drive imports defer binary loading');
});
test('Pages build ships unified 3D review workbench without a second modal or private assets', () => {
  const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(html.indexOf('src="model-review.js"') < html.indexOf('src="drive-storage.js"'));
  assert.match(html,/id="stage3dView"/);
  assert.match(html,/id="stage3dCanvas"/);
  assert.doesNotMatch(html,/id="modelReviewOpen"/);
  const build = fs.readFileSync(path.join(root,'tools/build-site.mjs'),'utf8');
  assert.match(build,/'model-review.js'/);
  assert.doesNotMatch(build,/'model-review.css'/);
  assert.ok(fs.statSync(path.join(root,'vendor/model-viewer.min.js')).size > 500000);
  const runtime = fs.readFileSync(path.join(root,'model-review.js'),'utf8');
  assert.ok(!runtime.includes('iframe')); assert.ok(!runtime.includes('access_token'));
  assert.match(runtime,/openReviewPackage/);
  const forge = fs.readFileSync(path.join(root,'forge.js'),'utf8');
  assert.match(forge,/COSMI_DRIVE\.read\(/);
  assert.match(forge,/descriptor\.model\.sha256/);
  assert.match(forge,/stage3dClipSelect/);
});
