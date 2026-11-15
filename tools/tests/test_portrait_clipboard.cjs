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
  const html = read('index.html');
  const pipeline = read('pipeline.js');
  assert.match(forge, /const useNativePortrait = pipeline && pipelineStage === "portrait"/);
  assert.match(forge, /\(!pipeline \|\| useNativePortrait\) && t\.buildRounds/);
  assert.match(html, /id="btnCopyR1"/);
  assert.match(html, /id="btnCopyR2"/);
  assert.match(html, /id="btnCopyR3"/);
  assert.match(forge, /btnR3\.hidden = !b\.rounds\[2\]/);
  assert.match(forge, /\$\("#download"\)\.hidden = Boolean\(portraitCopyOnly\)/);
  assert.match(forge, /const portraitAuto = window\.COSMI_PIPELINE\?\.supports\(b\.ctx\) && window\.COSMI_PIPELINE\?\.isPortraitAuto\(\)/);
  assert.match(pipeline, /Object\.entries\(stages\)\.filter\(\(\[key\]\) => !\["portrait", "encyclopedia"\]\.includes\(key\)\)/);
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
  // Manual mode copies the current portrait prompt; auto mode uploads Markdown.
  assert.match(drive, /if\s*\(\s*!window\.COSMI_PIPELINE\?\.isPortraitAuto\(\)\s*\)\s*\{\s*\$\("copy"\)\.click\(\);\s*return;\s*\}/);
  assert.match(drive, /await write\(\s*path,\s*new Blob\(\[text\],\s*\{\s*type:\s*"text\/markdown"\s*\}\)\s*\)/);
  assert.match(pipeline, /control\.hidden = isPortrait && !automatic/);
  assert.match(pipeline, /window\.localStorage\?\.setItem\(modeKey, portraitMode\)/);
  assert.match(html, /id="portraitMode"/);
  assert.match(html, /value="manual"/);
  assert.match(html, /value="auto"/);
  assert.match(pipeline, /syncStageActions\(\)/);
  assert.match(html, /id="pipelineRead"/);
});

test('creature-concept outputs only front and turnaround without main portrait, while character-concept keeps 3 rounds', () => {
  const ctx = { window: {} };
  vm.runInNewContext(read('catalog.js'), ctx);
  vm.runInNewContext(read('tasks.js'), ctx);
  const tasks = ctx.window.COSMI_TASKS;
  const crTask = tasks.find(t => t.id === 'creature-concept');
  const chrTask = tasks.find(t => t.id === 'character-concept');
  const crCtx = {
    task: crTask, subjectId: 'cr_test', taskId: 'cr-20261115-test-adult', header: '[TEST]', platformName: 'Gemini',
    concept: { name_zh: '測試宙獸', bases: ['狼'], elements: ['fire'], appearance_palette: ['赤紅'] },
    opts: { stage: 'adult' }, notes: ''
  };
  const crRounds = crTask.buildRounds(crCtx);
  assert.equal(crRounds.length, 2);
  assert.deepEqual(Array.from(crRounds, r => r.filename), ['cr_cr_test_adult_front.png', 'cr_cr_test_adult_turnaround.png']);
  const crFull = crTask.build(crCtx);
  assert.doesNotMatch(crFull, /_main\.png|主立繪/);

  const chrCtx = {
    task: chrTask, subjectId: 'chr_test', taskId: 'chr-20261115-test', header: '[TEST]', platformName: 'Gemini',
    concept: { name_zh: '測試角色', role: '旅人' },
    opts: {}, notes: ''
  };
  const chrRounds = chrTask.buildRounds(chrCtx);
  assert.equal(chrRounds.length, 3);
  assert.deepEqual(Array.from(chrRounds, r => r.filename), ['chr_test_front.png', 'chr_test_turnaround.png', 'chr_test_main.png']);
});
