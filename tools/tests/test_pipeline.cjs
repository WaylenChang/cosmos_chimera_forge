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
test('each stage resolves its own template without copying JSON parameters into prompt', () => {
  const {c,nodes,ctx}=harness();
  for (const stage of Object.keys(c.COSMI_PIPELINE.stages)) {
    nodes.pipelineStage.value=stage;
    const text=c.COSMI_PIPELINE.build(ctx);
    assert.ok(text.length>100);
    assert.doesNotMatch(text,/\{\{[a-z_]+\}\}|DO_NOT_LEAK|combat_damage/);
    assert.ok(text.length<1800);
  }
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
