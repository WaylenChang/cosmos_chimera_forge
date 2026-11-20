"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "../..");
const load = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root, "designed.js"), "utf8"), context);
const designs = JSON.parse(JSON.stringify(context.window.COSMI_DESIGNED.items));
const byLine = new Map(designs.map(d => [d.line_id, d]));
const byForm = new Map(designs.flatMap(d => d.concept.locked.stages.map(f => [f.creature_id, d])));
const canonical = d => {
  const forms = d.concept.locked.stages;
  return forms.find(f => f.stage === "overload") || forms.find(f => f.stage === "adult") || forms.at(-1);
};

test("all multi-form creatures share one canonical bilingual species name", () => {
  assert.equal(designs.length, 45);
  for (const d of designs) {
    const forms = d.concept.locked.stages;
    const official = canonical(d);
    assert.ok(official.name_zh && official.name_en, d.line_id);
    assert.equal(d.title_zh, official.name_zh, d.line_id);
    for (const f of forms) {
      assert.equal(f.name_zh, official.name_zh, d.line_id + ":" + f.stage);
      assert.equal(f.name_en, official.name_en, d.line_id + ":" + f.stage);
    }
  }
});

test("canonical names are retained in all creature draft copy batches", () => {
  for (const file of [
    "Data/_incoming/p2-08-starters-draft-01/copy-terra.json",
    "Data/_incoming/p5-03-creatures-draft-01/copy-terra.json",
    "Data/_incoming/p5-03-creatures-draft-02/copy-terra.json",
  ]) {
    for (const entry of load(file).creatures) {
      const d = byForm.get(entry.id);
      assert.ok(d, "unmapped creature id " + entry.id);
      assert.equal(entry.name_zh, canonical(d).name_zh, entry.id);
      assert.equal(entry.name_en, canonical(d).name_en, entry.id);
    }
  }
});

test("encyclopedia imports and authored entries use line names, not form nicknames", () => {
  const imports = load("Data/_incoming/p4-09-encyclopedia-01/creatures/drive-creatures.json");
  const entries = load("Data/_incoming/p4-09-encyclopedia-authored-01/encyclopedia/entries.json")
    .filter(e => e.kind === "creature");
  assert.equal(imports.length, 60);
  assert.equal(entries.length, 93);
  for (const entry of imports) {
    const d = byLine.get(entry.line_id);
    assert.ok(d, entry.id);
    assert.equal(entry.concept.name_zh, canonical(d).name_zh, entry.id);
    assert.equal(entry.concept.name_en, canonical(d).name_en, entry.id);
  }
  for (const entry of entries) {
    const d = byLine.get(entry.subject_id);
    assert.ok(d, entry.id);
    assert.equal(entry.basic.name_zh, canonical(d).name_zh, entry.id);
    assert.equal(entry.basic.name_en, canonical(d).name_en, entry.id);
  }
});

test("Drive folders keep stable lineage names and no stage-named subject directories", () => {
  const map = load("docs/drive/folder-migration-map-2026-11-20.json");
  const subjects = map.folders.filter(x => x.kind === "creatures" && x.depth === 1 && !x.target.startsWith("_"));
  assert.equal(subjects.length, 28);
  assert.ok(subjects.every(x => /^ch_[a-z0-9]+(?:_[a-z0-9]+)+$/.test(x.target)));
  assert.ok(subjects.every(x => !/_(juvenile|adolescent|adult|overload)(?:_|$)/.test(x.target)));
  assert.equal(new Set(subjects.map(x => x.id)).size, subjects.length);
});
