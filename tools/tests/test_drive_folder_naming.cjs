"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const rules = require("../../drive-folder-naming.js");

test("category helper folders begin with underscore", () => {
  for (const kind of ["characters", "creatures", "moves"]) {
    for (const name of ["designed_prompts", "backup", "prompts", "00_settings", "03b_blender", "reviews", "v2", "models", "jobs"]) {
      const depth = ["designed_prompts", "backup", "prompts"].includes(name) ? 1 : 2;
      assert.equal(rules.canonicalFolderName(kind, depth, name), "_" + name);
      assert.equal(rules.isCompliant(kind, depth, "_" + name), true);
    }
  }
});

test("subject directory names use category, batch and English name", () => {
  const examples = [
    ["characters", "chr_1286", "chr_legacy_yeh_chengxi"],
    ["characters", "chr_warden_temple_light", "chr_warden_temple_light"],
    ["creatures", "cr_aqua_slime", "ch_legacy_aqua_slime"],
    ["creatures", "starter_sun_line", "ch_starter_sun_line"],
    ["creatures", "line_wood_trial_boss", "ch_trial_boss_wood_line"],
    ["moves", "earth_pebble_shot", "mv_legacy_earth_pebble_shot"],
  ];
  for (const [kind, from, to] of examples) {
    assert.equal(rules.canonicalFolderName(kind, 1, from), to);
    assert.deepEqual(rules.folderCandidates(kind, 1, from), from === to ? [to] : [to, from]);
    assert.equal(rules.isCompliant(kind, 1, to), true);
  }
});

test("invalid non-English and traversal-like folder names fail closed", () => {
  assert.throws(() => rules.canonicalFolderName("creatures", 1, "御三家"));
  assert.throws(() => rules.canonicalFolderName("moves", 2, "../secret"));
  assert.equal(rules.isCompliant("characters", 2, "03a_colab"), false);
});
