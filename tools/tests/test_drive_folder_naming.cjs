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
    ["characters", "chr_1286", "chr_protagonist_yeh_chengxi"],
    ["characters", "chr_warden_temple_light", "chr_warden_temple_light"],
    ["creatures", "cr_aqua_slime", "ch_1st_batch_aqua_slime"],
    ["creatures", "ch_legacy_aqua_slime", "ch_1st_batch_aqua_slime"],
    ["characters", "chr_legacy_roen", "chr_protagonist_roen"],
    ["creatures", "starter_sun_line", "ch_starter_sun_line"],
    ["creatures", "line_wood_trial_boss", "ch_trial_boss_wood_line"],
    ["moves", "earth_pebble_shot", "mv_legacy_earth_pebble_shot"],
  ];
  for (const [kind, from, to] of examples) {
    assert.equal(rules.canonicalFolderName(kind, 1, from), to);
    assert.equal(rules.folderCandidates(kind, 1, from)[0], to);
    assert.ok(rules.folderCandidates(kind, 1, from).includes(from));
    assert.equal(rules.isCompliant(kind, 1, to), true);
  }
});

test("invalid non-English and traversal-like folder names fail closed", () => {
  assert.throws(() => rules.canonicalFolderName("creatures", 1, "御三家"));
  assert.throws(() => rules.canonicalFolderName("moves", 2, "../secret"));
  assert.equal(rules.isCompliant("characters", 2, "03a_colab"), false);
});

test("renamed Drive folders continue resolving original logical game identifiers", () => {
  for (const [kind, physical, logical] of [
    ["characters", "chr_protagonist_yeh_chengxi", "chr_1286"],
    ["characters", "chr_protagonist_amemori_sumiha", "chr_1855"],
    ["creatures", "ch_1st_batch_aqua_slime", "cr_aqua_slime"],
    ["creatures", "ch_starter_moon_line", "starter_moon_line"],
    ["creatures", "ch_trial_boss_wood_line", "line_wood_trial_boss"],
    ["moves", "mv_legacy_earth_pebble_shot", "earth_pebble_shot"],
    ["creatures", "ch_legacy_aqua_slime", "cr_aqua_slime"],
    ["characters", "chr_legacy_roen", "chr_3d04"],
  ]) assert.equal(rules.logicalSubjectId(kind, physical), logical);
  for (const [physical, logical] of [
    ["_03b_blender", "03b_blender"],
    ["_v2", "v2"],
    ["_models", "models"],
    ["_backup_pre_fix_20261114", "_backup_pre_fix_20261114"],
    ["_empty_before_migration_20261115_wiki", "_empty_before_migration_20261115_wiki"],
  ]) assert.equal(rules.logicalSubfolderName(physical), logical);
});

test("batch names are canonical, but historical folder names remain lookup aliases", () => {
  assert.equal(rules.isCompliant("creatures", 1, "ch_1st_batch_aqua_slime"), true);
  assert.equal(rules.isCompliant("characters", 1, "chr_protagonist_roen"), true);
  assert.equal(rules.isCompliant("characters", 1, "chr_legacy_roen"), false);
  assert.equal(rules.isCompliant("creatures", 1, "ch_legacy_aqua_slime"), false);
  assert.deepEqual(rules.folderCandidates("characters", 1, "chr_1286"),
    ["chr_protagonist_yeh_chengxi", "chr_legacy_yeh_chengxi", "chr_1286"]);
  assert.deepEqual(rules.folderCandidates("creatures", 1, "cr_aqua_slime"),
    ["ch_1st_batch_aqua_slime", "ch_legacy_aqua_slime", "cr_aqua_slime"]);
});
