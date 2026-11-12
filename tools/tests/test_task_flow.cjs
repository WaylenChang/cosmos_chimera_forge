const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

function loadFlow() {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root,'task-flow.js'),'utf8'),ctx);
  return ctx.window.COSMI_TASK_FLOW;
}

test('three entry categories are character, creature, move', () => {
  const flow = loadFlow();
  assert.deepEqual(Array.from(flow.categories,c=>c.id),['character','creature','move']);
  assert.equal(flow.resolve('move','move','move_vfx').taskId,'move-vfx');
  assert.equal(flow.steps('move','move').length,1);
});
test('image route has two exclusive Blender routes after portrait approval', () => {
  const flow=loadFlow();
  const steps=Array.from(flow.steps('character','image'),s=>s.id);
  assert.deepEqual(steps,['appearance','portrait','review_portrait','image_colab','image_blender','review_3d']);
  assert.equal(flow.resolve('character','image','image_colab').taskId,'character-model-rig');
  assert.equal(flow.resolve('creature','image','image_blender').taskId,'creature-model-rig');
});
test('prompt to 3D branches before portraits, with post-model portrait and final review', () => {
  const flow=loadFlow();
  const steps=Array.from(flow.steps('creature','text'),s=>s.id);
  assert.deepEqual(steps,['appearance','prompt_3d','portrait_3d','review_portrait_3d','review_3d']);
  assert.equal(flow.resolve('creature','text','prompt_3d').stage,'blender');
  assert.equal(flow.resolve('character','text','portrait_3d').stage,'portrait_3d');
  assert.equal(flow.resolve('character','text','image_colab'),null);
});
test('legacy task and stage can be mapped to new flow', () => {
  const flow=loadFlow();
  assert.equal(flow.infer('move-vfx','portrait').step,'move_vfx');
  assert.equal(flow.infer('character-concept','portrait').step,'portrait');
  assert.equal(flow.infer('creature-model-rig','blender',{source_pack:'cr-existing'}).step,'image_blender');
  assert.equal(flow.infer('creature-model-rig','blender',{source_pack:'',input_img:''}).step,'prompt_3d');
});
test('page loads flow before forge and includes category, route, step and detail containers', () => {
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(html.indexOf('src="task-flow.js"') < html.indexOf('src="forge.js"'));
  for(const id of ['taskCategories','taskRoutes','tasks','taskFlowDetail']) assert.match(html,new RegExp('id="'+id+'"'));
});
test('post-model portrait does not ask for front view or T-pose', () => {
  const code=fs.readFileSync(path.join(root,'pipeline.js'),'utf8');
  assert.match(code,/stage === "portrait_3d"/);
  assert.match(code,/不要生成正面基準圖、T-pose 或三視圖/);
  assert.match(code,/nativeBuild/);
});
