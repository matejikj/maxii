const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveStudioPresentation,
  resolveCompanionPresentation,
  resolveStudioMotionRecipe,
  studioActionDurationMs,
  STUDIO_ACTION_IDS,
  STUDIO_MOTION,
  CHARACTER_COLLECTION,
} = require('../.test-dist/core/index.js');

test('workshop style plays studio motion for owning species only', () => {
  const ok = resolveStudioPresentation({
    species: 'rabbit',
    studioAction: 'planPath',
    appearanceStyle: 'workshop',
    animate: true,
  });
  assert.equal(ok.usedFallback, false);
  assert.equal(ok.studioActionId, 'planPath');
  assert.equal(ok.motion, STUDIO_MOTION);
  assert.equal(ok.animate, true);
  assert.deepEqual(ok.props, ['routeMap']);

  const wrongSpecies = resolveStudioPresentation({
    species: 'fox',
    studioAction: 'planPath',
    appearanceStyle: 'workshop',
    animate: true,
  });
  assert.equal(wrongSpecies.usedFallback, true);
  assert.equal(wrongSpecies.studioActionId, null);
  assert.equal(wrongSpecies.motion, 'still');
});

test('forest and restrained keep semantic static fallback for studio ids', () => {
  for (const style of ['forest', 'restrained']) {
    const view = resolveStudioPresentation({
      species: 'rabbit',
      studioAction: 'planPath',
      appearanceStyle: style,
      animate: true,
    });
    assert.equal(view.animate, false);
    assert.equal(view.motion, 'still');
    assert.equal(view.usedFallback, true);
  }
});

test('missing installed studio capability falls back without throwing', () => {
  const view = resolveStudioPresentation({
    species: 'rabbit',
    studioAction: 'planPath',
    appearanceStyle: 'workshop',
    installedCapabilities: ['art.collection.v1'],
    animate: true,
  });
  assert.equal(view.usedFallback, true);
  assert.equal(view.studioActionId, null);
});

test('companion presentation keeps signatureActions tuple length two', () => {
  for (const species of Object.keys(CHARACTER_COLLECTION)) {
    assert.equal(CHARACTER_COLLECTION[species].signatureActions.length, 2);
  }
  const companion = resolveCompanionPresentation({
    species: 'rabbit',
    studioAction: 'planPath',
    appearanceStyle: 'workshop',
    animate: true,
  });
  assert.equal(companion.studioActionId, 'planPath');
  assert.equal(companion.appearanceStyle, 'workshop');
  assert.equal(companion.settlesToCalm, true);
});

test('each studio action has a bounded one-shot recipe', () => {
  for (const id of STUDIO_ACTION_IDS) {
    const recipe = resolveStudioMotionRecipe(id);
    assert.equal(recipe.loops, false);
    assert.equal(recipe.settlesToCalm, true);
    const duration = studioActionDurationMs(id);
    assert.ok(duration >= 1600 && duration <= 2400);
  }
});
