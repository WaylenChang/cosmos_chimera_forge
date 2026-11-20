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

test('3D viewer isolates forms and animation clips without overlapping models or actions', () => {
  const forge = fs.readFileSync(path.join(root,'forge.js'),'utf8');
  const loadBlock = forge.slice(forge.indexOf('function clearThreeModel('), forge.indexOf('function buildProcedural3dRig('));
  assert.match(loadBlock, /const loadSeq = \(three\.loadSeq = \(three\.loadSeq \|\| 0\) \+ 1\);/);
  assert.match(loadBlock, /const onModelLoaded = \(model, animations\) => \{\s*if \(three\.loadSeq !== loadSeq \|\| three\.loadedPkgId !== targetPkg\.id \|\| !isStage3dActive\(\)\) return;\s*clearThreeModel\(three\);/);
  const playBlock = forge.slice(forge.indexOf('function play3dClip('), forge.indexOf('function toggle3dPlayPause('));
  assert.match(playBlock, /three\.mixer\.stopAllAction\(\);/);
  assert.match(playBlock, /three\.mixer\.update\(0\);/);
  assert.doesNotMatch(playBlock, /crossFadeTo/);
});

test('all existing designed creature lines have complete text data and unify under catalog rows', () => {
  const ctx = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(path.join(root, 'designed.js'), 'utf8'), ctx);
  const designed = ctx.window.COSMI_DESIGNED;
  assert.ok(designed.items.length >= 35, 'historical catalog must retain 35+ designed lines');
  assert.equal(new Set(designed.items.map(x => x.line_id)).size, designed.items.length, 'designed line IDs must be unique');
  for (const item of designed.items) {
    assert.ok(item.title_zh, `${item.line_id} missing title_zh`);
    assert.ok(item.concept?.archetype_name, `${item.line_id} missing archetype_name`);
    assert.ok(item.concept?.meaning, `${item.line_id} missing meaning`);
    assert.equal(item.concept?.locked?.stages?.length, 4, `${item.line_id} must have 4 stages`);
    for (const st of item.concept.locked.stages) {
      assert.ok(st.name_zh && st.name_en, `${item.line_id}/${st.stage} missing names`);
      assert.ok(st.look && st.dex_zh && st.dex_en, `${item.line_id}/${st.stage} missing look/dex`);
      assert.ok(st.signature_move?.name_zh, `${item.line_id}/${st.stage} missing move name_zh`);
    }
  }
  const driveModel = {
    id: 'asset_cr_aqua_slime_adult',
    type: 'creature-model-rig',
    subjectId: 'cr_aqua_slime',
    stage: 'adult',
    status: 'provisional'
  };
  const entries = review.unifiedEntries([driveModel], designed.items, designed.characters, 'all');
  const aqua = entries.find(e => e.catalog?.id === 'cr_aqua_slime');
  assert.ok(aqua && aqua.catalog, 'Drive cr_aqua_slime must resolve to a catalog row');
  assert.equal(aqua.packages.length, 1);
  assert.equal(entries.filter(e => e.key.includes('cr_aqua_slime')).length, 1);
});

test('high-complexity Colab character models replace simple legacy/ai_blender models and disambiguate chr_1286', () => {
  const characters = [
    { id: 'chr_yeh_chengxi', name_zh: '葉澄汐', name_en: 'Chengxi Yeh' },
    { id: 'chr_amemori_sumiha', name_zh: '雨森澄羽', name_en: 'Amemori Sumiha' },
    { id: 'chr_roen', name_zh: '洛恩', name_en: 'Roen' }
  ];
  const packages = [
    {
      id: 'mdl-20261109-f048-1847-chr_1286',
      type: 'character-model-rig',
      subjectId: 'chr_1286',
      drivePath: 'characters/02_3d/ai_blender/mdl-20261109-f048-1847-chr_1286',
      status: 'provisional',
      manifest: { subject_id: 'chr_1286', source_pack: 'chr-20261106-1286-2039', produced_by: 'Gemini Argon（任務模式）' }
    },
    {
      id: 'mdl-20261113-1286-0000',
      type: 'character-model-rig',
      subjectId: 'chr_1286',
      drivePath: 'characters/02_3d/colab/mdl-20261113-1286-0000',
      status: 'ok',
      manifest: { subject_id: 'chr_1286', source_pack: 'chr-20261106-1286-2039', pipeline: 'colab', produced_by: 'Anime3D typed runner' }
    },
    {
      id: 'mdl-20261109-f048-1847-chr_1286_1855',
      type: 'character-model-rig',
      subjectId: 'chr_1286',
      drivePath: 'characters/02_3d/ai_blender/mdl-20261109-f048-1847-chr_1286_1855',
      status: 'provisional',
      manifest: { subject_id: 'chr_1286', source_pack: 'chr-20261106-1286-1855', produced_by: 'Gemini Argon（任務模式）' }
    },
    {
      id: 'mdl-20261114-1855-0000',
      type: 'character-model-rig',
      subjectId: 'chr_1855',
      drivePath: 'characters/02_3d/colab/mdl-20261114-1855-0000',
      status: 'provisional',
      manifest: { subject_id: 'chr_1855', source_pack: 'chr-20261106-1855-1855', pipeline: 'colab', produced_by: 'Anime3D typed runner' }
    },
    {
      id: 'mdl-20261109-f048-1847-chr_3d04',
      type: 'character-model-rig',
      subjectId: 'chr_3d04',
      drivePath: 'characters/02_3d/ai_blender/mdl-20261109-f048-1847-chr_3d04',
      status: 'provisional',
      manifest: { subject_id: 'chr_3d04', source_pack: 'chr-20261106-3d04-2100', produced_by: 'Gemini Argon（任務模式）' }
    },
    {
      id: 'mdl-20261114-3d04-0000',
      type: 'character-model-rig',
      subjectId: 'chr_3d04',
      drivePath: 'characters/02_3d/colab/mdl-20261114-3d04-0000',
      status: 'provisional',
      manifest: { subject_id: 'chr_3d04', source_pack: 'chr-20261106-3d04-2100', pipeline: 'colab', produced_by: 'Anime3D typed runner' }
    }
  ];
  const entries = review.unifiedEntries(packages, [], characters, 'chr');
  assert.equal(entries.length, 3, 'all 6 character model packages must collapse into 3 canonical characters');
  assert.deepEqual(entries.find(e => e.catalog.id === 'chr_yeh_chengxi').packages.map(p => p.id), ['mdl-20261113-1286-0000']);
  assert.deepEqual(entries.find(e => e.catalog.id === 'chr_amemori_sumiha').packages.map(p => p.id), ['mdl-20261114-1855-0000']);
  assert.deepEqual(entries.find(e => e.catalog.id === 'chr_roen').packages.map(p => p.id), ['mdl-20261114-3d04-0000']);
});

test('selectModelFile resolves flattened Level 3 Drive GLBs even when migrated manifest lists models/<old>.glb', () => {
  const flatFiles = [
    { path: 'chr_1286_03a_colab.glb' },
    { path: 'chr_1286_03a_colab_anime.glb' },
    { path: 'chr_1286_03a_colab_manifest.json' }
  ];
  const migratedManifest = {
    files: [{ path: 'models/mdl-20261113-1286-0000.glb', kind: 'model', level: 'L1' }]
  };
  assert.equal(review.selectModelFile(flatFiles, migratedManifest).path, 'chr_1286_03a_colab.glb');
  assert.equal(
    review.selectModelFile(flatFiles, {}, { model: { path: 'models/mdl-20261113-1286-0000.glb' } }).path,
    'chr_1286_03a_colab.glb'
  );
  assert.throws(() => review.selectModelFile([], migratedManifest), /不存在/);
});
