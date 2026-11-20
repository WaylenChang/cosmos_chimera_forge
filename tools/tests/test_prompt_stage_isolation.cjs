const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');

test('move VFX includes only move fields and minimal optional caster geometry',()=>{
  const ctx={window:{},COSMI_CATALOG:{
    ELEMENTS:[{v:'fire',zh:'火',palette:['#ff4400']}],
    VFX:{shapes:[{v:'cone',zh:'扇形'}],tiers:[{v:'heavy',zh:'強'}],common:[{v:'spark',zh:'火花'}]}
  }};
  ctx.window=ctx;
  vm.runInNewContext(fs.readFileSync(path.join(root,'tasks.js'),'utf8'),ctx);
  const task=ctx.COSMI_TASKS.find(t=>t.id==='move-vfx');
  const base={
    task,taskId:'fx-test',subjectId:'fx_test',header:'TEST_HEADER',platformName:'ChatGPT',
    opts:{element:'fire',shape:'cone',tier:'heavy',common:[],use_creature:'yes',move_name:'烈焰'},
    concept:{size_profile:'M',anatomy:'quadruped',appearance:'SECRET_CREATURE_LOOK',
      social_structure:'SECRET_LORE',biography:'SECRET_BACKGROUND'},
    notes:'SECRET_STALE_NOTES'
  };
  const prompt=task.nativeBuild(base);
  assert.match(prompt,/烈焰|火|扇形|強/);
  assert.match(prompt,/size_profile|quadruped/);
  assert.doesNotMatch(prompt,/SECRET_CREATURE_LOOK|SECRET_LORE|SECRET_BACKGROUND|SECRET_STALE_NOTES/);
  assert.doesNotMatch(prompt,/fx_common_spark|## 畫風要求|## 原創與文化準則|image_in\/|3D_out\//);
  const noCaster=task.nativeBuild({...base,opts:{...base.opts,use_creature:'no'}});
  assert.doesNotMatch(noCaster,/size_profile|quadruped|SECRET_CREATURE_LOOK/);
});

test('source templates are versioned for isolation and no longer request duplicate bestiary',()=>{
  for(const [stage,file] of Object.entries({
    appearance:'00_appearance',review_portrait:'02_review_portrait',
    colab:'03a_colab',blender:'03b_blender',review_3d:'04_review_3d'
  })){
    const source=fs.readFileSync(path.join(root,'docs/pipeline',file+'.prompt.md'),'utf8');
    assert.match(source,new RegExp('^<!-- COSMI-PIPELINE/3:'+stage+' -->'));
    assert.doesNotMatch(source,/bestiary\\.md|\\{\\{bestiary\\}\\}/);
  }
});
