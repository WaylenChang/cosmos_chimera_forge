const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
function load(){
 const c={window:{}};
 vm.runInNewContext(fs.readFileSync(path.join(root,"wiki.js"),"utf8"),c);
 return c.window.COSMI_WIKI;
}
test("all subject types share a canonical _wiki.md suffix",()=>{
 const w=load();
 const make=(id,subjectId,stage)=>({task:{id},subjectId,opts:{stage}});
 assert.equal(w.describe(make("creature-concept","cr_fox","juvenile")).path,"wiki/creatures/cr_fox_juvenile_wiki.md");
 assert.equal(w.describe(make("creature-model-rig","cr_fox","juvenile")).path,"wiki/creatures/cr_fox_juvenile_wiki.md");
 assert.equal(w.describe(make("character-concept","chr_fox")).path,"wiki/characters/chr_fox_wiki.md");
 assert.equal(w.describe(make("move-vfx","fx_burst")).path,"wiki/moves/fx_burst_wiki.md");
 assert.equal(w.describe(make("creature-concept","cr_fox_adult","adult")).path,"wiki/creatures/cr_fox_adult_wiki.md");
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
