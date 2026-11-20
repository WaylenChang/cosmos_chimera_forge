const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
function load(){
 const c={window:{}};
 vm.runInNewContext(fs.readFileSync(path.join(root,"drive-folder-naming.js"),"utf8"),c);
 vm.runInNewContext(fs.readFileSync(path.join(root,"wiki.js"),"utf8"),c);
 return c.window.COSMI_WIKI;
}
test("all subject types share a canonical _05_wiki.md suffix",()=>{
 const w=load();
 const make=(id,subjectId,stage)=>({task:{id},subjectId,opts:{stage}});
 assert.equal(w.describe(make("creature-concept","cr_fox","juvenile")).path,"creatures/cr_fox/ch_1st_batch_fox_wiki_form1_05_wiki_draft.md");
 assert.equal(w.describe(make("creature-model-rig","cr_fox","juvenile")).path,"creatures/cr_fox/ch_1st_batch_fox_wiki_form1_05_wiki_draft.md");
 assert.equal(w.describe(make("character-concept","chr_fox")).path,"characters/chr_fox/chr_protagonist_fox_wiki_05_wiki_draft.md");
 assert.equal(w.describe(make("move-vfx","fx_burst")).path,"moves/fx_burst/mv_legacy_fx_burst_wiki_05_wiki_draft.md");
 assert.equal(w.describe(make("creature-concept","cr_fox_adult","adult")).path,"creatures/cr_fox/ch_1st_batch_fox_wiki_form3_05_wiki_draft.md");
 for(const stage of w.STAGES)assert.equal(w.describe(make("creature-concept","cr_fox",stage)).stage,stage);
});
test("legacy extraction selects each stage independently and refuses missing stages",()=>{
 const w=load();
 const source="# Family\nshared lineage\n\n## Forms\n1. 幼年期 (juvenile / XS)\njuvenile_unique_design\n2. 少年期 (adolescent / S)\nadolescent_unique_design\n3. 成年期 (adult / M)\nadult_unique_design\n4. 超載期 (overload / L)\noverload_unique_design\n## 第二章：生態\nshared ecology";
 const ids=["juvenile","adolescent","adult","overload"];
 for(const stage of ids){
  const md=w.splitLegacy(source,"cr_sample",stage);
  assert.match(md,new RegExp(stage+"_unique_design"));
  assert.match(md,new RegExp("- stage: "+stage));
  for(const other of ids.filter(x=>x!==stage))assert.doesNotMatch(md,new RegExp(other+"_unique_design"));
 }
 assert.throws(()=>w.splitLegacy("no stage sections","cr_sample","juvenile"),/缺少/);
});
test("initial wiki is explicitly a draft, not an invented accepted model",()=>{
 const w=load();const md=w.initialMarkdown({task:{id:"creature-concept"},subjectId:"cr_sample",
  opts:{stage:"juvenile"},concept:{name_zh:"原始設定",locked:{stages:[{stage:"juvenile",name_zh:"幼體",look:"白色羽毛"},{stage:"adult",look:"黑色裝甲"}]}}});
 assert.match(md,/幼體/);assert.match(md,/白色羽毛/);
 assert.doesNotMatch(md,/黑色裝甲/);assert.match(md,/review_required/);
});
test("wiki module is loaded before pipeline and deployed",()=>{
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const build=fs.readFileSync(path.join(root,"tools/build-site.mjs"),"utf8");
 assert.ok(html.indexOf('src="wiki.js"')<html.indexOf('src="pipeline.js"'));
 assert.match(build,/'wiki\.js'/);
});


test("legacy extractor handles private-use text prefixes and detailed stage blocks",()=>{
 const w=load();
 const source=[
   "# Legacy", "family identity",
   "\uEC02"+"1. 幼年期 (juvenile / XS)", "young_visual_xyz",
   "2. 少年期 (adolescent / S)", "teen_visual_xyz",
   "3. 成年期 (adult / M)", "adult_visual_xyz",
   "4. 超載期 (overload / L)", "overload_visual_xyz",
   "第二章：共同生態", "must_stay_in_legacy_only"
 ].join("\n");
 for(const [stage,unique] of [["juvenile","young_visual_xyz"],["adolescent","teen_visual_xyz"],
                              ["adult","adult_visual_xyz"],["overload","overload_visual_xyz"]]){
   const md=w.splitLegacy(source,"cr_test",stage);
   assert.match(md,new RegExp(unique));
   assert.doesNotMatch(md,/must_stay_in_legacy_only/);
 }
});
test("legacy extractor prefers detailed form sections over a compact summary table",()=>{
 const w=load();
 const source=[
   "1. Juvenile", "short young", "2. Adolescent", "short teen",
   "3. Adult", "short adult", "4. Overload", "short overload",
   "1. 幼年期 (juvenile / XS)", "young_unique_long_description_with_detail",
   "2. 少年期 (adolescent / S)", "teen_unique_long_description_with_detail",
   "3. 成年期 (adult / M)", "adult_unique_long_description_with_detail",
   "4. 超載期 (overload / L)", "overload_unique_long_description_with_detail",
   "三、生態與演化", "shared ecology"
 ].join("\n");
 const adult=w.splitLegacy(source,"cr_test","adult");
 assert.match(adult,/adult_unique_long_description_with_detail/);
 assert.doesNotMatch(adult,/teen_unique_long_description_with_detail|shared ecology/);
});
test("legacy extraction rejects incomplete or misordered stages",()=>{
 const w=load();
 assert.throws(()=>w.splitLegacy("1. 幼年期 (juvenile)\nyoung\n2. 成年期 (adult)\nadult","cr_test","adult"),/缺少完整/);
});
test("creature wiki initialMarkdown includes social_structure and reproduction",()=>{
 const w=load();
 const md=w.initialMarkdown({
  task:{id:"creature-concept"},subjectId:"cr_sample",opts:{stage:"adult"},
  concept:{name_zh:"測試宙獸",social_structure:"母系氏族部落",reproduction:"卵生·硬殼築巢"}
 });
 assert.match(md,/social_structure.*"母系氏族部落"/);
 assert.match(md,/reproduction.*"卵生·硬殼築巢"/);
});

test("old manifest wiki links are normalized without touching asset files or QA", () => {
 const w = load();
 const original = {
   task_id:"asset_cr_fox_adult",
   encyclopedia_path:"wiki/creatures/cr_fox_adult_wiki.md",
   encyclopedia_paths:{juvenile:"wiki/creatures/cr_fox_juvenile_wiki.md",adult:"creatures/wiki/cr_fox_adult_wiki.md"},
   files:[{path:"models/cr_fox_adult.glb"}],
   qa_status:"REVIEW_REQUIRED"
 };
 const updated = w.normalizeManifest(original);
 assert.equal(updated.encyclopedia_path,"creatures/cr_fox/cr_fox_adult_05_wiki.md");
 assert.equal(updated.encyclopedia_paths.juvenile,"creatures/cr_fox/cr_fox_juvenile_05_wiki.md");
 assert.equal(original.encyclopedia_path,"wiki/creatures/cr_fox_adult_wiki.md");
 assert.deepEqual(updated.files,original.files);
 assert.equal(updated.qa_status,"REVIEW_REQUIRED");
 assert.equal(w.normalizeWikiPath("wiki/characters/chr_1286_wiki.md"),"characters/chr_1286/chr_1286_05_wiki.md");
 assert.equal(w.normalizeWikiPath("wiki/moves/fx_burst_wiki.md"),"moves/fx_burst/fx_burst_05_wiki.md");
 assert.equal(w.normalizeWikiPath("creatures/wiki/cr_fox_adult_wiki.md"),"creatures/cr_fox/cr_fox_adult_05_wiki.md");
});

test("move wiki draft reads only move fields, not demo-caster details",()=>{
  const w=load();
  const md=w.initialMarkdown({task:{id:"move-vfx"},subjectId:"fx_fire",
    opts:{move_name:"烈焰",element:"fire",shape:"cone",tier:"heavy",use_creature:"yes"},
    concept:{name_zh:"SECRET_CASTER",social_structure:"SECRET_LORE",appearance:"SECRET_BODY"}});
  assert.match(md,/烈焰|fire|cone|heavy/);
  assert.doesNotMatch(md,/SECRET_CASTER|SECRET_LORE|SECRET_BODY/);
});
