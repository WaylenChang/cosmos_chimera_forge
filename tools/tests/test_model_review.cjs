const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const review = require('../../model-review.js');
const root = path.resolve(__dirname, '../..');

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
});
test('Pages build includes viewer code and runtime without embedding private assets', () => {
  const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(html.indexOf('src="model-review.js"') < html.indexOf('src="drive-storage.js"'));
  assert.match(html,/id="modelReviewOpen"/);
  const build = fs.readFileSync(path.join(root,'tools/build-site.mjs'),'utf8');
  assert.match(build,/'model-review.js'/); assert.match(build,/'model-review.css'/);
  assert.ok(fs.statSync(path.join(root,'vendor/model-viewer.min.js')).size > 500000);
  const runtime = fs.readFileSync(path.join(root,'model-review.js'),'utf8');
  assert.ok(!runtime.includes('iframe')); assert.ok(!runtime.includes('access_token'));
  assert.match(runtime,/COSMI_DRIVE\.read/);
});
