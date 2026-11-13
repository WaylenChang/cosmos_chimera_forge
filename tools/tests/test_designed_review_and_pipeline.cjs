const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');

function makeNode(tag = 'div') {
  const node = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    id: '',
    className: '',
    textContent: '',
    value: '',
    hidden: false,
    style: {},
    dataset: {},
    children: [],
    listeners: {},
    classList: {
      _set: new Set(),
      add(...cls) { cls.forEach(c => this._set.add(c)); },
      remove(...cls) { cls.forEach(c => this._set.delete(c)); },
      contains(c) { return this._set.has(c); }
    },
    setAttribute(k, v) { this[k] = v; },
    addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); },
    appendChild(item) {
      if (item != null && item !== false) this.children.push(item);
      return item;
    },
    append(...items) {
      for (const item of items) {
        if (item == null || item === false) continue;
        if (Array.isArray(item)) this.append(...item);
        else if (typeof item === 'string' || typeof item === 'number') this.children.push({ textContent: String(item), children: [] });
        else this.children.push(item);
      }
    },
    replaceChildren(...items) { this.children = []; this.append(...items); },
    scrollIntoView() {}
  };
  return node;
}

function collectText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  let out = node.textContent || '';
  for (const ch of (node.children || [])) out += ' ' + collectText(ch);
  return out;
}

function createHarness() {
  const nodes = {};
  const ids = [
    'toast', 'designedRailList', 'designedRailCount', 'designedStageHeader',
    'designedDetailView', 'designedList', 'designedSearch', 'designedStatusFilter',
    'designedView', 'forgeView', 'reviewView', 'settingsView',
    'viewBtnForge', 'viewBtnDesigned', 'viewBtnReview', 'viewBtnSettings',
    'forgeHeaderControls', 'designedCount'
  ];
  for (const id of ids) nodes[id] = makeNode('div');
  nodes.designedStatusFilter.value = 'all';
  nodes.designedSearch.value = '';

  const store = new Map();
  const c = {
    Blob, URL, TextDecoder, TextEncoder, Uint8Array, ArrayBuffer, DataView, File, crypto,
    console: { log() {}, warn() {}, error() {} },
    setTimeout() { return 1; },
    clearTimeout() {},
    localStorage: {
      getItem: k => store.has(k) ? store.get(k) : null,
      setItem: (k, v) => store.set(k, String(v))
    },
    document: {
      addEventListener() {},
      createElement: tag => makeNode(tag),
      createTextNode: txt => ({ textContent: String(txt), children: [] }),
      querySelector: sel => sel.startsWith('#') ? (nodes[sel.slice(1)] || null) : null,
      querySelectorAll: () => [],
      getElementById: id => nodes[id] || null
    },
    addEventListener() {},
    COSMI_DRIVE: {
      pipelineIndex: () => ({
        settings: [{ name: 'cr_sun_01.appearance.md' }],
        jobs: [{ name: 'cr-20261113-1111-0001-adult.colab.prompt.md' }],
        wikiCharacters: [{ name: 'yeh_chengxi_wiki.md' }],
        wikiCreatures: [{ name: 'cr_sun_01_juvenile_wiki.md' }],
        syncedAt: Date.now()
      }),
      syncPipelineIndex: async () => c.COSMI_DRIVE.pipelineIndex()
    }
  };
  c.window = c;
  const ctx = vm.createContext(c);
  for (const file of ['catalog.js', 'tasks.js', 'designed.js', 'pipeline.js', 'model-review.js', 'forge.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
  }
  c.DESIGNED = c.COSMI_DESIGNED.items || [];
  c.DESIGNED_CHARACTERS = c.COSMI_DESIGNED.characters || [];
  return { c, nodes, store };
}

test('designed items display approved and provisional review deliverables and prioritize ok over reject', async () => {
  const { c, nodes } = createHarness();
  const f = c.COSMI_FORGE;
  const encode = x => new TextEncoder().encode(JSON.stringify(x));
  const charId = c.DESIGNED_CHARACTERS[0].id;

  const rejPkg = await f.loadAssetFiles({
    'chr-rej/manifest.json': encode({ task_id: 'chr-rej', task_type: 'character-concept', subject_id: charId, files: [], missing: [] }),
    'chr-rej/images/main.png': new Uint8Array([1, 2, 3])
  }, { name: 'chr-rej' }, { silent: true });
  rejPkg.status = 'reject';

  const provPkg = await f.loadAssetFiles({
    'chr-prov/manifest.json': encode({ task_id: 'chr-prov', task_type: 'character-concept', subject_id: charId, files: [], missing: [] }),
    'chr-prov/images/main.png': new Uint8Array([4, 5, 6])
  }, { name: 'chr-prov' }, { silent: true });
  provPkg.status = 'provisional';

  const okPkg = await f.loadAssetFiles({
    'chr-ok/manifest.json': encode({ task_id: 'chr-ok', task_type: 'character-concept', subject_id: charId, files: [], missing: [] }),
    'chr-ok/images/main.png': new Uint8Array([7, 8, 9])
  }, { name: 'chr-ok' }, { silent: true });
  okPkg.status = 'ok';

  nodes.designedStatusFilter.value = 'all';
  await f.setViewMode('designed');
  // Select character tab/item via rail click or render
  const railText = collectText(nodes.designedRailList);
  assert.match(railText, /✅ 通過 1/);
  assert.match(railText, /🟦 暫採 1/);

  // Find the character button in designedRailList and click it
  const charBtn = nodes.designedRailList.children.find(ch => ch.listeners?.click?.length && collectText(ch).includes(charId));
  assert.ok(charBtn, 'character row should exist in designedRailList');
  charBtn.listeners.click[0]();

  const detailText = collectText(nodes.designedDetailView);
  assert.match(detailText, /成果審查台：已通過與暫時採用/);
  assert.match(detailText, /chr-ok/);
  assert.match(detailText, /chr-prov/);
  assert.doesNotMatch(detailText, /chr-rej/);

  // Test status filter ("ok" should keep only items with approved packages)
  nodes.designedStatusFilter.value = 'ok';
  nodes.designedStatusFilter.listeners.change?.[0]?.({ target: nodes.designedStatusFilter });
  // Trigger renderDesignedDesk via setViewMode if init wasn't run
  await f.setViewMode('designed');
  assert.match(collectText(nodes.designedRailList), new RegExp(charId));
});

test('unprocessed parts of designed items track pipeline generation progress including typed_state and prompts/jobs', async () => {
  const { c, nodes, store } = createHarness();
  const f = c.COSMI_FORGE;
  const encode = x => new TextEncoder().encode(JSON.stringify(x));
  const creature = c.DESIGNED[0];

  // Record a local job for adult stage colab prompt
  store.set('cosmimera.pipeline-jobs.v1', JSON.stringify({
    'cr-20261113-1111-0001-adult': {
      taskId: 'cr-20261113-1111-0001-adult',
      subjectId: creature.line_id,
      stage: 'adult',
      taskType: 'creature-model-rig',
      pipelineStage: 'colab',
      updatedAt: Date.now()
    }
  }));

  // Load a running 3D package for juvenile stage with typed_state.json
  const runPkg = await f.loadAssetFiles({
    'mdl-juv/manifest.json': encode({ task_id: 'mdl-juv', task_type: 'creature-model-rig', subject_id: creature.line_id, stage: 'juvenile', files: [], missing: ['models/x.glb'] }),
    'mdl-juv/typed_state.json': encode({ status: 'RUNNING', pipeline: 'colab', steps: { generation: { status: 'generated' }, rigging: { status: 'running' } } })
  }, { name: 'mdl-juv' }, { silent: true });
  runPkg.drivePath = '02_3d/colab/mdl-juv';

  await f.setViewMode('designed');
  const detailText = collectText(nodes.designedDetailView);
  assert.match(detailText, /未處理項目與管線生成進度追蹤/);
  assert.match(detailText, /Colab 生成中/);
  assert.match(detailText, /已送出 3D Prompt/);
  assert.match(detailText, /cr-20261113-1111-0001-adult\.colab\.prompt\.md/);
});
