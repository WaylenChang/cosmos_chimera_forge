const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
function harness() {
  const nodes = {pipelineStage: {value: 'portrait'}, pipelineParameters: {value: '{"secret_format":"DO_NOT_LEAK"}'}, pipelineSource: {value: ''}};
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
test('appearance comes only from concept parameters and cannot inherit another subject', () => {
  const {c,ctx}=harness();
  const first=c.COSMI_PIPELINE.appearance(ctx);
  assert.match(first,/hair_palette.*red/);
  assert.match(first,/appearance: long coat/);
  const next=c.COSMI_PIPELINE.appearance({...ctx,subjectId:'chr_two',concept:{appearance:'blue armor'}});
  assert.match(next,/blue armor/);
  assert.doesNotMatch(next,/long coat|private override/);
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
