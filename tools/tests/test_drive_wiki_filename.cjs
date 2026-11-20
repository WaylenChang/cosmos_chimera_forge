"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");

// Browser-side modules are loaded via window rather than CommonJS.
global.window = {
  COSMI_DRIVE_NAMES: require("../../drive-folder-naming.js"),
};
require("../../wiki.js");

test("new creature wiki drafts use physical subject, numbered form, pipeline step and draft version", () => {
  const {path, legacyName, subject, stage} = window.COSMI_WIKI.describe({
    task: {id:"creature-3d"}, subjectId:"cr_aqua_slime", opts:{stage:"juvenile"}, concept:{},
  });
  assert.equal(path,"creatures/cr_aqua_slime/ch_1st_batch_aqua_slime_wiki_form1_05_wiki_draft.md");
  assert.equal(legacyName,"cr_aqua_slime_juvenile_05_wiki.md");
  assert.equal(subject,"cr_aqua_slime");
  assert.equal(stage,"juvenile");
});

test("character wiki drafts have no creature form and retain game ID in logical directory path", () => {
  const {path} = window.COSMI_WIKI.describe({
    task:{id:"character-portrait"}, subjectId:"chr_1286", opts:{}, concept:{},
  });
  assert.equal(path,"characters/chr_1286/chr_protagonist_yeh_chengxi_wiki_05_wiki_draft.md");
});

test("creature wiki naming never guesses the form", () => {
  assert.throws(
    () => window.COSMI_WIKI.describe({task:{id:"creature-3d"}, subjectId:"cr_aqua_slime", opts:{}, concept:{}}),
    /必須指定/,
  );
});
