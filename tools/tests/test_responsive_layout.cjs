const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
const css = [...html.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');
const responsive = css.slice(css.indexOf('/* ---- Responsive workspaces:'));
const requiredIds = [
  'driveToolbar', 'drivePromptPath', 'pipelineControls', 'forgeView',
  'reviewView', 'rail', 'railList', 'stageHost', 'stageViewport', 'panel',
  'panelTabs', 'panelBody', 'designedView', 'designedRail', 'designedRailList',
  'designedStageHost', 'designedDetailView', 'designedCardsView',
  'stage3dHud', 'stage3dTimeline', 'stage3dCanvas'
];

function mediaBlocks(source) {
  const blocks = [];
  const pattern = /@media\s*([^{}]+)\s*\{/g;
  let match;
  while ((match = pattern.exec(source))) {
    let depth = 1, index = pattern.lastIndex;
    for (; index < source.length && depth; index++) {
      if (source[index] === '{') depth++;
      if (source[index] === '}') depth--;
    }
    assert.equal(depth, 0, 'Unclosed media query: ' + match[1]);
    blocks.push({ query: match[1].trim(), css: source.slice(pattern.lastIndex, index - 1) });
    pattern.lastIndex = index;
  }
  return blocks;
}

test('responsive CSS and all referenced workspace IDs exist', () => {
  assert.ok(responsive.startsWith('/* ---- Responsive workspaces:'));
  for (const id of requiredIds) {
    assert.match(html, new RegExp('id="' + id + '"'), 'Missing element: ' + id);
  }
});

test('phone portrait, landscape, tablet portrait, and touch layouts are covered', () => {
  const media = mediaBlocks(responsive);
  for (const fragment of [
    'max-width: 699px', 'max-width: 1023px', 'orientation: portrait',
    'orientation: landscape', 'max-height: 600px', 'pointer: coarse'
  ]) {
    assert.ok(media.some(block => block.query.includes(fragment)), 'Missing breakpoint: ' + fragment);
  }
  const phone = media.find(block => block.query.includes('max-width: 699px'));
  assert.match(phone.css, /#reviewView\.active\s*\{\s*display:\s*flex;\s*flex-direction:\s*column/);
  assert.match(phone.css, /#designedView\.active\s*\{\s*display:\s*flex;\s*flex-direction:\s*column/);
  assert.match(phone.css, /#stageCompareView\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(phone.css, /#reviewView #railList[^}]*overflow-y:\s*auto/);
  assert.match(phone.css, /#designedRailList[^}]*overflow-y:\s*auto/);
  const landscape = media.find(block => block.query.includes('orientation: landscape'));
  assert.match(landscape.css, /#reviewView\.active[^}]*display:\s*grid/);
  assert.match(landscape.css, /#designedView\.active[^}]*display:\s*grid/);
});

test('tablet review has a full-width detail panel and no fixed-width sidebars', () => {
  const media = mediaBlocks(responsive);
  const tablet = media.find(block => block.query.includes('max-width: 1023px'));
  assert.match(tablet.css, /#reviewView aside#panel[^}]*grid-column:\s*1 \/ -1/);
  assert.match(tablet.css, /#reviewView #rail[^}]*width:\s*auto/);
  assert.match(tablet.css, /#designedView #designedRail[^}]*width:\s*auto/);
});

test('responsive rules preserve readable dialogs, touch and viewport sizing', () => {
  assert.match(responsive, /#driveGate[^}]*calc\(100% - 24px\)/);
  assert.match(responsive, /\.upgrade-card[^}]*100dvh/);
  assert.match(responsive, /#stage3dCanvas\s*\{\s*touch-action:\s*none/);
  assert.match(responsive, /#forgeView textarea#prompt[^}]*min-height/);
});

test('unified tooltips cover keyboard, touch, and dynamic controls', () => {
  assert.match(html, /id="uiTooltip"/);
  assert.match(html, /const tooltipControls =/);
  assert.match(html, /MutationObserver\(records =>/);
  assert.match(html, /observer\.observe\(document\.body, \{ childList: true, subtree: true \}\)/);
  assert.match(html, /e\.pointerType === "touch"/);
  assert.match(html, /e\.key === "Escape"/);
  assert.match(html, /document\.addEventListener\("focusin"/);
  assert.match(html, /text\.replace\(\/\\s\+\/g, " "\)/);
  for (const id of ['pipelineStage', 'pipelineAppearance', 'pipelineParameters',
    'prompt', 'stage3dClipSelect', 'stage3dScrubber']) {
    assert.match(html, new RegExp('\\b' + id + ': "'), 'Missing tooltip description: ' + id);
  }
});
