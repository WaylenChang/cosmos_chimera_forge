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
  assert.equal(flow.steps('move','move').length,2);
  assert.equal(flow.steps('move','move')[0].id,'encyclopedia');
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
test('encyclopedia is integrated into appearance for character/creature and standalone for move', () => {
  const flow=loadFlow();
  for(const kind of ['character','creature']) for(const route of ['image','text']) {
    assert.equal(flow.resolve(kind,route,'encyclopedia'),null);
    assert.match(flow.resolve(kind,route,'appearance').output,/wiki\//);
  }
  assert.equal(flow.resolve('move','move','encyclopedia').stage,'encyclopedia');
  const rows=flow.diagram('creature');
  const fork=rows.find(r=>r.type==='fork');
  assert.deepEqual(Array.from(fork.lanes,l=>l.id),['image','text']);
  assert.deepEqual(Array.from(fork.lanes[0].segments[2].tracks,s=>s[0].id),['image_colab','image_blender']);
  assert.equal(rows[0].steps[0].id,'appearance');
  assert.equal(rows.at(-1).steps[0].id,'review_3d');
  assert.equal(flow.selectRoute(flow.selectCategory('move'),'move').step,'encyclopedia');
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
  for(const id of ['taskCategories','tasks','taskFlowDetail']) assert.match(html,new RegExp('id="'+id+'"'));
  assert.doesNotMatch(html,/id="taskRoutes"/);
});
test('post-model portrait does not ask for front view or T-pose', () => {
  const code=fs.readFileSync(path.join(root,'pipeline.js'),'utf8');
  assert.match(code,/stage === "portrait_3d"/);
  assert.match(code,/不要生成正面基準圖、T-pose 或三視圖/);
  assert.match(code,/nativeBuild/);
});

test('redundant task navigation and portrait auto controls are removed', () => {
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const forge=fs.readFileSync(path.join(root,'forge.js'),'utf8');
  const pipeline=fs.readFileSync(path.join(root,'pipeline.js'),'utf8');
  assert.doesNotMatch(html,/id="btnGoDesignedFromSubhead"/);
  assert.doesNotMatch(html,/id="portraitAutoRun"/);
  assert.doesNotMatch(forge,/\$\("#btnGoDesignedFromSubhead"\)/);
  assert.doesNotMatch(pipeline,/\$\("portraitAutoRun"\)/);
  assert.match(html,/id="settingsSignOut"/);
});
test('category controls use text and do not display a route toggle', () => {
  const forge=fs.readFileSync(path.join(root,'forge.js'),'utf8');
  assert.match(forge,/}, c\.zh\)\)\)/);
  assert.doesNotMatch(forge,/function chooseRoute\(/);
  assert.doesNotMatch(forge,/flow-lane-label|flow-alternatives-label/); 
  assert.match(forge,/class:"flow-parallel-track"/);
});

test('production build ships the task chooser module', () => {
  const build=fs.readFileSync(path.join(root,'tools/build-site.mjs'),'utf8');
  assert.ok(build.includes("'task-flow.js'"));
});
test('post-model portrait uses native copy or Drive upload, never a missing template', () => {
  const drive=fs.readFileSync(path.join(root,'drive-storage.js'),'utf8');
  // Verify both handlers follow the selected mode, independent of indentation.
  const savePrompt=drive.slice(drive.indexOf('$("driveSavePrompt").addEventListener'),drive.indexOf('$("driveLoadPrompt").addEventListener'));
  const pipelineRead=drive.slice(drive.indexOf('$("pipelineRead").addEventListener'),drive.indexOf('$("pipelineSaveSettings").addEventListener'));
  assert.match(savePrompt,/\["portrait",\s*"portrait_3d"\]\.includes\(\$\("pipelineStage"\)\.value\)\s*&&\s*!window\.COSMI_PIPELINE\?\.isPortraitAuto\(\)/);
  assert.match(pipelineRead,/if\s*\(\s*\["portrait",\s*"portrait_3d"\]\.includes\(\$\("pipelineStage"\)\.value\)\s*\)/);
  assert.match(pipelineRead,/if\s*\(\s*!window\.COSMI_PIPELINE\?\.isPortraitAuto\(\)\s*\)\s*\{\s*\$\("copy"\)\.click\(\);\s*return;/);
  assert.match(pipelineRead,/await write\(\s*path,\s*new Blob\(\[text\],\s*\{\s*type:\s*"text\/markdown"/);
});
test('typed anatomy profiles are shipped and connected to 3D prompts', () => {
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const build=fs.readFileSync(path.join(root,'tools/build-site.mjs'),'utf8');
  const pipeline=fs.readFileSync(path.join(root,'pipeline.js'),'utf8');
  const profiles=fs.readFileSync(path.join(root,'anatomy-profiles.js'),'utf8');
  assert.match(html,/src="anatomy-profiles.js"/);
  assert.ok(build.includes("'anatomy-profiles.js'"));
  assert.ok(html.indexOf('src="anatomy-profiles.js"') < html.indexOf('src="forge.js"'));
  assert.match(pipeline,/COSMI_ANATOMY\?\.plan/);
  assert.match(profiles,/winged_quadruped/);
  assert.match(profiles,/humanoid_mecha/);
});

test('mechanical limb counts retain rigid mecha routes in browser', () => {
  const ctx={window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'anatomy-profiles.js'),'utf8'),ctx);
  const plan=ctx.window.COSMI_ANATOMY.plan;
  for(const [legs, expected] of [[2,'humanoid_mecha'],[4,'quadruped_mecha'],[6,'multi_leg_mecha'],[8,'multi_leg_mecha']]) {
    assert.equal(plan('creature',{base_parents:['科幻機械·機甲/外骨骼'],limbs:{legs}},'image').anatomy,expected);
  }
  assert.equal(plan('creature',{base_parents:['科幻機械·機甲/外骨骼'],anatomy:'humanoid_mecha',limbs:{legs:4}},'image').anatomy,'humanoid_mecha');
});

test('browser anatomy planner respects mixed origins and explicit wings', () => {
  const ctx={window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'anatomy-profiles.js'),'utf8'),ctx);
  const plan=ctx.window.COSMI_ANATOMY.plan;
  const winged=plan('creature',{base_parents:['生物·哺乳類'],limbs:{legs:4,wings:2}},'image');
  assert.equal(winged.anatomy,'winged_quadruped');
  const machine=plan('creature',{base_parents:['科幻機械·機甲/外骨骼']},'text');
  assert.equal(machine.anatomy,'humanoid_mecha');
  assert.equal(machine.input_mode,'text');
  const mixed=plan('creature',{base_parents:['生物·哺乳類','幻想生物·異界/異形']},'image');
  assert.equal(mixed.anatomy,'hybrid');
  assert.equal(mixed.review_required,true);
});

test('minimal rail diagram exposes both image backends without text route headers', () => {
  const flow=loadFlow();
  const rows=flow.diagram('character');
  const lanes=rows[1].lanes;
  assert.deepEqual(Array.from(lanes[0].segments[2].tracks,t=>t[0].name),
    ['Colab + AI + Blender','AI + Blender']);
  assert.equal(lanes[1].segments[0].steps[0].name,'AI + Blender（文字建模）');
  assert.equal(lanes[0].label,undefined);
  assert.equal(lanes[1].label,undefined);
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const forge=fs.readFileSync(path.join(root,'forge.js'),'utf8');
  assert.match(html,/\.task-flow-list \.flow-parallel-tracks/);
  assert.match(html,/\.task-flow-list \.flow-lane, \.task-flow-list \.flow-parallel-track \{[^}]*border:0/);
  assert.doesNotMatch(forge,/lane\.label|segment\.label/);
});
