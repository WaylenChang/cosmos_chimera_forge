const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const read = filename => fs.readFileSync(path.join(root, filename), 'utf8');

function makeNode(tag = 'div', id = '') {
  const node = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    id,
    className: '',
    textContent: '',
    value: '',
    hidden: false,
    isConnected: true,
    style: {},
    dataset: {},
    children: [],
    parentElement: null,
    parentNode: null,
    listeners: {},
    classList: {
      _set: new Set(),
      add(...cls) { cls.forEach(c => this._set.add(c)); },
      remove(...cls) { cls.forEach(c => this._set.delete(c)); },
      toggle(c, force) {
        if (force === undefined) this._set.has(c) ? this._set.delete(c) : this._set.add(c);
        else if (force) this._set.add(c);
        else this._set.delete(c);
      },
      contains(c) { return this._set.has(c); }
    },
    setAttribute(k, v) { this[k] = v; },
    addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); },
    _detach() {
      if (this.parentElement) {
        this.parentElement.children = this.parentElement.children.filter(c => c !== this);
      }
      this.parentElement = null;
      this.parentNode = null;
    },
    appendChild(item) {
      if (item && typeof item === 'object' && item._detach) {
        item._detach();
        item.parentElement = this;
        item.parentNode = this;
      }
      if (item != null && item !== false) this.children.push(item);
      return item;
    },
    append(...items) {
      for (const item of items) {
        if (item == null || item === false) continue;
        if (Array.isArray(item)) this.append(...item);
        else if (typeof item === 'string' || typeof item === 'number') this.children.push({ textContent: String(item), children: [] });
        else this.appendChild(item);
      }
    },
    prepend(...items) {
      for (const item of items.reverse()) {
        if (item == null || item === false) continue;
        if (typeof item === 'object' && item._detach) {
          item._detach();
          item.parentElement = this;
          item.parentNode = this;
        }
        this.children.unshift(item);
      }
    },
    after(...items) {
      if (!this.parentElement) return;
      const p = this.parentElement;
      const idx = p.children.indexOf(this);
      for (const item of items) {
        if (item && item._detach) {
          item._detach();
          item.parentElement = p;
          item.parentNode = p;
        }
        p.children.splice(idx + 1, 0, item);
      }
    },
    replaceChildren(...items) { this.children = []; this.append(...items); },
    querySelectorAll() { return []; },
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
    'forgeHeaderControls', 'designedCount',
    'reviewDesignedDetails', 'stageViewport', 'stageEmpty', 'stageSingleView',
    'stageCompareView', 'stage3dView', 'stageTag', 'stageCarousel', 'viewSeg',
    'stageImg', 'cmp2dId', 'cmp3dId', 'cmp2dImg', 'cmp3dImg', 'viewSegGroup',
    'btnToImg3d', 'btnToImg3dBatch', 'btnUpgradeActive', 'btnDeployGame',
    'railList', 'panelBody', 'stId', 'stBadge', 'stRefTag', 'btnModeSingle',
    'btnModeCompare', 'btnMode3D', 'tabBtnAnims', 'zoomSeg', 'stage3dCanvas',
    'stage3dClipBadge', 'stage3dInfoBadge', 'stage3dClipSelect', 'stage3dTimeDisplay',
    'stage3dScrubber', 'stage3dEventsTrack'
  ];
  for (const id of ids) nodes[id] = makeNode('div', id);
  nodes.stageViewport.append(nodes.reviewDesignedDetails, nodes.stageEmpty, nodes.stageSingleView, nodes.stageCompareView, nodes.stage3dView);
  nodes.designedStatusFilter.value = 'all';
  nodes.designedSearch.value = '';

  const store = new Map();
  const c = {
    Blob, URL, TextDecoder, TextEncoder, Uint8Array, ArrayBuffer, DataView, File, crypto,
    requestAnimationFrame: fn => fn(),
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
    addEventListener() {}
  };
  c.window = c;
  const ctx = vm.createContext(c);
  for (const file of ['catalog.js', 'tasks.js', 'designed.js', 'pipeline.js', 'model-review.js', 'forge.js']) {
    vm.runInContext(read(file), ctx, { filename: file });
  }
  c.DESIGNED = c.COSMI_DESIGNED.items || [];
  c.DESIGNED_CHARACTERS = c.COSMI_DESIGNED.characters || [];
  return { c, nodes };
}

test('embedded 3D viewer remains visible in reviewDesignedDetails and restores to stageViewport', async () => {
  const { c, nodes } = createHarness();
  const f = c.COSMI_FORGE;
  const encode = x => new TextEncoder().encode(JSON.stringify(x));
  const charId = c.DESIGNED_CHARACTERS[0].id;

  await f.loadAssetFiles({
    'mdl-chr/manifest.json': encode({ task_id: 'mdl-chr', task_type: 'character-model-rig', subject_id: charId, files: [{ path: 'models/chr.glb', kind: 'model', level: 'L1' }], missing: [] }),
    'mdl-chr/models/chr.glb': new Uint8Array([1, 2, 3, 4])
  }, { name: 'mdl-chr' }, { silent: true });

  await f.setViewMode('review');
  const charRow = nodes.railList.children.find(ch => ch.listeners?.click?.length && collectText(ch).includes(charId));
  assert.ok(charRow, 'character row should exist in railList');
  charRow.listeners.click[0]();

  assert.equal(nodes.reviewDesignedDetails.style.display, 'block');
  assert.equal(nodes.stage3dView.classList.contains('stage3d-embedded'), true);
  assert.equal(nodes.stage3dView.style.display, 'block', 'embedded 3D viewer must not be hidden by renderReviewDesigned');

  // Click the 3D package pill or button inside reviewDesignedDetails to switch to 3D stage view
  const pkgBtn = nodes.designedDetailView.children[0]?.children?.find(ch => ch.tagName === 'BUTTON');
  assert.ok(pkgBtn, 'package button should exist in reviewDesignedDetails');
  pkgBtn.listeners.click[0]();

  assert.equal(nodes.reviewDesignedDetails.style.display, 'none');
  assert.equal(nodes.stage3dView.parentElement, nodes.stageViewport, 'stage3dView must restore back to stageViewport');
  assert.equal(nodes.stage3dView.classList.contains('stage3d-embedded'), false);
  assert.equal(nodes.stage3dView.style.display, 'block');
});

test('designed creatures do not require portraits and ignore source portrait / front / turnaround missing items', async () => {
  const { c, nodes } = createHarness();
  const f = c.COSMI_FORGE;
  const encode = x => new TextEncoder().encode(JSON.stringify(x));
  const creature = c.DESIGNED[0];

  const pkg = await f.loadAssetFiles({
    'asset_cr_ok/manifest.json': encode({
      task_id: 'asset_cr_ok',
      task_type: 'creature-model-rig',
      subject_id: creature.line_id,
      stage: 'adult',
      pipeline: 'ai_blender',
      files: [{ path: 'models/cr.glb', kind: 'model', level: 'L1' }],
      missing: [
        { item: 'source portrait', level: 'L1', reason: 'legacy' },
        { item: 'images/cr_front.png', level: 'L1', reason: 'img23d' },
        { item: 'images/cr_turnaround.png', level: 'L1', reason: 'img23d' }
      ]
    }),
    'asset_cr_ok/models/cr.glb': new Uint8Array([1, 2, 3, 4])
  }, { name: 'asset_cr_ok' }, { silent: true });

  assert.equal(pkg.status, 'provisional', 'creature 3D with only legacy portrait/front/turnaround missing entries must not be marked missing');

  await f.setViewMode('designed');
  const detailText = collectText(nodes.designedDetailView);
  assert.doesNotMatch(detailText, /待鍛造立繪/);
  assert.doesNotMatch(detailText, /2D ⬜ 未處理/);
  assert.doesNotMatch(detailText, /2D ⚠️ 缺檔待補/);
  assert.doesNotMatch(detailText, /source portrait/);

  const driveSrc = read('drive-storage.js');
  assert.doesNotMatch(driveSrc, /addMissing\(\s*["']source portrait["']/);
});

test('creature-concept and character-concept mark front and turnaround as L2 img-to-3D resources', () => {
  const forgeSrc = read('forge.js');
  assert.match(forgeSrc, /front\.png`, kind: "front", level: "L2"/);
  assert.match(forgeSrc, /turnaround\.png`, kind: "turnaround", level: "L2"/);
});

test('reviewDesignedDetails embeds creature 3D viewer defaulting to adult and switches stages inline without popup', async () => {
  const { c, nodes } = createHarness();
  const f = c.COSMI_FORGE;
  const encode = x => new TextEncoder().encode(JSON.stringify(x));
  const creature = c.DESIGNED[0];

  await f.loadAssetFiles({
    'mdl-cr-juv/manifest.json': encode({
      task_id: 'mdl-cr-juv',
      task_type: 'creature-model-rig',
      subject_id: creature.line_id,
      stage: 'juvenile',
      files: [{ path: 'models/juv.glb', kind: 'model', level: 'L1' }]
    }),
    'mdl-cr-juv/models/juv.glb': new Uint8Array([1, 2, 3])
  }, { name: 'mdl-cr-juv' }, { silent: true });

  await f.loadAssetFiles({
    'mdl-cr-adult/manifest.json': encode({
      task_id: 'mdl-cr-adult',
      task_type: 'creature-model-rig',
      subject_id: creature.line_id,
      stage: 'adult',
      files: [{ path: 'models/adult.glb', kind: 'model', level: 'L1' }]
    }),
    'mdl-cr-adult/models/adult.glb': new Uint8Array([4, 5, 6])
  }, { name: 'mdl-cr-adult' }, { silent: true });

  await f.setViewMode('review');
  const creatureRow = nodes.railList.children.find(r => collectText(r).includes(creature.line_id));
  assert.ok(creatureRow, 'creature row should appear in review rail');
  creatureRow.listeners.click[0]();

  assert.equal(nodes.reviewDesignedDetails.style.display, 'block');
  assert.equal(nodes.stage3dView.classList.contains('stage3d-embedded'), true);
  assert.equal(nodes.stage3dView.style.display, 'block');

  const findAll = (rootNode, pred, acc = []) => {
    if (!rootNode || typeof rootNode !== 'object') return acc;
    if (pred(rootNode)) acc.push(rootNode);
    for (const ch of (rootNode.children || [])) findAll(ch, pred, acc);
    return acc;
  };

  const stageBtns = findAll(nodes.designedDetailView, n => n.tagName === 'BUTTON' && n['data-stage']);
  assert.equal(stageBtns.length, 4, 'all 4 stage buttons should be rendered');
  const adultBtn = stageBtns.find(b => b['data-stage'] === 'adult');
  const juvBtn = stageBtns.find(b => b['data-stage'] === 'juvenile');
  assert.equal(adultBtn.classList.contains('on'), true, 'adult stage must be active by default');
  assert.equal(juvBtn.classList.contains('on'), false);
  assert.match(collectText(nodes.designedDetailView), /models\/adult\.glb/);

  // Switch to juvenile inline
  juvBtn.listeners.click[0]();
  assert.equal(nodes.reviewDesignedDetails.style.display, 'block', 'must stay inline without popup or leaving reviewDesignedDetails');
  assert.equal(nodes.stage3dView.classList.contains('stage3d-embedded'), true);
  assert.equal(juvBtn.classList.contains('on'), true, 'juvenile stage should become active');
  assert.equal(adultBtn.classList.contains('on'), false);
  assert.match(collectText(nodes.designedDetailView), /models\/juv\.glb/);

  // Only the active stage detail card should be displayed (not 4 full stage cards),
  // and the bottom section should show the compact 4-stage relationship strip.
  const detailText = collectText(nodes.designedDetailView);
  assert.match(detailText, /四階型態演化關係/);
  assert.doesNotMatch(detailText, /四階型態演化檢驗/);
  const adultStageObj = creature.concept.locked.stages.find(s => s.stage === 'adult');
  const juvStageObj = creature.concept.locked.stages.find(s => s.stage === 'juvenile');
  assert.ok(detailText.includes(juvStageObj.look), 'active juvenile look should be visible');
  assert.ok(!detailText.includes(adultStageObj.look), 'inactive adult look should not be shown');
});

test('GLB animations populate designed 3D clip bar and count after model loads', async () => {
  const { c, nodes } = createHarness();
  const f = c.COSMI_FORGE;
  const encode = x => new TextEncoder().encode(JSON.stringify(x));
  const creature = c.DESIGNED[0];

  // Provide a minimal Three.js + GLTFLoader mock
  const vec3 = (x = 0, y = 0, z = 0) => ({ x, y, z, set(nx, ny, nz) { this.x = nx; this.y = ny; this.z = nz; } });
  c.THREE = {
    Scene: class { add() {} remove() {} },
    PerspectiveCamera: class { constructor() { this.position = vec3(); this.fov = 45; this.aspect = 1; } updateProjectionMatrix() {} },
    WebGLRenderer: class { constructor() { this.domElement = nodes.stage3dCanvas; } setSize() {} setPixelRatio() {} render() {} },
    OrbitControls: class { constructor() { this.target = vec3(); } update() {} },
    AmbientLight: class {},
    HemisphereLight: class {},
    DirectionalLight: class { constructor() { this.position = vec3(); } },
    GridHelper: class { constructor() { this.position = vec3(); } },
    Clock: class { getDelta() { return 0.016; } },
    Box3: class { constructor() { this.min = vec3(0, 0, 0); } setFromObject() { return this; } isEmpty() { return false; } getSize() { return vec3(1, 1.5, 1); } getCenter() { return vec3(0, 0.75, 0); } },
    Vector3: class { constructor(x = 0, y = 0, z = 0) { return vec3(x, y, z); } },
    Group: class { constructor() { this.position = vec3(); this.children = []; } add(...xs) { this.children.push(...xs); } traverse() {} },
    Mesh: class { constructor() { this.position = vec3(); this.rotation = vec3(); this.scale = vec3(1, 1, 1); } },
    BoxGeometry: class {}, SphereGeometry: class {}, CylinderGeometry: class {}, ConeGeometry: class {},
    MeshStandardMaterial: class {},
    VectorKeyframeTrack: class {},
    AnimationClip: class { constructor(name, duration) { this.name = name; this.duration = duration || 1; } },
    SkeletonHelper: class {},
    AnimationMixer: class {
      stopAllAction() {}
      uncacheRoot() {}
      update() {}
      clipAction(clip) {
        return {
          setLoop() {}, reset() {}, play() {}, setEffectiveTimeScale() {}, setEffectiveWeight() {},
          getClip() { return clip; }, time: 0
        };
      }
    },
    LoopRepeat: 2201,
    LoopOnce: 2200,
    GLTFLoader: class {
      parse(_buf, _path, onLoad) {
        onLoad({
          scene: { position: vec3(), traverse() {} },
          animations: [
            { name: 'cr_idle', duration: 1.2 },
            { name: 'cr_attack_01', duration: 0.8 }
          ]
        });
      }
    }
  };
  nodes.stage3dView.append(nodes.stage3dCanvas);
  c.COSMI_WIKI = { describe: () => ({ path: 'creatures/wiki/test.md' }) };
  c.COSMI_DRIVE = { packageDir: () => 'creatures/01_portraits' };
  for (const id of ['seed', 'rec', 'tasks', 'options', 'prompt', 'copy', 'download', 'header', 'chars', 'deliver', 'history', 'favorites', 'favBtn', 'concept', 'outStats', 'forge3dModeTabs', 'forgeStageTabs']) {
    nodes[id] = c.document.createElement('div');
    nodes[id].id = id;
    if (id === 'concept') nodes[id].hidden = true;
  }
  const rafQueue = [];
  c.requestAnimationFrame = fn => { rafQueue.push(fn); return rafQueue.length; };

  await f.loadAssetFiles({
    'mdl-adult/manifest.json': encode({ task_id: 'mdl-adult', task_type: 'creature-model-rig', subject_id: creature.line_id, stage: 'adult', files: [{ path: 'models/adult.glb', kind: 'model', level: 'L1' }], missing: [] }),
    'mdl-adult/models/adult.glb': new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0])
  }, { name: 'mdl-adult' }, { silent: true });

  await f.setViewMode('review');
  const creatureRow = nodes.railList.children.find(r => collectText(r).includes(creature.line_id));
  creatureRow.listeners.click[0]();

  // Flush the mountDesigned3dViewer rAF callback without looping animate3dLoop infinitely
  const pending = rafQueue.splice(0, rafQueue.length);
  for (const fn of pending) await fn();

  const detailText = collectText(nodes.designedDetailView);
  assert.match(detailText, /GLB 已載入/);
  assert.match(detailText, /2 支完整動態/);
  assert.match(detailText, /cr_idle|待機/);
});

test('Drive refresh during active 3D review keeps stage3dView in stageViewport without designed rAF clobbering', async () => {
  const { c, nodes } = createHarness();
  const f = c.COSMI_FORGE;
  const encode = x => new TextEncoder().encode(JSON.stringify(x));
  const charId = c.DESIGNED_CHARACTERS[0].id;
  const creature = c.DESIGNED[0];

  const vec3 = (x = 0, y = 0, z = 0) => ({ x, y, z, set(nx, ny, nz) { this.x = nx; this.y = ny; this.z = nz; } });
  const parsedModels = [];
  c.THREE = {
    Scene: class { add() {} remove() {} },
    PerspectiveCamera: class { constructor() { this.position = vec3(); this.fov = 45; this.aspect = 1; } updateProjectionMatrix() {} },
    WebGLRenderer: class { constructor() { this.domElement = nodes.stage3dCanvas; } setSize() {} setPixelRatio() {} render() {} },
    OrbitControls: class { constructor() { this.target = vec3(); } update() {} },
    AmbientLight: class {},
    HemisphereLight: class {},
    DirectionalLight: class { constructor() { this.position = vec3(); } },
    GridHelper: class { constructor() { this.position = vec3(); } },
    Clock: class { getDelta() { return 0.016; } },
    Box3: class { constructor() { this.min = vec3(0, 0, 0); } setFromObject() { return this; } isEmpty() { return false; } getSize() { return vec3(1, 1.5, 1); } getCenter() { return vec3(0, 0.75, 0); } },
    Vector3: class { constructor(x = 0, y = 0, z = 0) { return vec3(x, y, z); } },
    Group: class { constructor() { this.position = vec3(); this.children = []; } add(...xs) { this.children.push(...xs); } traverse() {} },
    Mesh: class { constructor() { this.position = vec3(); this.rotation = vec3(); this.scale = vec3(1, 1, 1); } },
    BoxGeometry: class {}, SphereGeometry: class {}, CylinderGeometry: class {}, ConeGeometry: class {},
    MeshStandardMaterial: class {},
    VectorKeyframeTrack: class {},
    AnimationClip: class { constructor(name, duration) { this.name = name; this.duration = duration || 1; } },
    SkeletonHelper: class {},
    AnimationMixer: class {
      stopAllAction() {}
      uncacheRoot() {}
      update() {}
      clipAction(clip) {
        return {
          setLoop() {}, reset() {}, play() {}, setEffectiveTimeScale() {}, setEffectiveWeight() {},
          getClip() { return clip; }, time: 0
        };
      }
    },
    LoopRepeat: 2201,
    LoopOnce: 2200,
    GLTFLoader: class {
      parse(buf, _path, onLoad) {
        parsedModels.push(new Uint8Array(buf)[4]);
        onLoad({
          scene: { position: vec3(), traverse() {} },
          animations: [{ name: 'chr_idle', duration: 1.0 }]
        });
      }
    }
  };
  nodes.stage3dView.append(nodes.stage3dCanvas);
  c.COSMI_WIKI = { describe: () => ({ path: 'creatures/wiki/test.md' }) };
  c.COSMI_DRIVE = { packageDir: () => 'creatures/01_portraits' };
  for (const id of ['seed', 'rec', 'tasks', 'options', 'prompt', 'copy', 'download', 'header', 'chars', 'deliver', 'history', 'favorites', 'favBtn', 'concept', 'outStats', 'forge3dModeTabs', 'forgeStageTabs']) {
    nodes[id] = c.document.createElement('div');
    nodes[id].id = id;
    if (id === 'concept') nodes[id].hidden = true;
  }
  const rafQueue = [];
  c.requestAnimationFrame = fn => { rafQueue.push(fn); return rafQueue.length; };
  c.cancelAnimationFrame = id => { if (rafQueue[id - 1]) rafQueue[id - 1] = () => {}; };

  // First select a designed creature so designedState.selectedId is populated.
  await f.setViewMode('designed');
  const designedRow = nodes.designedRailList.children.find(r => collectText(r).includes(creature.line_id));
  if (designedRow?.listeners?.click?.[0]) designedRow.listeners.click[0]();
  rafQueue.splice(0, rafQueue.length).forEach(fn => fn());

  // Load a Drive-backed 3D character package and open it in the Review 3D stage.
  const pkg = await f.loadAssetFiles({
    'mdl-chr/manifest.json': encode({ task_id: 'mdl-chr', task_type: 'character-model-rig', subject_id: charId, files: [{ path: 'models/chr.glb', kind: 'model', level: 'L1' }], missing: [] }),
    'mdl-chr/models/chr.glb': new Uint8Array([0x67, 0x6c, 0x54, 0x46, 11, 0, 0, 0])
  }, { name: 'mdl-chr' }, { silent: true });
  pkg.driveFolderId = 'folder-chr';
  pkg.drivePath = 'characters/02_3d/colab/mdl-chr';
  pkg.glbFile = { path: 'models/chr.glb', id: 'glb-v1', modifiedTime: '2026-11-16T00:00:00Z', buffer: new Uint8Array([0x67, 0x6c, 0x54, 0x46, 11, 0, 0, 0]).buffer, deferred: false };

  f.openReviewPackage(pkg);
  assert.equal(nodes.stage3dView.parentElement, nodes.stageViewport);
  assert.equal(nodes.stage3dView.classList.contains('stage3d-embedded'), false);
  assert.equal(nodes.stage3dView.style.display, 'block');
  assert.deepEqual(parsedModels.slice(-1), [11]);

  // Simulate Drive sync calling refresh() while Review 3D stage is active.
  f.refresh();
  for (const fn of rafQueue.splice(0, rafQueue.length)) await fn();

  assert.equal(nodes.stage3dView.parentElement, nodes.stageViewport, 'refresh() must not move stage3dView out of stageViewport');
  assert.equal(nodes.stage3dView.classList.contains('stage3d-embedded'), false);
  assert.equal(nodes.stage3dView.style.display, 'block');
  assert.match(nodes.stage3dClipBadge.textContent, /chr_idle/, 'Review 3D model must not be overwritten by Designed tab rAF');

  // Simulate updated GLB arriving from Drive sync with new file id/modifiedTime.
  const updatedPkg = await f.loadAssetFiles({
    'mdl-chr/manifest.json': encode({ task_id: 'mdl-chr', task_type: 'character-model-rig', subject_id: charId, files: [{ path: 'models/chr.glb', kind: 'model', level: 'L1' }], missing: [] }),
    'mdl-chr/models/chr.glb': new Uint8Array([0x67, 0x6c, 0x54, 0x46, 22, 0, 0, 0])
  }, { name: 'mdl-chr' }, { silent: true });
  updatedPkg.driveFolderId = 'folder-chr';
  updatedPkg.drivePath = 'characters/02_3d/colab/mdl-chr';
  updatedPkg.glbFile = { path: 'models/chr.glb', id: 'glb-v2', modifiedTime: '2026-11-16T01:00:00Z', buffer: new Uint8Array([0x67, 0x6c, 0x54, 0x46, 22, 0, 0, 0]).buffer, deferred: false };

  f.refresh();
  assert.deepEqual(parsedModels.slice(-1), [22], 'updated Drive GLB must reload instead of keeping stale model');
});

test('switching forms, creatures, and characters reuses one 3D viewer without restarting WebGLRenderer', async () => {
  const { c, nodes } = createHarness();
  const f = c.COSMI_FORGE;
  const encode = x => new TextEncoder().encode(JSON.stringify(x));
  const creature1 = c.DESIGNED[0];
  const creature2 = c.DESIGNED[1];
  const char1 = c.DESIGNED_CHARACTERS[0];

  const vec3 = (x = 0, y = 0, z = 0) => ({ x, y, z, set(nx, ny, nz) { this.x = nx; this.y = ny; this.z = nz; } });
  let rendererCount = 0;
  const parsedModels = [];
  const styleDisplayHistory = [];
  const origStyle = nodes.stage3dView.style;
  nodes.stage3dView.style = new Proxy(origStyle, {
    set(target, prop, val) {
      if (prop === 'display') styleDisplayHistory.push(val);
      target[prop] = val;
      return true;
    }
  });
  c.THREE = {
    Scene: class { add() {} remove() {} },
    PerspectiveCamera: class { constructor() { this.position = vec3(); this.fov = 45; this.aspect = 1; } updateProjectionMatrix() {} },
    WebGLRenderer: class { constructor() { rendererCount++; this.domElement = nodes.stage3dCanvas; } setSize() {} setPixelRatio() {} render() {} },
    OrbitControls: class { constructor() { this.target = vec3(); } update() {} },
    AmbientLight: class {},
    HemisphereLight: class {},
    DirectionalLight: class { constructor() { this.position = vec3(); } },
    GridHelper: class { constructor() { this.position = vec3(); } },
    Clock: class { getDelta() { return 0.016; } },
    Box3: class { constructor() { this.min = vec3(0, 0, 0); } setFromObject() { return this; } isEmpty() { return false; } getSize() { return vec3(1, 1.5, 1); } getCenter() { return vec3(0, 0.75, 0); } },
    Vector3: class { constructor(x = 0, y = 0, z = 0) { return vec3(x, y, z); } },
    Group: class { constructor() { this.position = vec3(); this.children = []; } add(...xs) { this.children.push(...xs); } traverse() {} },
    Mesh: class { constructor() { this.position = vec3(); this.rotation = vec3(); this.scale = vec3(1, 1, 1); } },
    BoxGeometry: class {}, SphereGeometry: class {}, CylinderGeometry: class {}, ConeGeometry: class {},
    MeshStandardMaterial: class {},
    VectorKeyframeTrack: class {},
    AnimationClip: class { constructor(name, duration) { this.name = name; this.duration = duration || 1; } },
    SkeletonHelper: class {},
    AnimationMixer: class {
      stopAllAction() {}
      uncacheRoot() {}
      update() {}
      clipAction(clip) {
        return {
          setLoop() {}, reset() {}, play() {}, setEffectiveTimeScale() {}, setEffectiveWeight() {},
          getClip() { return clip; }, time: 0
        };
      }
    },
    LoopRepeat: 2201,
    LoopOnce: 2200,
    GLTFLoader: class {
      parse(buf, _path, onLoad) {
        parsedModels.push(new Uint8Array(buf)[4]);
        onLoad({
          scene: { position: vec3(), traverse() {} },
          animations: [{ name: 'cr_idle', duration: 1.0 }]
        });
      }
    }
  };
  nodes.stage3dView.append(nodes.stage3dCanvas);
  c.COSMI_WIKI = { describe: () => ({ path: 'creatures/wiki/test.md' }) };
  c.COSMI_DRIVE = { packageDir: () => 'creatures/01_portraits' };
  for (const id of ['seed', 'rec', 'tasks', 'options', 'prompt', 'copy', 'download', 'header', 'chars', 'deliver', 'history', 'favorites', 'favBtn', 'concept', 'outStats', 'forge3dModeTabs', 'forgeStageTabs']) {
    nodes[id] = c.document.createElement('div');
    nodes[id].id = id;
    if (id === 'concept') nodes[id].hidden = true;
  }
  const rafQueue = [];
  c.requestAnimationFrame = fn => { rafQueue.push(fn); return rafQueue.length; };
  c.cancelAnimationFrame = id => { if (rafQueue[id - 1]) rafQueue[id - 1] = () => {}; };

  await f.loadAssetFiles({
    'mdl-c1-adult/manifest.json': encode({ task_id: 'mdl-c1-adult', task_type: 'creature-model-rig', subject_id: creature1.line_id, stage: 'adult', files: [{ path: 'models/c1_adult.glb', kind: 'model', level: 'L1' }], missing: [] }),
    'mdl-c1-adult/models/c1_adult.glb': new Uint8Array([0x67, 0x6c, 0x54, 0x46, 1, 0, 0, 0])
  }, { name: 'mdl-c1-adult' }, { silent: true });
  await f.loadAssetFiles({
    'mdl-c1-juv/manifest.json': encode({ task_id: 'mdl-c1-juv', task_type: 'creature-model-rig', subject_id: creature1.line_id, stage: 'juvenile', files: [{ path: 'models/c1_juv.glb', kind: 'model', level: 'L1' }], missing: [] }),
    'mdl-c1-juv/models/c1_juv.glb': new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0])
  }, { name: 'mdl-c1-juv' }, { silent: true });
  await f.loadAssetFiles({
    'mdl-c2-adult/manifest.json': encode({ task_id: 'mdl-c2-adult', task_type: 'creature-model-rig', subject_id: creature2.line_id, stage: 'adult', files: [{ path: 'models/c2_adult.glb', kind: 'model', level: 'L1' }], missing: [] }),
    'mdl-c2-adult/models/c2_adult.glb': new Uint8Array([0x67, 0x6c, 0x54, 0x46, 3, 0, 0, 0])
  }, { name: 'mdl-c2-adult' }, { silent: true });
  await f.loadAssetFiles({
    'mdl-chr1/manifest.json': encode({ task_id: 'mdl-chr1', task_type: 'character-model-rig', subject_id: char1.id, files: [{ path: 'models/chr1.glb', kind: 'model', level: 'L1' }], missing: [] }),
    'mdl-chr1/models/chr1.glb': new Uint8Array([0x67, 0x6c, 0x54, 0x46, 4, 0, 0, 0])
  }, { name: 'mdl-chr1' }, { silent: true });

  await f.setViewMode('review');
  const flushRaf = async () => {
    for (const fn of rafQueue.splice(0, rafQueue.length)) await fn();
  };

  // 1. Select creature 1 (adult)
  nodes.railList.children.find(r => collectText(r).includes(creature1.line_id)).listeners.click[0]();
  await flushRaf();
  assert.deepEqual(parsedModels, [1]);
  styleDisplayHistory.length = 0;

  // 2. Switch form (juvenile) in-place without hiding viewer or restarting WebGLRenderer
  const findByStage = (node, stage) => {
    if (!node || typeof node !== 'object') return null;
    if (node.dataset?.stage === stage || node['data-stage'] === stage) return node;
    for (const ch of (node.children || [])) {
      const hit = findByStage(ch, stage);
      if (hit) return hit;
    }
    return null;
  };
  findByStage(nodes.designedDetailView, 'juvenile').listeners.click[0]();
  assert.deepEqual(parsedModels, [1, 2]);
  assert.equal(styleDisplayHistory.includes('none'), false, 'switching form must not hide stage3dView');

  // 3. Switch creature 2 without hiding viewer or restarting WebGLRenderer
  nodes.railList.children.find(r => collectText(r).includes(creature2.line_id)).listeners.click[0]();
  await flushRaf();
  assert.deepEqual(parsedModels, [1, 2, 3]);
  assert.equal(styleDisplayHistory.includes('none'), false, 'switching creature must not hide stage3dView');

  // 4. Switch character 1 without hiding viewer or restarting WebGLRenderer
  nodes.railList.children.find(r => collectText(r).includes(char1.id)).listeners.click[0]();
  await flushRaf();
  assert.deepEqual(parsedModels, [1, 2, 3, 4]);
  assert.equal(styleDisplayHistory.includes('none'), false, 'switching character must not hide stage3dView');
  assert.equal(rendererCount, 1, 'WebGLRenderer must only be created once');
});
