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


test("strict subject filenames use physical directory names, function then form then step and version", () => {
  const expected = [
    {kind:"characters", folderName:"chr_protagonist_yeh_chengxi", role:"main", final:true, ext:"png"},
    {kind:"characters", folderName:"chr_warden_space_wind", role:"front", final:true, ext:"png"},
    {kind:"moves", folderName:"mv_legacy_earth_pebble_shot", role:"manifest", step:"01b_vfx", version:"draft", ext:"json"},
    {kind:"creatures", folderName:"ch_1st_batch_aqua_slime", role:"model", stage:"juvenile", final:true, ext:"glb"},
    {kind:"creatures", folderName:"ch_starter_sun_line", role:"turnaround", stage:"adult", step:"01_portrait", version:"v2", ext:"png"},
    {kind:"creatures", folderName:"ch_trial_boss_wood_line", role:"wiki", stage:"overload", final:true, ext:"md"},
  ];
  const names = [
    "chr_protagonist_yeh_chengxi_main.png",
    "chr_warden_space_wind_front.png",
    "mv_legacy_earth_pebble_shot_manifest_01b_vfx_draft.json",
    "ch_1st_batch_aqua_slime_model_form1.glb",
    "ch_starter_sun_line_turnaround_form3_01_portrait_v2.png",
    "ch_trial_boss_wood_line_wiki_form4.md",
  ];
  expected.forEach((input,i) => {
    const name = rules.assetFilename(input);
    assert.equal(name,names[i]);
    assert.ok(rules.isCompliantSubjectFilename(input.kind,input.folderName,name));
    const parsed = rules.parseSubjectFilename(input.kind,input.folderName,name);
    assert.equal(parsed.role,input.role);
    assert.equal(parsed.stage,input.kind==="creatures"?input.stage:"");
    assert.equal(parsed.version,input.version || "");
    assert.equal(parsed.final,!!input.final);
  });
});

test("ASCII English creature form ordinals are explicit; unknown/unofficial files fail closed", () => {
  const folder = "ch_1st_batch_aqua_slime";
  assert.equal(rules.stageIndex("juvenile"),1);
  assert.equal(rules.stageIndex("adolescent"),2);
  assert.equal(rules.stageIndex("adult"),3);
  assert.equal(rules.stageIndex("overload"),4);
  for (const file of [
    "cr_aqua_slime_adult_03b_blender.glb",
    folder + "_model.glb",
    folder + "_model_adult.glb",
    folder + "_model_form5.glb",
    folder + "_model_form1_03b_blender.glb",
    folder + "_model_form1_v1.glb",
    folder + "_model_1型態.glb",
    folder + "_model_form1_03b_blender_v0.glb",
    folder + "_front_form1_01_portrait_foobar.png",
  ]) assert.equal(rules.isCompliantSubjectFilename("creatures",folder,file),false,file);
  assert.throws(() => rules.assetFilename({kind:"creatures",folderName:folder,role:"model",ext:"glb",final:true}),/form/);
  assert.throws(() => rules.assetFilename({kind:"creatures",folderName:folder,role:"model",stage:"adult",step:"03b_blender",ext:"blend"}),/version/);
  assert.throws(() => rules.assetFilename({kind:"creatures",folderName:folder,role:"model",stage:"adult",final:true,version:"v1",ext:"glb"}),/omit/);
});

test("shared creature prompts are not misrepresented as a particular stage", () => {
  const folder = "ch_starter_sun_line";
  assert.equal(rules.isCompliantSubjectFilename("creatures",folder,folder+".prompt.md"),false);
  assert.equal(rules.isCompliantSubjectFilename("creatures",folder,folder+"_design.prompt.md"),false);
  const named = rules.assetFilename({kind:"creatures",folderName:folder,role:"design",stage:"juvenile",ext:"prompt.md",final:true});
  assert.equal(named,folder+"_design_form1.prompt.md");
  assert.equal(rules.isCompliantSubjectFilename("creatures",folder,named),true);
});
