const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');

function loadStack() {
  const nodes = { pipelineStage: { value: 'portrait' }, pipelineParameters: { value: '{}' }, pipelineSource: { value: '' } };
  const c = {
    document: { getElementById: id => nodes[id], addEventListener() {} },
    COSMI_FORGE: { activePackage: () => null, packages: () => [] }
  };
  c.window = c;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'catalog.js'), 'utf8'), c);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'tasks.js'), 'utf8'), c);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'wiki.js'), 'utf8'), c);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'pipeline.js'), 'utf8'), c);
  return c;
}

test('CREATURE defines 4 base entities and 8 morphology tags matching .agents/skills', () => {
  const c = loadStack();
  const C = c.COSMI_CATALOG;
  assert.equal(C.version, '2.11.0');
  assert.deepEqual(
    [...C.CREATURE.base_entities.map(b => b.v)],
    ['natural-bio', 'supernatural-bio', 'humanoid-bio', 'non-bio']
  );
  assert.equal(C.CREATURE.morphology_tags.length, 8);
  for (const tag of C.CREATURE.morphology_tags) {
    assert.ok(tag.skill && tag.skill.startsWith('agc-morph-'));
    assert.ok(
      fs.existsSync(path.join(root, '.agents', 'skills', tag.skill, 'SKILL.md')),
      `missing skill file for ${tag.v}: ${tag.skill}`
    );
  }
});

test('morphology soft affinity boosts compatible tags without hard exclusion', () => {
  const c = loadStack();
  const C = c.COSMI_CATALOG;

  const nonBioPrimary = C.getWeightedMorphologyPrimary('non-bio');
  assert.equal(nonBioPrimary.length, 8);
  assert.ok(nonBioPrimary.every(t => t.w > 0));
  const inanim = nonBioPrimary.find(t => t.v === 'inanimate-biomimic');
  const pure = nonBioPrimary.find(t => t.v === 'pure-stylized-bio');
  assert.ok(inanim.w > pure.w);

  const sec = C.getWeightedMorphologySecondary('bio-artifact', 'humanoid-bio');
  assert.ok(!sec.some(t => t.v === 'bio-artifact'), 'secondary excludes primary');
  assert.ok(!sec.some(t => t.v === 'pure-stylized-bio'), 'secondary excludes pure-stylized-bio');
  assert.ok(sec.every(t => t.w > 0));
  const elem = sec.find(t => t.v === 'bio-element');
  const multi = sec.find(t => t.v === 'multi-bio');
  assert.ok(elem.w > multi.w, 'synergy secondary should outweigh unrelated secondary');
});

test('resolveMorphologyGuide caps secondaries at 2 and flags bio-totem sensitivity', () => {
  const c = loadStack();
  const C = c.COSMI_CATALOG;

  assert.equal(C.resolveMorphologyGuide({ elements: ['fire'] }), null);

  const guide = C.resolveMorphologyGuide({
    base_entity: 'supernatural-bio',
    morphology_primary: 'multi-bio',
    morphology_secondary: ['multi-bio', 'pure-stylized-bio', 'bio-totem', 'bio-element', 'bio-nature']
  });
  assert.ok(guide);
  assert.equal(guide.primary.v, 'multi-bio');
  assert.deepEqual([...guide.secondaries.map(s => s.v)], ['bio-totem', 'bio-element']);
  assert.equal(guide.sensitivityReview, true);
  assert.deepEqual([...guide.skills], [
    'agc-creature-design',
    'agc-morph-multi-bio',
    'agc-morph-bio-totem',
    'agc-morph-bio-element'
  ]);
  assert.match(guide.promptLine, /sensitivity: review/);

  const cleanGuide = C.resolveMorphologyGuide({
    base_entity: 'natural-bio',
    morphology_primary: 'pure-stylized-bio',
    morphology_secondary: []
  });
  assert.equal(cleanGuide.sensitivityReview, false);
});

test('pipeline appearance and tasks creature-concept include morphology fields when present', () => {
  const c = loadStack();
  const P = c.COSMI_PIPELINE;
  const task = c.COSMI_TASKS.find(t => t.id === 'creature-concept');
  assert.ok(task);

  const conceptWithMorph = {
    name_zh: '測試岩羊',
    elements: ['earth'],
    base_entity: 'natural-bio',
    morphology_primary: 'bio-nature',
    morphology_secondary: ['bio-element'],
    bases: ['岩羊', '石英晶簇'],
    appearance_palette: ['曜石純黑', '琥珀橙金']
  };
  const appWith = P.appearance({ concept: conceptWithMorph, opts: { stage: 'adult' } });
  assert.match(appWith, /base_entity: natural-bio/);
  assert.match(appWith, /morphology_primary: bio-nature/);
  assert.match(appWith, /morphology_secondary: \["bio-element"\]/);

  const appWithout = P.appearance({ concept: { name_zh: '舊設定', elements: ['fire'] }, opts: { stage: 'adult' } });
  assert.doesNotMatch(appWithout, /morphology_primary/);

  const promptWith = task.build({
    task,
    platformName: 'ChatGPT',
    header: '[TEST]',
    subjectId: 'line_test',
    concept: conceptWithMorph,
    opts: { stage: 'adult' }
  });
  assert.match(promptWith, /形態標籤混搭/);
  assert.match(promptWith, /生物融合自然物/);

  const roundsWith = task.buildRounds({
    task,
    platformName: 'ChatGPT',
    header: '[TEST]',
    subjectId: 'line_test',
    concept: conceptWithMorph,
    opts: { stage: 'juvenile' }
  });
  assert.match(roundsWith[0].prompt, /形態標籤混搭/);

  const promptWithout = task.build({
    task,
    platformName: 'ChatGPT',
    header: '[TEST]',
    subjectId: 'line_legacy',
    concept: { name_zh: '舊版', elements: ['fire'], bases: ['赤狐'] },
    opts: { stage: 'adult' }
  });
  assert.doesNotMatch(promptWithout, /形態標籤混搭/);
});

test('modified JS sources remain strictly de-identified', () => {
  const forbidden = /(pokemon|pokémon|寶可夢|palworld|帕魯|pikachu|charizard|bulbasaur|lamball|chillet)/i;
  for (const rel of ['catalog.js', 'forge.js', 'pipeline.js', 'tasks.js']) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.doesNotMatch(src, forbidden, `${rel} contains forbidden reference term`);
  }
});

test('all 45 designed lines have unique primary prototypes, valid morphology dimensions, and updated ungenerated prompts', () => {
  const c = loadStack();
  const C = c.COSMI_CATALOG;
  const designedSrc = fs.readFileSync(path.join(root, 'designed.js'), 'utf8');
  const dCtx = { window: {} };
  vm.runInNewContext(designedSrc, dCtx);
  const items = dCtx.window.COSMI_DESIGNED.items;
  assert.equal(items.length, 45);

  const validEntities = new Set(C.CREATURE.base_entities.map(b => b.v));
  const validMorphs = new Set(C.CREATURE.morphology_tags.map(t => t.v));
  const primarySeen = new Map();
  const task = c.COSMI_TASKS.find(t => t.id === 'creature-concept');
  let ungeneratedChecked = 0;

  for (const item of items) {
    const concept = item.concept;
    assert.ok(Array.isArray(concept.design_prototypes) && concept.design_prototypes.length >= 2, `${item.line_id} missing design_prototypes`);
    const p0 = concept.design_prototypes[0];
    assert.ok(!primarySeen.has(p0), `duplicate primary prototype "${p0}" on ${item.line_id} and ${primarySeen.get(p0)}`);
    primarySeen.set(p0, item.line_id);

    assert.ok(validEntities.has(concept.base_entity), `${item.line_id} invalid base_entity: ${concept.base_entity}`);
    assert.ok(validMorphs.has(concept.morphology_primary), `${item.line_id} invalid morphology_primary: ${concept.morphology_primary}`);
    assert.ok(Array.isArray(concept.morphology_secondary) && concept.morphology_secondary.length <= 2, `${item.line_id} secondary cap exceeded`);
    for (const sec of concept.morphology_secondary) {
      assert.ok(validMorphs.has(sec), `${item.line_id} invalid secondary: ${sec}`);
      assert.notEqual(sec, concept.morphology_primary, `${item.line_id} secondary duplicates primary`);
      assert.notEqual(sec, 'pure-stylized-bio', `${item.line_id} pure-stylized-bio cannot be secondary`);
    }

    if (item.line_id.startsWith('line_')) {
      ungeneratedChecked++;
      const built = task.build({
        task,
        platformName: 'ChatGPT',
        header: '[TEST]',
        subjectId: item.line_id,
        concept,
        opts: { stage: 'adult' }
      });
      assert.match(built, /設計原型標籤：/, `${item.line_id} build missing design_prototypes`);
      assert.match(built, /形態標籤混搭/, `${item.line_id} build missing morphology guide`);
      const rounds = task.buildRounds({
        task,
        platformName: 'ChatGPT',
        header: '[TEST]',
        subjectId: item.line_id,
        concept,
        opts: { stage: 'adult' }
      });
      assert.match(rounds[0].prompt, /設計原型標籤：/, `${item.line_id} round 1 missing design_prototypes`);
      assert.match(rounds[0].prompt, /形態標籤混搭/, `${item.line_id} round 1 missing morphology guide`);
    }
  }
  assert.equal(ungeneratedChecked, 27);
});
