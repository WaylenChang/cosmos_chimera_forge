const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const catalogSrc = fs.readFileSync(path.join(root, 'catalog.js'), 'utf8');
const context = { window: {} };
vm.runInNewContext(catalogSrc, context);
const C = context.window.COSMI_CATALOG;

const LEGACY_CHARACTER_IDS = [
  'idle', 'idle_long', 'walk', 'run', 'sneak_idle', 'sneak_move', 'roll_dodge', 'jump',
  'block', 'hit_react', 'knockdown', 'getup', 'command_point', 'command_attack',
  'command_recall', 'summon', 'recall', 'item_use_self', 'item_use_other', 'field_deploy',
  'backpack_open', 'talk_idle', 'talk_gesture', 'pet_xs', 'pet_s', 'pet_m', 'pet_l', 'pet_xl',
  'throw_card', 'throw_bead', 'throw_cube', 'victory', 'defeated'
];

const LEGACY_CREATURE_IDS = [
  'idle', 'idle_long', 'walk', 'run', 'sneak', 'block', 'dodge_miss', 'hit_react', 'faint',
  'atk_melee_front', 'atk_melee_sweep', 'atk_melee_burst', 'atk_ranged_line',
  'atk_ranged_cone', 'atk_ranged_arc', 'sup_self', 'sup_ally', 'field_deploy',
  'petted', 'summon_appear', 'recall_vanish', 'capture_struggle',
  'overload_enter', 'overload_exit', 'hatch', 'victory'
];

function extractGetClipCategory() {
  const forgeSrc = fs.readFileSync(path.join(root, 'forge.js'), 'utf8');
  const match = forgeSrc.match(/function getClipCategory\(clipName\)\s*\{[\s\S]*?\n  \}/);
  assert.ok(match, 'getClipCategory should exist in forge.js');
  const fnCtx = {};
  vm.runInNewContext(match[0], fnCtx);
  return fnCtx.getClipCategory;
}

test('ACTIONS preserves all legacy clip IDs and expands character & creature sets', () => {
  assert.equal(C.version, '2.8.0');
  const chrIds = C.ACTIONS.character.map(a => a.id);
  const crIds = C.ACTIONS.creature.map(a => a.id);

  for (const id of LEGACY_CHARACTER_IDS) {
    assert.ok(chrIds.includes(id), `missing legacy character clip: ${id}`);
  }
  for (const id of LEGACY_CREATURE_IDS) {
    assert.ok(crIds.includes(id), `missing legacy creature clip: ${id}`);
  }

  assert.equal(chrIds.length, 50);
  assert.equal(crIds.length, 45);
});

test('ACTIONS entries have unique snake_case IDs, valid frame counts, and well-formed events', () => {
  for (const role of ['character', 'creature']) {
    const list = C.ACTIONS[role];
    const seen = new Set();
    for (const clip of list) {
      assert.match(clip.id, /^[a-z][a-z0-9_]*$/, `${role}.${clip.id} must be snake_case`);
      assert.ok(!seen.has(clip.id), `duplicate ${role} clip id: ${clip.id}`);
      seen.add(clip.id);
      assert.equal(typeof clip.zh, 'string');
      assert.ok(clip.zh.trim().length > 0, `${role}.${clip.id} missing zh`);
      assert.ok(Number.isInteger(clip.f) && clip.f > 0, `${role}.${clip.id} invalid frame count`);
      if (clip.ev) {
        assert.ok(Array.isArray(clip.ev));
        for (const ev of clip.ev) {
          const m = ev.match(/^([a-z_]+)@(\d+)$/);
          assert.ok(m, `${role}.${clip.id} invalid event format: ${ev}`);
          const frame = Number(m[2]);
          assert.ok(frame >= 0 && frame <= clip.f, `${role}.${clip.id} event frame out of range: ${ev}`);
        }
      }
    }
  }
});

test('every character and creature clip maps to a known UI category in forge.js', () => {
  const getClipCategory = extractGetClipCategory();
  const knownCategories = new Set([
    '基礎移動', '戰鬥受擊', '指令召喚', '主動技攻擊', '輔助場地', '道具背包', '生活採集', '互動撫摸'
  ]);
  for (const c of C.ACTIONS.character) {
    const cat = getClipCategory(`chr_${c.id}`);
    assert.ok(knownCategories.has(cat), `chr_${c.id} fell into ${cat}`);
  }
  for (const c of C.ACTIONS.creature) {
    const cat = getClipCategory(`cr_adult_${c.id}`);
    assert.ok(knownCategories.has(cat), `cr_adult_${c.id} fell into ${cat}`);
  }
});
