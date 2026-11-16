const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'../..');
const read = filename => fs.readFileSync(path.join(root,filename),'utf8');
const html = read('index.html');
const forge = read('forge.js');
const settings = read('settings.js');
const drive = read('drive-storage.js');
const pipeline = read('pipeline.js');

test('one visible sign-out and one force-sync control', () => {
  assert.match(html,/id="settingsSignOut"/);
  assert.doesNotMatch(html,/id="driveSignOut"/);
  assert.match(html,/id="driveSync"/);
  assert.doesNotMatch(html,/id="settingsForceSync"/);
  assert.doesNotMatch(drive,/\$\("driveSignOut"\)/);
  assert.doesNotMatch(settings,/\$\("settingsForceSync"\)/);
  assert.match(settings,/COSMI_DRIVE\?\.signOut\(\)/);
  assert.match(drive,/syncPackages\(\{\s*force:\s*true\s*\}\)/);
});
test('designed shortcut appears only for an active preset, not as a duplicate library link', () => {
  assert.match(html,/id="designedShortcut" hidden/);
  assert.match(forge,/host\.hidden = !hasPreset/);
  assert.doesNotMatch(forge,/designed-nav-card/);
  assert.doesNotMatch(html,/id="viewBtnDesigned"/);
  assert.match(html,/data-cat="designed"/);
  assert.match(html,/id="reviewDesignedDetails"/);
  assert.match(forge,/reviewDeskEntries\(/);
});
test('legacy designedView is completely removed and review workbench has no redundant review-workbench buttons', () => {
  assert.doesNotMatch(html, /id="designedView"/);
  assert.doesNotMatch(html, /id="designedRail"/);
  assert.doesNotMatch(html, /id="designedCardsView"/);
  assert.doesNotMatch(forge, /function renderDesignedDesk\(/);
  assert.doesNotMatch(forge, /function renderDesignedList\(/);
  assert.doesNotMatch(forge, /function renderDesignedRail\(/);
  assert.doesNotMatch(forge, /轉至成果審查台/);
  assert.doesNotMatch(forge, /在審查台檢視/);
  const all = forge.slice(forge.indexOf('  function renderAll()'), forge.indexOf('  // ==================== 原生 ZIP', forge.indexOf('  function renderAll()')));
  assert.doesNotMatch(all, /renderDesignedDesk\(\)/);
  assert.doesNotMatch(all, /renderDesignedList\(\)/);
});
test('no one-choice 3D mode switch or redundant manual portrait copy action',()=>{
  assert.match(forge,/!is3dType\(t\.id\) \|\| window\.COSMI_PIPELINE\?\.supports\(\{task:t\}\)/);
  assert.match(pipeline,/action\.hidden = isPortrait && !automatic/);
  assert.match(html,/id="copy"/);
  assert.match(html,/id="pipelineRead"/);
});
test('designed 3D showcase embeds full 3D viewer directly and removes redundant task options title',()=>{
  assert.doesNotMatch(forge,/在成果審查台 3D 檢視器旋轉與播放動作/);
  assert.match(forge,/mountDesigned3dViewer\(/);
  assert.match(forge,/buildDesigned3dClipBar\(/);
  assert.doesNotMatch(forge,/conceptTitle\.textContent\s*=\s*showConcept\s*\?\s*"角色設計概念"\s*:\s*"任務選項"/);
  assert.match(html,/stage3d-embedded/);
});
