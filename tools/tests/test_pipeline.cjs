const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
function harness() {
  const nodes = {pipelineStage: {value: 'portrait'}, pipelineParameters: {value: '{"secret_format":"DO_NOT_LEAK"}'}, pipelineSource: {value: ''}};
  const c = {document: {getElementById: id => nodes[id], addEventListener() {}}, COSMI_FORGE: {activePackage: () => ({subjectId:'chr_one',drivePath: 'characters/02_3d/colab/model'}), packages: () => [{id:'source',drivePath:'characters/03_completed/portraits/source'}]}};
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

test('portrait uses only native per-target instructions', () => {
  const {c,nodes,ctx}=harness();nodes.pipelineStage.value='portrait';
  c.COSMI_PIPELINE.templates.portrait='LEGACY_DRIVE_TEMPLATE';
  for(const id of ['character-concept','creature-concept']){
    ctx.task.id=id;ctx.task.build=()=> 'NATIVE_PORTRAIT_'+id;
    assert.equal(c.COSMI_PIPELINE.build(ctx),'NATIVE_PORTRAIT_'+id);
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
  assert.ok(!requests.some(file => file.endsWith('/01_portrait.prompt.md')));
  assert.equal(requests.filter(file => file.startsWith('creatures/prompts/')).length, Object.keys(c.COSMI_PIPELINE.stages).length-2);
});

test('independent encyclopedia step generates a scoped player-wiki prompt', () => {
  const {c,nodes,ctx}=harness();
  assert.equal(c.COSMI_PIPELINE.stages.encyclopedia,'05_encyclopedia');
  nodes.pipelineStage.value='encyclopedia';
  ctx.concept={name_zh:'角色甲',role:'守護者',appearance:'blue armor',secret_skill:'NOT_FOR_WIKI'};
  const character=c.COSMI_PIPELINE.build(ctx);
  assert.match(character,/編寫玩家可閱讀的角色圖鑑|characters\\/chr_one\\/chr_one_05_wiki\\.md/);
  assert.match(character,/守護者|blue armor/);
  assert.doesNotMatch(character,/NOT_FOR_WIKI/);
  ctx.task.id='creature-concept';ctx.subjectId='cr_one';ctx.opts={stage:'juvenile'};
  ctx.concept={name_zh:'獸甲',locked:{stages:[
    {stage:'juvenile',look:'JUVENILE_ONLY',social_structure:'群居'},
    {stage:'adult',look:'ADULT_SECRET'}
  ]},appearance:'blue scales'};
  const creature=c.COSMI_PIPELINE.build(ctx);
  assert.match(creature,/creatures\\/cr_one\\/cr_one_juvenile_05_wiki\\.md|JUVENILE_ONLY/);
  assert.doesNotMatch(creature,/ADULT_SECRET/);
  ctx.task.id='move-vfx';ctx.subjectId='fx_fire';ctx.opts={
    move_name:'烈焰',element:'fire',shape:'cone',tier:'heavy',use_creature:'yes'
  };
  ctx.concept={name_zh:'SECRET_CASTER',biography:'SECRET_BIO'};
  const move=c.COSMI_PIPELINE.build(ctx);
  assert.match(move,/moves\\/fx_fire\\/fx_fire_05_wiki\\.md|烈焰/);
  assert.doesNotMatch(move,/SECRET_CASTER|SECRET_BIO/);
});

test('appearance excludes encyclopedia, lore, geometry and unrelated notes', () => {
  const {c,nodes,ctx}=harness();nodes.pipelineStage.value='appearance';
  ctx.notes='STALE_NOTES';ctx.concept.role='captain';
  const text=c.COSMI_PIPELINE.build(ctx);
  assert.match(text,/red|long coat/);
  assert.doesNotMatch(text,/05_wiki|STALE_NOTES|captain|combat_damage|\.glb|\.json/);
  ctx.task.id='creature-concept';ctx.subjectId='cr_one';
  ctx.concept={name_zh:'獸',appearance:'blue scales',social_structure:'母系氏族部落',reproduction:'卵生·硬殼築巢'};
  const creature=c.COSMI_PIPELINE.build(ctx);
  assert.match(creature,/blue scales/);
  assert.doesNotMatch(creature,/母系氏族部落|卵生·硬殼築巢|05_wiki/);
  assert.match(c.COSMI_PIPELINE.appearance(ctx,{pureVisual:false}),/母系氏族部落/);
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
  c.COSMI_FORGE.activePackage=()=>({subjectId:'chr_one',drivePath:'characters/02_3d/ai_blender/model',sourcePack:'source'});
  const text=c.COSMI_PIPELINE.build(ctx);
  assert.match(text,/03_completed\/portraits\/source/);assert.doesNotMatch(text,/unrelated/);
});


test('a previous review binding does not become an image source for prompt-only modeling', () => {
 const {c,nodes,ctx}=harness();nodes.pipelineStage.value='blender';nodes.pipelineSource.value='unrelated-old-source';ctx.opts.source_pack='';
 const text=c.COSMI_PIPELINE.build(ctx);assert.doesNotMatch(text,/unrelated-old-source/);assert.match(text,/純文字外觀/);
});


test('3D stages focus on their own object without game encyclopedia instructions', () => {
  const {c,nodes,ctx}=harness();
  ctx.task.id='creature-model-rig';ctx.subjectId='cr_one';
  for(const stage of ['colab','blender']){
    nodes.pipelineStage.value=stage;
    const text=c.COSMI_PIPELINE.build(ctx);
    assert.match(text,/網格|拓撲/);
    assert.match(text,/models\/chr-example\.blend|models\/chr-example\.glb/);
    assert.doesNotMatch(text,/encyclopedia|wiki|bestiary|圖鑑|百科/i);
    assert.doesNotMatch(text,/少年.*成年|社會型態|DO_NOT_LEAK|combat_damage|\{\{[a-z_]+\}\}/);
  }
  nodes.pipelineStage.value='blender';ctx.opts.source_pack='';ctx.opts.input_img='';
  ctx.pipelineRoute='text';
  const prompt=c.COSMI_PIPELINE.build(ctx);
  assert.match(prompt,/純文字外觀|Prompt-to-3D/);
  assert.doesNotMatch(prompt,/03_completed\/portraits\/source|bestiary\.md|另建.*圖鑑|juvenile.*adolescent/);
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
  const cases={appearance:'外觀設定',review_portrait:'立繪審查',review_3d:'3D 模型最終驗收',colab:'Colab Image-to-3D',blender:'Blender'};
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

test('versioned Drive templates still apply, without passing their metadata to the AI',async()=>{
  const {c,nodes,ctx}=harness();
  nodes.pipelineStage.value='review_portrait';
  c.COSMI_FORGE.currentContext=()=>ctx;
  c.COSMI_DRIVE={read: async file => ({text: async () => file.endsWith('/02_review_portrait.prompt.md')
    ? '<!-- COSMI-PIPELINE/3:review_portrait -->\n# CUSTOM VERIFIED REVIEW\n待審：{{input_path}}'
    : '{}'})};
  await c.COSMI_PIPELINE.loadTemplates();
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
    assert.equal(rounds.length,id==='creature-concept'?2:3);
    for(const round of rounds){
      assert.ok(round.prompt.length<1300);
      assert.doesNotMatch(round.prompt,/OLD_NOTE_CONTEXT|image_in\/|3D_out\/|\.zip|bestiary\.md/);
    }
  }
});

test('original v2 source templates are retained with their existing stage IDs',()=>{
  const stageFiles={
    appearance:'00_appearance',review_portrait:'02_review_portrait',
    colab:'03a_colab',blender:'03b_blender',review_3d:'04_review_3d'
  };
  for(const [stage,file] of Object.entries(stageFiles)){
    const md=fs.readFileSync(path.join(root,'docs/pipeline',file+'.prompt.md'),'utf8');
    assert.match(md,new RegExp('^<!-- COSMI-PIPELINE/2:'+stage+' -->'));
    assert.ok(md.length<1300,stage+' template too long');
    if(stage!=='blender') assert.doesNotMatch(md,/bestiary\.md|\{\{bestiary\}\}/);
  }
});

test('image route never silently becomes text modeling when a source is absent', () => {
  const {c,nodes,ctx}=harness();
  nodes.pipelineStage.value='blender';
  ctx.pipelineRoute='image';ctx.opts={source_pack:'',input_img:''};
  const prompt=c.COSMI_PIPELINE.build(ctx);
  assert.match(prompt,/Image-to-3D|請指定已核准圖片來源/);
  assert.doesNotMatch(prompt,/純文字外觀|Prompt-to-3D/);
});

test('review never borrows another subject\'s active model or source', () => {
  const {c,nodes,ctx}=harness();
  nodes.pipelineStage.value='review_3d';
  c.COSMI_FORGE.activePackage=()=>({
    subjectId:'chr_other',drivePath:'characters/02_3d/other_model',
    sourcePack:'other_source',manifest:{input_mode:'text'}
  });
  ctx.pipelineRoute='image';
  const prompt=c.COSMI_PIPELINE.build(ctx);
  assert.match(prompt,/請指定本對象待審模型目錄/);
  assert.doesNotMatch(prompt,/other_model|other_source|純文字外觀/);
});

test('appearance ignores empty and unknown fields but keeps relevant visual features', () => {
  const {c,ctx}=harness();
  ctx.concept={appearance:'silver armor',height:'未知',hair_palette:[],role:'SECRET_ROLE',social_structure:'SECRET_LORE'};
  const result=c.COSMI_PIPELINE.appearance(ctx);
  assert.match(result,/silver armor/);
  assert.doesNotMatch(result,/未知|hair_palette|SECRET_ROLE|SECRET_LORE/);
});

test('a current version Drive template containing encyclopedia instructions is rejected',async()=>{
  const {c,nodes,ctx}=harness();
  nodes.pipelineStage.value='blender';
  c.COSMI_FORGE.currentContext=()=>ctx;
  c.COSMI_DRIVE={read:async path=>({text:async()=>path.endsWith('/03b_blender.prompt.md')
    ? '<!-- COSMI-PIPELINE/3:blender -->\n# WIKI_POISON\n請參照玩家圖鑑產生3D\n{{model_input}}'
    : '{}'})};
  await c.COSMI_PIPELINE.loadTemplates();
  const text=c.COSMI_PIPELINE.build(ctx);
  assert.match(text,/Blender/);
  assert.doesNotMatch(text,/WIKI_POISON|圖鑑|wiki/i);
});

test('other stages never consult wiki and ignore a poisoned wiki concept property', () => {
  const {c,nodes,ctx}=harness();
  Object.defineProperty(ctx.concept,'wiki',{enumerable:true,get(){throw Error('PLAYER_WIKI_WAS_READ')}});
  Object.defineProperty(ctx.concept,'encyclopedia',{enumerable:true,get(){throw Error('PLAYER_WIKI_WAS_READ')}});
  for(const stage of ['appearance','review_portrait','colab','blender','review_3d']){
    nodes.pipelineStage.value=stage;
    assert.doesNotThrow(()=>c.COSMI_PIPELINE.build(ctx),stage);
    assert.doesNotMatch(c.COSMI_PIPELINE.build(ctx),/PLAYER_WIKI_WAS_READ|圖鑑|wiki/i);
  }
});
