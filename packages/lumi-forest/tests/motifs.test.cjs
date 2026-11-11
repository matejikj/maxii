const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  LUMI_MOTIF_IDS, LUMI_MOTIFS, isLumiMotif, resolveLumiTheme, contrastRatio,
  compileLumiMotifLandscape, serializeScene, readSceneDocument, countVectorNodes,
} = require('../.test-dist/core/index.js');

const pairs = [['text', 'background'], ['text', 'surface'], ['text', 'surfaceSubtle'],
  ['textMuted', 'background'], ['textMuted', 'surface'], ['onPrimary', 'primary'],
  ['onSecondary', 'secondary'], ['onDanger', 'danger'], ['onSceneAccent', 'sceneAccent']];

test('environment IDs are independent from character styles and reject unknown worlds', () => {
  assert.deepEqual([...LUMI_MOTIF_IDS], ['forest', 'garden', 'playground']);
  for (const id of LUMI_MOTIF_IDS) {
    assert.equal(isLumiMotif(id), true);
    assert.equal(LUMI_MOTIFS[id].id, id);
  }
  for (const id of ['workshop', 'restrained', 'ocean', '', null]) assert.equal(isLumiMotif(id), false);
  assert.throws(() => resolveLumiTheme('home', 'light', 'ocean'), /Unknown Lumi motif/);
  assert.throws(() => compileLumiMotifLandscape('ocean'), /Unknown Lumi motif/);
  assert.throws(() => compileLumiMotifLandscape('garden', { variant: 'sunset' }), /Unknown motif/);
});

test('default forest stays the same stable theme instance for existing callers', () => {
  assert.strictEqual(resolveLumiTheme(), resolveLumiTheme('home', 'light', 'forest'));
  assert.equal(resolveLumiTheme().colors.primary, '#304E42');
  assert.equal(resolveLumiTheme().colors.background, '#FAF7F1');
});

for (const motif of LUMI_MOTIF_IDS) {
  for (const mode of ['light', 'dark']) {
    test(`${motif}/${mode}: all activity scenes keep readable text, controls and focus`, () => {
      for (const scene of ['home', 'growth', 'sleep', 'feeding', 'milestones']) {
        const theme = resolveLumiTheme(scene, mode, motif);
        assert.strictEqual(theme, resolveLumiTheme(scene, mode, motif));
        assert.equal(theme.motif, motif);
        assert.ok(Object.isFrozen(theme) && Object.isFrozen(theme.colors));
        for (const [fg, bg] of pairs) {
          const ratio = contrastRatio(theme.colors[fg], theme.colors[bg]);
          assert.ok(ratio >= 4.5, `${scene}: ${fg}/${bg} = ${ratio.toFixed(2)}`);
        }
        for (const key of ['controlBorder', 'focus']) {
          assert.ok(contrastRatio(theme.colors[key], theme.colors.surface) >= 3, `${scene}: ${key}`);
        }
      }
    });
    for (const variant of ['day', 'dusk']) {
      test(`${motif}/${mode}/${variant}: scenery is retained, deterministic, portable and bounded`, () => {
        const doc = compileLumiMotifLandscape(motif, { mode, variant });
        assert.strictEqual(doc, compileLumiMotifLandscape(motif, { mode, variant }));
        assert.equal(doc.width, 400);
        assert.equal(doc.height, 200);
        assert.ok(countVectorNodes(doc) <= 180, `${countVectorNodes(doc)} nodes`);
        const restored = readSceneDocument(JSON.parse(JSON.stringify(doc)));
        assert.equal(serializeScene(doc), serializeScene(restored));
        const svg = serializeScene(doc);
        assert.doesNotMatch(svg, /<image|<filter|<script|https?:\/\/(?!www.w3.org)/);
      });
    }
  }
}

test('each environment has its own object geometry and semantic palette', () => {
  const worlds = LUMI_MOTIF_IDS.map(id => compileLumiMotifLandscape(id));
  assert.equal(new Set(worlds.map(doc => JSON.stringify(doc.layers.find(layer => layer.id === 'objects')))).size, 3);
  assert.equal(new Set(LUMI_MOTIF_IDS.map(id => resolveLumiTheme('home', 'light', id).colors.primary)).size, 3);
});
