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
  assert.match(drive,/syncPackages\(\{force:true\}\)/);
});
test('designed shortcut appears only for an active preset, not as a duplicate library link', () => {
  assert.match(html,/id="designedShortcut" hidden/);
  assert.match(forge,/host\.hidden = !hasPreset/);
  assert.doesNotMatch(forge,/designed-nav-card/);
  assert.match(html,/id="viewBtnDesigned"/);
});
test('designed filters are shared and full-list rendering is not repeated by renderAll', () => {
  const list = forge.slice(forge.indexOf('  function renderDesignedList()'),forge.indexOf('  function fieldRow('));
  assert.match(list,/getDesignedFilteredItems\(\)/);
  assert.doesNotMatch(list,/const filteredLines = DESIGNED\.filter/);
  assert.doesNotMatch(list,/const filteredChars = DESIGNED_CHARACTERS\.filter/);
  const all = forge.slice(forge.indexOf('  function renderAll()'),forge.indexOf('  // ==================== 原生 ZIP',forge.indexOf('  function renderAll()')));
  assert.equal((all.match(/renderDesignedDesk\(\)/g)||[]).length,1);
  assert.doesNotMatch(all,/renderDesignedList\(\)/);
});
test('no one-choice 3D mode switch or redundant manual portrait copy action',()=>{
  assert.match(forge,/!is3dType\(t\.id\) \|\| window\.COSMI_PIPELINE\?\.supports\(\{task:t\}\)/);
  assert.match(pipeline,/action\.hidden = isPortrait && !automatic/);
  assert.match(html,/id="copy"/);
  assert.match(html,/id="pipelineRead"/);
});
