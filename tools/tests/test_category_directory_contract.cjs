const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "../..");
const source = name => fs.readFileSync(path.join(root, name), "utf8");

test("all category wikis resolve under their own subject root", () => {
  const context = { window: {} };
  vm.runInNewContext(source("wiki.js"), context, { filename: "wiki.js" });
  const describe = context.window.COSMI_WIKI.describe;
  for (const [task, subject, stage, expected] of [
    ["character-concept", "chr_hero", "", "characters/chr_hero/chr_hero_05_wiki.md"],
    ["creature-concept", "cr_fox", "juvenile", "creatures/cr_fox/cr_fox_juvenile_05_wiki.md"],
    ["creature-model-rig", "cr_fox", "adult", "creatures/cr_fox/cr_fox_adult_05_wiki.md"],
    ["move-vfx", "fx_burst", "", "moves/fx_burst/fx_burst_05_wiki.md"],
  ]) {
    assert.equal(describe({ task: { id: task }, subjectId: subject, opts: { stage } }).path, expected);
  }
});

test("active Drive scans use category roots only; migration keeps legacy sources", () => {
  const drive = source("drive-storage.js");
  assert.match(drive, /const dirs = categoryRoots;/);
  assert.match(drive, /const legacyDirs = \[/);
  assert.match(drive, /const categoryRoots = \["characters", "creatures", "moves"\]/);
  assert.doesNotMatch(drive, /const dirs = \[\.\.\.categoryDirs, \.\.\.legacyDirs\]/);
});

test("task-flow documentation never produces wiki/category paths", () => {
  const flow = source("task-flow.js");
  assert.doesNotMatch(flow, /wiki\/<characters\|creatures>/);
  assert.doesNotMatch(flow, /wiki\/moves\//);
  assert.match(flow, /moves\/<id>\/<id>_05_wiki\.md/);
});

test("category-first pipeline directory resolver handles aliases and rejects invalid stages", () => {
  const context = {
    window: { COSMI_DRIVE_CONFIG: {} },
    document: { addEventListener() {} },
  };
  vm.runInNewContext(source("drive-storage.js"), context, { filename: "drive-storage.js" });
  const drive = context.window.COSMI_DRIVE;
  for (const [kind, stage, id, expected] of [
    ["characters", "portrait", "chr_hero", "characters/chr_hero"],
    ["creatures", "03a_colab", "cr_fox", "creatures/cr_fox"],
    ["characters", "colab_ai_blender", "chr_hero", "characters/chr_hero"],
    ["creatures", "ai_blender", "cr_fox_adult", "creatures/cr_fox"],
    ["moves", "vfx", "fx_burst", "moves/fx_burst"],
  ]) {
    assert.equal(drive.pipelineDirectory(kind, stage, id), expected);
  }
  assert.equal(drive.assetStem({ kind: "characters", id: "chr_hero", step: "01_portrait" }), "chr_hero_01_portrait");
  assert.equal(drive.assetStem({ kind: "creatures", id: "cr_fox", stage: "juvenile", step: "03a_colab", version: "v2" }), "cr_fox_juvenile_03a_colab_v2");
  assert.equal(drive.assetStem({ kind: "moves", id: "fx_burst", stage: "adult", step: "01b_vfx" }), "fx_burst_01b_vfx");
  assert.throws(() => drive.pipelineDirectory("moves", "colab"), /VFX/);
  assert.throws(() => drive.pipelineDirectory("creatures", "unrecognized"), /未知管線/);
});

test("pipeline templates stay isolated across category switches", async () => {
  const requested = [];
  let current = { task: { id: "character-model-rig" }, subjectId: "chr_hero", taskId: "chr_hero" };
  const context = {
    window: {
      COSMI_FORGE: { currentContext: () => current, activePackage: () => null, packages: () => [] },
      COSMI_DRIVE: {
        pipelineRoot: ctx => ctx.task.id.startsWith("character") ? "characters" : "creatures",
        read: async name => {
          requested.push(name);
          if (name === "00_settings/default.parameters.json") return { text: async () => "{}" };
          return { text: async () => "<!-- COSMI-PIPELINE/2:review_portrait -->\n" + name };
        }
      }
    },
    document: { addEventListener() {}, getElementById: id => id === "pipelineStage" ? { value: "review_portrait" } : null },
    console
  };
  vm.runInNewContext(source("pipeline.js"), context, { filename: "pipeline.js" });
  const pipeline = context.window.COSMI_PIPELINE;
  await pipeline.loadTemplates();
  assert.equal(pipeline.templates.review_portrait.includes("characters/prompts/"), true);
  current = { task: { id: "creature-model-rig" }, subjectId: "cr_fox", taskId: "cr_fox" };
  await pipeline.loadTemplates();
  assert.equal(pipeline.templates.review_portrait.includes("creatures/prompts/"), true);
  assert.equal(requested.some(x => x === "creatures/prompts/02_review_portrait.prompt.md"), true);
  current = { task: { id: "character-model-rig" }, subjectId: "chr_hero", taskId: "chr_hero" };
  const characterPrompt = pipeline.build(current);
  assert.match(characterPrompt, /characters\/prompts\/02_review_portrait\.prompt\.md/);
  current = { task: { id: "creature-model-rig" }, subjectId: "cr_fox", taskId: "cr_fox" };
  const creaturePrompt = pipeline.build(current);
  assert.match(creaturePrompt, /creatures\/prompts\/02_review_portrait\.prompt\.md/);
});
