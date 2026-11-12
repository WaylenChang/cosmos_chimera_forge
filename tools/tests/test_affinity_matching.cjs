const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'catalog.js'), 'utf8');
const context = { window: {} };
vm.runInNewContext(source, context);
const C = context.window.COSMI_CATALOG;
const readForge = () => fs.readFileSync(path.join(root, 'forge.js'), 'utf8');

test('ethnicity and culture region are separate and prefer nearby settings', () => {
  const same = C.getEthnicityRegionAffinity('東亞體系', '東亞');
  const neighbor = C.getEthnicityRegionAffinity('東亞體系', '東南亞');
  const distant = C.getEthnicityRegionAffinity('東亞體系', '美洲');
  assert.ok(same > neighbor && neighbor > distant && distant > 0);
  const weights = C.getWeightedRegions({ ethnicity: '東亞體系' });
  assert.equal(weights.length, C.CULTURE_REGIONS.length);
  assert.ok(weights.every(x => x.w > 0));
  assert.ok(weights.find(x => x.v === '東亞').w > weights.find(x => x.v === '美洲').w);
  assert.ok(C.getWeightedRegions({ ethnicity: '多元混血/跨洲交融體系' }).every(x => x.w > 0));
  assert.ok(C.getWeightedEthnicities('歐洲').every(x => x.w > 0));
});

test('timeline independently prefers suitable cultural contexts without excluding eras', () => {
  const medieval = '中世紀高奇幻/騎士魔導王國';
  assert.ok(C.getTimelineRegionAffinity(medieval, '歐洲') > C.getTimelineRegionAffinity(medieval, '東南亞'));
  const result = C.getWeightedTimelines('東南亞');
  assert.equal(result.length, C.TIMELINES.length);
  assert.ok(result.every(x => x.w > 0));
  assert.ok(C.getWeightedRegions({ timeline: medieval }).every(x => x.w > 0));
});

test('cultural archetypes use soft region matching, including composite regions', () => {
  assert.ok(C.getArchetypeRegionAffinity('東亞/東南亞', '東亞') > C.getArchetypeRegionAffinity('東亞/東南亞', '歐洲'));
  assert.ok(C.getArchetypeRegionAffinity('東亞/東南亞', '東南亞') > C.getArchetypeRegionAffinity('東亞/東南亞', '歐洲'));
  const result = C.getWeightedArchetypes([{ region: '東亞', w: 1 }, { region: '非洲', w: 1 }], '東亞');
  assert.ok(result[0].w > result[1].w && result[1].w > 0);
});

test('element and appearance colors remain independent with affinity weighting', () => {
  const colors = C.getWeightedPalettes(['fire']);
  assert.equal(colors.length, C.COLOR_TONES.length);
  assert.ok(colors.every(x => x.w > 0));
  const fire = colors.find(c => c.v === '烈焰紅');
  const ice = colors.find(c => c.v === '純淨冰藍');
  assert.ok(fire.w > ice.w);
  const alias = C.getFilteredPalettes(['fire']);
  assert.equal(alias.length, C.COLOR_TONES.length);
  const elements = C.getWeightedElements(['純淨冰藍']);
  assert.ok(elements.every(e => e.w > 0));
  assert.ok(elements.find(e => e.v === 'ice').w > elements.find(e => e.v === 'fire').w);
  assert.ok(C.getWeightedPalettes(['未知']).every(c => c.w > 0));
});

test('forge rolls use soft-affinity helpers and reset unlocked full-roll values', () => {
  const forge = readForge();
  for (const helper of ['getWeightedEthnicities', 'getWeightedRegions', 'getWeightedTimelines', 'getWeightedPalettes', 'getWeightedElements', 'getWeightedArchetypes']) {
    assert.ok(forge.includes('C.' + helper + '('), helper);
  }
  assert.match(forge, /if \(force\) FIELDS\[kind\]\.forEach\(f => \{/);
  assert.match(forge, /if \(!state\.locks\[kind \+ "\." \+ f\.key\]\) delete state\[kind\]\[f\.key\]/);
});
