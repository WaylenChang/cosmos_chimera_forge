const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const forge = fs.readFileSync(path.join(root, 'forge.js'), 'utf8');
const pipelineSource = fs.readFileSync(path.join(root, 'pipeline.js'), 'utf8');
const drive = fs.readFileSync(path.join(root, 'drive-storage.js'), 'utf8');

function flowModule() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'task-flow.js'), 'utf8'), context);
  return context.window.COSMI_TASK_FLOW;
}
function pipelineModule() {
  const context = {
    window: { localStorage: { getItem: () => null } },
    document: {
      getElementById: () => null,
      addEventListener: () => {}
    },
    console
  };
  vm.runInNewContext(pipelineSource, context);
  return context.window.COSMI_PIPELINE;
}
test('category must be selected before route; route must be selected before nodes', () => {
  const flow = flowModule();
  assert.equal(flow.selectRoute(null, 'image'), null);
  assert.equal(flow.selectStep(null, 'appearance'), null);
  const chosen = flow.selectCategory('creature');
  assert.equal(chosen.category, 'creature');
  assert.equal(chosen.route, null);
  assert.equal(chosen.step, null);
  assert.equal(flow.selectStep(chosen, 'appearance'), null);
  assert.equal(flow.selectRoute(chosen, 'invalid'), null);
  const routed = flow.selectRoute(chosen, 'text');
  assert.equal(routed.route, 'text');
  assert.equal(routed.step, 'appearance');
  assert.equal(flow.selectStep(routed, 'image_colab'), null);
  assert.equal(flow.selectStep(routed, 'prompt_3d').step, 'prompt_3d');
  const move = flow.selectRoute(flow.selectCategory('move'), 'move');
  assert.equal(move.step, 'encyclopedia');
  assert.equal(flow.selectRoute(flow.selectCategory('move'), 'image'), null);
});
test('both routes are visible in one horizontal diagram with shared endpoints', () => {
  const flow = flowModule();
  for (const kind of ['character','creature']) {
    const rows = Array.from(flow.diagram(kind));
    assert.equal(rows.length,3);
    assert.equal(rows[0].type,'step');
    assert.equal(rows[0].shared,true);
    assert.equal(rows[0].steps[0].id,'appearance');
    assert.equal(rows[1].type,'fork');
    assert.equal(rows[2].shared,true);
    assert.equal(rows[2].steps[0].id,'review_3d');
    const lanes=Array.from(rows[1].lanes);
    assert.deepEqual(lanes.map(l=>l.id),['image','text']);
    assert.deepEqual(Array.from(lanes[0].segments,s=>s.type),['step','step','parallel']);
    assert.deepEqual(Array.from(lanes[0].segments[2].tracks,s=>s[0].id),['image_colab','image_blender']);
    assert.deepEqual(Array.from(lanes[1].segments,s=>s.steps[0].id),
      ['prompt_3d','portrait_3d','review_portrait_3d']);
  }
  assert.deepEqual(Array.from(flow.diagram('move'),r=>r.steps[0].id),['encyclopedia','move_vfx']);
});
test('task graph is horizontally scrollable and category selection needs no route switch', () => {
  assert.match(html, /<h2>任務流程圖<\/h2>/);
  assert.match(html, /\.task-flow-list \{ display:flex !important; flex-direction:row/);
  assert.match(html, /overflow-x:auto/);
  assert.match(html, /flow-lanes/); 
  assert.match(html, /flow-parallel-tracks/);
  assert.doesNotMatch(html, /id="taskRoutes"/);
  assert.match(forge, /function chooseCategory\(category\)/);
  assert.doesNotMatch(forge, /function chooseRoute\(route\)/);
  assert.match(forge, /taskFlow\.diagram\(kind\)/);
  assert.match(forge, /onclick:\(\)=>chooseFlow\(kind,route,step.id\)/);
  assert.match(forge, /window\.matchMedia(?:\?\.)?\(/);
  assert.match(html, /\.task-flow-list \{[^}]*flex-wrap:nowrap !important;/);
  assert.match(forge, /window\.scrollTo\(/);
});
test('appearance is derived from current concept data, without duplicate input', () => {
  const pipeline = pipelineModule();
  const context = {
    concept: {name_zh: '測試角色', body_type: ['高挑'], appearance_palette: ['冷色']},
    opts: {stage: 'adult'},
    notes: '增加金色線條'
  };
  const result = pipeline.appearance(context);
  assert.match(result, /name_zh: 測試角色/);
  assert.match(result, /appearance_palette/);
  assert.match(result, /補充／修改: 增加金色線條/);
  assert.doesNotMatch(html, /id="pipelineAppearance"/);
  assert.doesNotMatch(pipelineSource, /pipelineAppearance/);
  assert.doesNotMatch(drive, /pipelineAppearance/);
  assert.doesNotMatch(drive, /\.appearance\.md"/);
});
test('format JSON is located below Prompt output, with save and load controls', () => {
  const promptAt = html.indexOf('<textarea id="prompt"');
  const formatAt = html.indexOf('id="pipelineParameters"');
  const favoritesAt = html.indexOf('id="favoritesSection"');
  assert.ok(promptAt >= 0 && promptAt < formatAt && formatAt < favoritesAt);
  for (const id of ['pipelineParameters', 'pipelineSaveSettings', 'pipelineLoadSettings']) {
    assert.equal((html.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1);
  }
  assert.match(drive, /已儲存格式參數/);
  assert.match(drive, /已載入格式參數/);
});
