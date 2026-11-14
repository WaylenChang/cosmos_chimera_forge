const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "../..");
const source = name => fs.readFileSync(path.join(root, name), "utf8");

test("all category wikis resolve under their own asset root", () => {
  const context = { window: {} };
  vm.runInNewContext(source("wiki.js"), context, { filename: "wiki.js" });
  const describe = context.window.COSMI_WIKI.describe;
  for (const [task, subject, stage, expected] of [
    ["character-concept", "chr_hero", "", "characters/wiki/chr_hero_wiki.md"],
    ["creature-concept", "cr_fox", "juvenile", "creatures/wiki/cr_fox_juvenile_wiki.md"],
    ["creature-model-rig", "cr_fox", "adult", "creatures/wiki/cr_fox_adult_wiki.md"],
    ["move-vfx", "fx_burst", "", "moves/wiki/fx_burst_wiki.md"],
  ]) {
    assert.equal(describe({ task: { id: task }, subjectId: subject, opts: { stage } }).path, expected);
  }
});

test("active Drive scans use category roots only; migration keeps legacy sources", () => {
  const drive = source("drive-storage.js");
  assert.match(drive, /const dirs = categoryDirs;/);
  assert.match(drive, /const legacyDirs = \[/);
  assert.match(drive, /"characters\/wiki"/);
  assert.match(drive, /"creatures\/wiki"/);
  assert.match(drive, /root \+ "\/reviews\/"/);
  assert.doesNotMatch(drive, /const dirs = \[\.\.\.categoryDirs, \.\.\.legacyDirs\]/);
});

test("task-flow documentation never produces wiki/category paths", () => {
  const flow = source("task-flow.js");
  assert.doesNotMatch(flow, /wiki\/<characters\|creatures>/);
  assert.doesNotMatch(flow, /wiki\/moves\//);
  assert.match(flow, /moves\/wiki\//);
});
