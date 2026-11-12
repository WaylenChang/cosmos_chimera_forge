const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('favorite button stays icon-only in both states', () => {
  const html = read('index.html');
  const forge = read('forge.js');
  assert.match(html, /#btnFavPrompt\s*\{[^}]*max-width:\s*32px/);
  assert.match(html, /id="btnFavPrompt"[^>]*>☆<\/button>/);
  assert.match(forge, /btn\.textContent = isFav \? "★" : "☆"/);
  assert.match(forge, /btn\.dataset\.tip = label/);
  assert.doesNotMatch(forge, /btn\.textContent = "⭐ 收藏此 Prompt"/);
});

test('native portrait prompts retain the original multi-round copy controls', () => {
  const forge = read('forge.js');
  const pipeline = read('pipeline.js');
  assert.match(forge, /const useNativePortrait = pipeline && pipelineStage === "portrait"/);
  assert.match(forge, /\(!pipeline \|\| useNativePortrait\) && t\.buildRounds/);
  assert.match(forge, /"btnCopyR1"/);
  assert.match(forge, /"btnCopyR2"/);
  assert.match(forge, /"btnCopyR3"/);
  assert.match(forge, /\$\("#download"\)\.hidden = Boolean\(portraitCopyOnly\)/);
  assert.match(forge, /const portraitAuto = window\.COSMI_PIPELINE\?\.supports\(b\.ctx\) && window\.COSMI_PIPELINE\?\.isPortraitAuto\(\)/);
  assert.match(pipeline, /Object\.entries\(stages\)\.filter\(\(\[key\]\) => key !== "portrait"\)/);
});

test('portrait never requires a Drive template when assembling a prompt', () => {
  const events = {};
  const elements = {
    pipelineStage: { value: 'portrait' },
    pipelineAppearance: { value: '' },
    pipelineParameters: { value: '{}' }
  };
  const context = {
    window: {},
    document: {
      getElementById(id) { return elements[id] || null; },
      addEventListener(name, fn) { events[name] = fn; }
    },
    console
  };
  vm.runInNewContext(read('pipeline.js'), context);
  const native = 'native portrait prompt';
  const result = context.window.COSMI_PIPELINE.build({
    task: { build() { return native; } },
    taskId: 'test-portrait',
    subjectId: 'test',
    opts: {}
  });
  assert.equal(result, native);
});

test('portrait toolbar switches between manual clipboard and automated Drive writing', () => {
  const html = read('index.html');
  const drive = read('drive-storage.js');
  const pipeline = read('pipeline.js');
  assert.match(drive, /if\(!window\.COSMI_PIPELINE\?\.isPortraitAuto\(\)\)\{\$\("copy"\)\.click\(\);return;\}/);
  assert.match(drive, /await write\(path,new Blob\(\[text\],\{type:"text\/markdown"\}\)\)/);
  assert.match(pipeline, /control\.hidden = isPortrait && !automatic/);
  assert.match(pipeline, /window\.localStorage\?\.setItem\(modeKey, portraitMode\)/);
  assert.match(html, /id="portraitMode"/);
  assert.match(html, /value="manual"/);
  assert.match(html, /value="auto"/);
  assert.match(pipeline, /syncStageActions\(\)/);
  assert.match(html, /id="pipelineRead"/);
});
