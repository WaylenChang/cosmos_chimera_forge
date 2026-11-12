const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
function harness() {
  const nodes = {pipelineStage: {value: 'portrait'}, pipelineAppearance: {value: ''}, pipelineParameters: {value: '{"secret_format":"DO_NOT_LEAK"}'}, pipelineSource: {value: ''}};
  const c = {document: {getElementById: id => nodes[id], addEventListener() {}}, COSMI_FORGE: {activePackage: () => ({drivePath: '02_3d/colab/model'}), packages: () => [{id:'source',drivePath:'03_completed/portraits/source'}]}};
  c.window = c;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'pipeline.js'), 'utf8'), c);
  for (const [key, name] of Object.entries(c.COSMI_PIPELINE.stages)) c.COSMI_PIPELINE.templates[key] = fs.readFileSync(path.join(root, 'docs/pipeline', name + '.prompt.md'), 'utf8');
  return {c,nodes,ctx:{task:{id:'character-concept'},taskId:'chr-example',subjectId:'chr_one',concept:{hair_palette:['red'],combat_damage:999,appearance:'long coat'},opts:{source_pack:'source'}}};
}
test('non-portrait stages resolve their Drive templates without leaking parameters', () => {
  const {c,nodes,ctx}=harness();
  for (const stage of Object.keys(c.COSMI_PIPELINE.stages).filter(name => name !== 'portrait')) {
    nodes.pipelineStage.value=stage;
    const text=c.COSMI_PIPELINE.build(ctx);
    assert.ok(text.length>100);
    assert.doesNotMatch(text,/\{\{[a-z_]+\}\}|DO_NOT_LEAK|combat_damage/);
    assert.ok(text.length<1800);
  }
});

test('portrait always uses the native task builder even with a legacy Drive template', () => {
  const {c,nodes,ctx}=harness();
  nodes.pipelineStage.value='portrait';
  c.COSMI_PIPELINE.templates.portrait='LEGACY_DRIVE_TEMPLATE';
  for (const taskId of ['character-concept', 'creature-concept']) {
    ctx.task.id=taskId;
    const expected='NATIVE_PORTRAIT_'+taskId;
    ctx.task.build=received => {
      assert.equal(received,ctx);
      return expected;
    };
    assert.equal(c.COSMI_PIPELINE.build(ctx),expected);
  }
});

test('Drive template loading skips the native portrait stage', async () => {
  const {c}=harness();
  const requests=[];
  c.COSMI_DRIVE={read: async file => {
    requests.push(file);
    return {text: async () => file.startsWith('00_settings/') ? '{}' : 'template'};
  }};
  await c.COSMI_PIPELINE.loadTemplates();
  assert.ok(!requests.includes('prompts/01_portrait.prompt.md'));
  assert.equal(requests.filter(file => file.startsWith('prompts/')).length, Object.keys(c.COSMI_PIPELINE.stages).length-1);
});

test('appearance prompt includes visual traits and excludes pipeline and format content', () => {
  const {c,nodes,ctx}=harness();nodes.pipelineStage.value='appearance';
  const text=c.COSMI_PIPELINE.build(ctx);
  assert.match(text,/red|long coat/);assert.doesNotMatch(text,/parameters\.json|03_completed|02_3d|\.glb|999/);
});
test('source paths resolve completed portraits by exact asset identity', () => {
  const {c,nodes,ctx}=harness();nodes.pipelineStage.value='colab';
  assert.match(c.COSMI_PIPELINE.build(ctx),/03_completed\/portraits\/source/);
});
test('manual appearance cannot leak into a different subject', () => {
  const {c,nodes,ctx}=harness();c.COSMI_PIPELINE.appearance(ctx);nodes.pipelineAppearance.value='private override';
  assert.equal(c.COSMI_PIPELINE.appearance(ctx),'private override');
  assert.doesNotMatch(c.COSMI_PIPELINE.appearance({...ctx,subjectId:'chr_two'}),/private override/);
});


test('final review uses the active model source instead of another forge task source', () => {
  const {c,nodes,ctx}=harness();nodes.pipelineStage.value='review_3d';ctx.opts.source_pack='unrelated';
  c.COSMI_FORGE.activePackage=()=>({drivePath:'02_3d/ai_blender/model',sourcePack:'source'});
  const text=c.COSMI_PIPELINE.build(ctx);
  assert.match(text,/03_completed\/portraits\/source/);assert.doesNotMatch(text,/unrelated/);
});


test('a previous review binding does not become an image source for prompt-only modeling', () => {
 const {c,nodes,ctx}=harness();nodes.pipelineStage.value='blender';nodes.pipelineSource.value='unrelated-old-source';ctx.opts.source_pack='';
 const text=c.COSMI_PIPELINE.build(ctx);assert.doesNotMatch(text,/unrelated-old-source/);assert.match(text,/未指定/);
});

test('both 3D routes require original Blender exports, iterative multi-view QA and creature bestiary', () => {
  const {c,nodes,ctx}=harness();
  ctx.task.id='creature-model-rig';ctx.subjectId='cr_one';
  for (const stage of ['colab','blender']) {
    nodes.pipelineStage.value=stage;
    const prompt=c.COSMI_PIPELINE.build(ctx);
    for (const expected of ['Blender','models/chr-example', '.blend','.glb','原型','搜尋','正、背、左、右、上、下','每次修改後','拓撲','bestiary.md','juvenile','adolescent','adult','overload']) {
      assert.ok(prompt.includes(expected), stage+' lacks '+expected);
    }
    assert.ok(prompt.length<1800, stage+' prompt should remain focused');
    assert.ok(!prompt.includes('{{') && !prompt.includes('DO_NOT_LEAK') && !prompt.includes('combat_damage'));
    assert.equal((prompt.match(/宙獸圖鑑/g)||[]).length,1);
  }
});

test('image and prompt inputs are exclusive and do not inherit stale content', () => {
  const {c,nodes,ctx}=harness();nodes.pipelineStage.value='blender';
  const withImage=c.COSMI_PIPELINE.build(ctx);
  assert.ok(withImage.includes('03_completed/portraits/source'));
  assert.ok(!withImage.includes('long coat') && !withImage.includes('hair_palette') && !withImage.includes('DO_NOT_LEAK'));
  ctx.opts.source_pack='';nodes.pipelineSource.value='unrelated-old-source';
  const fromPrompt=c.COSMI_PIPELINE.build(ctx);
  assert.ok(fromPrompt.includes('純文字外觀'));
  assert.ok(fromPrompt.includes('long coat'));
  assert.ok(!fromPrompt.includes('03_completed/portraits/source') && !fromPrompt.includes('unrelated-old-source') && !fromPrompt.includes('DO_NOT_LEAK'));
  assert.ok(!fromPrompt.includes('bestiary.md'));
});

test('legacy or unavailable Drive 3D templates never contaminate new instructions', () => {
  const {c,nodes,ctx}=harness();
  ctx.task.id='creature-concept';ctx.subjectId='cr_one';
  nodes.pipelineStage.value='colab';c.COSMI_PIPELINE.templates.colab='OUTDATED_TASK_CONTEXT';
  let text=c.COSMI_PIPELINE.build(ctx);
  assert.ok(text.includes('bestiary.md') && !text.includes('OUTDATED_TASK_CONTEXT'));
  nodes.pipelineStage.value='blender';delete c.COSMI_PIPELINE.templates.blender;
  text=c.COSMI_PIPELINE.build(ctx);
  assert.ok(text.includes('正、背、左、右、上、下'));
  assert.ok(text.includes('bestiary.md'));
});
