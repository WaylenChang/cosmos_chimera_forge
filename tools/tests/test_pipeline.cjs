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
  vm.runInNewContext(fs.readFileSync(path.join(root, 'wiki.js'), 'utf8'), c);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'pipeline.js'), 'utf8'), c);
  for (const [key, name] of Object.entries(c.COSMI_PIPELINE.stages)) {
    if (!['portrait','encyclopedia'].includes(key)) c.COSMI_PIPELINE.templates[key] = fs.readFileSync(path.join(root, 'docs/pipeline', name + '.prompt.md'), 'utf8');
  }
  return {c,nodes,ctx:{task:{id:'character-concept'},taskId:'chr-example',subjectId:'chr_one',concept:{hair_palette:['red'],combat_damage:999,appearance:'long coat'},opts:{source_pack:'source'}}};
}
test('non-portrait stages resolve their Drive templates without leaking parameters', () => {
  const {c,nodes,ctx}=harness();
  for (const stage of Object.keys(c.COSMI_PIPELINE.stages).filter(name => !['portrait','encyclopedia'].includes(name))) {
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
    assert.match(c.COSMI_PIPELINE.build(ctx),new RegExp('^'+expected+'\\n\\n圖鑑：wiki/'));
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
  assert.equal(requests.filter(file => file.startsWith('prompts/')).length, Object.keys(c.COSMI_PIPELINE.stages).length-2);
});

test('encyclopedia prompt routes three categories to isolated Markdown paths', () => {
  const {c,nodes,ctx}=harness();nodes.pipelineStage.value='encyclopedia';
  assert.match(c.COSMI_PIPELINE.build(ctx),/wiki\/characters\/chr_one_wiki\.md/);
  ctx.task.id='creature-concept';
  assert.match(c.COSMI_PIPELINE.build(ctx),/wiki\/creatures\/chr_one_adult_wiki\.md/);
  ctx.task.id='move-vfx';ctx.subjectId='fx_fire_burst';ctx.opts={element:'fire',shape:'burst',tier:'heavy'};
  const wiki=c.COSMI_PIPELINE.build(ctx);
  assert.match(wiki,/wiki\/moves\/fx_fire_burst_wiki\.md/);
  assert.match(wiki,/fire|burst/);
  assert.doesNotMatch(wiki,/DO_NOT_LEAK/);
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
 const text=c.COSMI_PIPELINE.build(ctx);assert.doesNotMatch(text,/unrelated-old-source/);assert.match(text,/純文字外觀/);
});


test('3D image routes never produce bestiary; only creature prompt-to-3D does', () => {
  const {c,nodes,ctx}=harness();
  ctx.task.id='creature-model-rig';ctx.task.needs='creature';ctx.subjectId='cr_one';
  for(const stage of ['colab','blender']){
    nodes.pipelineStage.value=stage;
    const text=c.COSMI_PIPELINE.build(ctx);
    for(const term of ['原型','搜尋','每次修改後','正、背、左、右、上、下','拓撲','models/chr-example.blend','models/chr-example.glb']){
      assert.ok(text.includes(term),stage+' missing '+term);
    }
    assert.doesNotMatch(text,/bestiary\.md|宙獸圖鑑|DO_NOT_LEAK|combat_damage|\{\{[a-z_]+\}\}/);
    assert.ok(text.length<1800);
  }
  nodes.pipelineStage.value='blender';
  ctx.opts.source_pack='';
  ctx.opts.input_img='';
  const prompt=c.COSMI_PIPELINE.build(ctx);
  assert.match(prompt,/純文字外觀|bestiary\.md|juvenile|adolescent|adult|overload|manifest\.files/);
  assert.equal((prompt.match(/宙獸圖鑑/g)||[]).length,1);
  assert.doesNotMatch(prompt,/03_completed\/portraits\/source|DO_NOT_LEAK|combat_damage/);
});

test('manual image path is image-to-3D even without source pack',()=>{
  const {c,nodes,ctx}=harness();
  ctx.task.id='creature-model-rig';ctx.task.needs='creature';ctx.subjectId='cr_one';
  nodes.pipelineStage.value='blender';
  ctx.opts.source_pack='';ctx.opts.input_img='images/custom_view.png';
  ctx.notes='STALE_MANUAL_TEXT';
  const text=c.COSMI_PIPELINE.build(ctx);
  assert.match(text,/images\/custom_view\.png/);
  assert.doesNotMatch(text,/bestiary\.md|宙獸圖鑑|STALE_MANUAL_TEXT|long coat/);
});

test('other stages ignore stale Drive templates and unrelated project context',()=>{
  const {c,nodes,ctx}=harness();
  const cases={appearance:'外觀設定',review_portrait:'立繪審查',review_3d:'3D 模型審查',colab:'Colab GPU',blender:'Blender'};
  for(const [stage,label] of Object.entries(cases)){
    nodes.pipelineStage.value=stage;
    c.COSMI_PIPELINE.templates[stage]='LEAKED_PRIOR_PROMPT';
    const text=c.COSMI_PIPELINE.build(ctx);
    assert.match(text,new RegExp(label));
    assert.doesNotMatch(text,/LEAKED_PRIOR_PROMPT|image_in\/|3D_out\/|PR #|DO_NOT_LEAK|\{\{[a-z_]+\}\}/);
    assert.ok(text.length<1800);
  }
  nodes.pipelineStage.value='appearance';
  const appearance=c.COSMI_PIPELINE.build(ctx);
  assert.match(appearance,/red|long coat/);
  assert.doesNotMatch(appearance,/combat_damage|formula|disposition|animations|\.glb/);
  nodes.pipelineStage.value='review_portrait';
  const portrait=c.COSMI_PIPELINE.build(ctx);
  assert.doesNotMatch(portrait,/02_3d\/colab\/model|\bBlender\b|bestiary\.md/);
  nodes.pipelineStage.value='review_3d';
  const review=c.COSMI_PIPELINE.build(ctx);
  assert.match(review,/02_3d\/colab\/model/);
  assert.doesNotMatch(review,/bestiary\.md/);
});

test('versioned Drive templates still apply, without passing their metadata to the AI',()=>{
  const {c,nodes,ctx}=harness();
  nodes.pipelineStage.value='review_portrait';
  c.COSMI_PIPELINE.templates.review_portrait='<!-- COSMI-PIPELINE/2:review_portrait -->\n# CUSTOM VERIFIED REVIEW\n待審：{{input_path}}';
  const text=c.COSMI_PIPELINE.build(ctx);
  assert.match(text,/CUSTOM VERIFIED REVIEW/);
  assert.doesNotMatch(text,/<!--|\{\{/);
});

test('native portrait full and 3-round prompts do not recurse or inherit legacy storage and notes',()=>{
  const {c,nodes}=harness();
  c.COSMI_CATALOG={
    determineAgcBgColor:()=>({hex:'#888888',promptGuide:'純灰背景'}),
    resolveDynamicScene:()=>({fullPromptSection:'單一動態構圖'}),
    STAGES:[{v:'juvenile',zh:'幼年'},{v:'adolescent',zh:'少年'},{v:'adult',zh:'成年'},{v:'overload',zh:'超載'}],
    ELEMENTS:[], SIZE_CLASSES:{L:{tris:'15-25k',tex:2048}}
  };
  vm.runInNewContext(fs.readFileSync(path.join(root,'tasks.js'),'utf8'),c);
  nodes.pipelineStage.value='portrait';
  const concepts={
    'character-concept':{name_zh:'測試角色',gender:'女',height:165,outfit_palette:['藍'],hair_palette:['黑'],eye_palette:['棕']},
    'creature-concept':{name_zh:'測試宙獸',size_profile:'S→M→L→XL',appearance_palette:['金'],elements:[],bases:['鯨'],archetype:'海'}
  };
  for(const [id,concept] of Object.entries(concepts)){
    const task=c.COSMI_TASKS.find(x=>x.id===id);
    const ctx={task,header:'TEST_TASK_HEADER',taskId:'unit',subjectId:'unit',opts:id==='creature-concept'?{stage:'juvenile'}:{},concept,notes:'OLD_NOTE_CONTEXT'};
    const full=task.build(ctx);
    assert.match(full,/TEST_TASK_HEADER/);
    assert.doesNotMatch(full,/OLD_NOTE_CONTEXT|image_in\/|3D_out\/|\.zip|storageSection|bestiary\.md/);
    assert.ok(full.length<2300);
    const rounds=task.buildRounds(ctx);
    assert.equal(rounds.length,3);
    for(const round of rounds){
      assert.ok(round.prompt.length<1300);
      assert.doesNotMatch(round.prompt,/OLD_NOTE_CONTEXT|image_in\/|3D_out\/|\.zip|bestiary\.md/);
    }
  }
});

test('all five source templates carry matching stage IDs and avoid cross-step leakage',()=>{
  const stageFiles={
    appearance:'00_appearance',review_portrait:'02_review_portrait',
    colab:'03a_colab',blender:'03b_blender',review_3d:'04_review_3d'
  };
  for(const [stage,file] of Object.entries(stageFiles)){
    const md=fs.readFileSync(path.join(root,'docs/pipeline',file+'.prompt.md'),'utf8');
    assert.match(md,new RegExp('^<!-- COSMI-PIPELINE/2:'+stage+' -->'));
    assert.ok(md.length<1300,stage+' template too long');
    if(stage!=='blender')assert.doesNotMatch(md,/bestiary\.md|\{\{bestiary\}\}/);
  }
});
