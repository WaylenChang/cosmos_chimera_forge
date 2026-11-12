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

test('each element has multiple direct color matches and nearby affinity is competitive', () => {
  const all = C.COLOR_TONES;
  assert.equal(all.length, 189);
  for (const element of C.ELEMENTS.map(e => e.v).filter(v => v !== '未知')) {
    const direct = all.filter(color => color.elements.includes(element));
    assert.ok(direct.length >= 9, element + ' only has ' + direct.length + ' direct colors');
  }
  const fire = C.getElementColorAffinity('fire', { elements: ['fire'] });
  const adjacent = C.getElementColorAffinity('fire', { elements: ['earth'] });
  const neutral = C.getElementColorAffinity('fire', { elements: ['all'] });
  const contrast = C.getElementColorAffinity('fire', { elements: ['ice'] });
  assert.equal(fire, 6);
  assert.equal(adjacent, 4.5);
  assert.ok(fire > adjacent && adjacent > neutral && neutral > contrast && contrast > 0);
  assert.ok(adjacent / fire >= 0.7, 'adjacent colors should not be vastly underweighted');
});

test('multi-color weighting encourages variety without removing same-hue choices', () => {
  const colors = C.getWeightedPalettes(['fire']);
  const selected = ['熔岩赤紅'];
  const adjusted = C.getVariedPaletteOptions(colors, selected);
  const same = adjusted.find(c => c.v === '烈焰紅');
  const originalSame = colors.find(c => c.v === '烈焰紅');
  const different = adjusted.find(c => c.v === '冰晶天藍');
  const originalDifferent = colors.find(c => c.v === '冰晶天藍');
  assert.ok(same.w > 0 && same.w < originalSame.w);
  assert.equal(different.w, originalDifferent.w);
  assert.equal(adjusted.length, colors.length);
  assert.match(readForge(), /C\.getVariedPaletteOptions\(pool, chosen\)/);
});


test('every elemental palette follows direct <= adjacent <= neutral <= contrast by unique entries', () => {
  const elements = C.ELEMENTS.map(e => e.v).filter(v => v !== '未知');
  assert.equal(new Set(C.COLOR_TONES.map(c => c.v)).size, C.COLOR_TONES.length);
  for (const element of elements) {
    const stats = C.getPaletteTierCounts(element);
    assert.ok(stats.direct >= 9, element + ': not enough direct colors');
    assert.ok(stats.direct <= stats.adjacent, element + ': direct exceeds adjacent');
    assert.ok(stats.adjacent <= stats.neutral, element + ': adjacent exceeds neutral');
    assert.ok(stats.neutral <= stats.contrast, element + ': neutral exceeds contrast');
    assert.equal(Object.values(stats).reduce((sum, v) => sum + v, 0), C.COLOR_TONES.length);
    const tagged = C.COLOR_TONES.map(color => C.getElementColorTier(element, color));
    assert.ok(tagged.every(x => ['direct', 'adjacent', 'neutral', 'contrast'].includes(x)));
  }
});

test('culture and timeline style colors are optional, additive and never hard-excluded', () => {
  const region = '非洲', timeline = '青銅神話/古典英雄時代';
  const color = C.COLOR_TONES.find(c => c.v === '古埃及藍');
  assert.equal(color.region, region);
  assert.equal(color.timeline, timeline);
  assert.ok(C.COLOR_TONES.some(c => c.v === '瑪雅藍' && c.region === '美洲'));
  assert.ok(C.COLOR_TONES.some(c => c.v === '宋瓷雨青' && c.region === '東亞'));
  assert.ok(C.COLOR_TONES.some(c => c.v === '賽博故障粉'));
  const sameRegion = C.getColorStyleAffinity(color, { region, timeline });
  const otherRegion = C.getColorStyleAffinity(color, { region: '歐洲', timeline: '太空歌劇/星際魔導帝國' });
  assert.ok(sameRegion > otherRegion && otherRegion > 0);
  for (const element of ['fire', 'ice', 'shadow', 'metal']) {
    const matched = C.getWeightedPalettes([element], { region, timeline });
    assert.equal(matched.length, C.COLOR_TONES.length);
    assert.ok(matched.every(c => c.w > 0));
  }
  const forge = readForge();
  assert.match(forge, /getWeightedPalettes\(\[\], \{ region: s\.character\.region/);
  assert.match(forge, /getWeightedPalettes\(s\.creature\.elements \|\| \[\], \{ region: s\.creature\.region/);
});
