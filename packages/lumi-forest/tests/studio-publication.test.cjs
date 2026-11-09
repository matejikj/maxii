const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  publishCurrentCharacterCollections,
  planNextCollectionExpansion,
  resolvePublishedAppearanceStyle,
  studioActionsPublishedForSpecies,
  measureStudioSceneComplexity,
  measureForestSittingNodes,
  STUDIO_ACTION_IDS,
} = require('../.test-dist/core/index.js');

test('current publication lists workshop styles and studio capabilities without product screen switches', () => {
  const pub = publishCurrentCharacterCollections();
  assert.equal(pub.studioCollectionVersion, 'lumi.characters.studio.v1');
  assert.deepEqual([...pub.appearanceStyles], ['forest', 'workshop', 'restrained']);
  assert.equal(pub.studioActionIds.length, 8);
  assert.ok(pub.readerCapabilities.includes('art.studio.v1'));
  assert.ok(pub.readerCapabilities.includes('studio.planPath'));
  assert.equal(resolvePublishedAppearanceStyle('workshop', pub), 'workshop');
  assert.equal(resolvePublishedAppearanceStyle('unknown', pub), 'forest');
  assert.deepEqual([...studioActionsPublishedForSpecies('rabbit', pub)], [
    'planPath',
    'tryAlternatePath',
  ]);
  assert.deepEqual([...studioActionsPublishedForSpecies('fox', pub)], []);
});

test('next collection with unknown capabilities stays inactive and keeps the current guide', () => {
  const pub = publishCurrentCharacterCollections();
  const plan = planNextCollectionExpansion({
    nextCollectionVersion: 'lumi.characters.studio.v2',
    additionalCapabilities: ['studio.futureGesture', 'art.studio.v2'],
    knownInstalled: pub.readerCapabilities,
  });
  assert.equal(plan.activates, false);
  assert.equal(plan.keepsCurrentGuide, true);
  assert.deepEqual(plan.missingCapabilities, ['studio.futureGesture', 'art.studio.v2']);
});

test('studio scenes stay within workshop node and prop budgets', () => {
  const report = measureStudioSceneComplexity();
  assert.equal(report.perAction.length, STUDIO_ACTION_IDS.length);
  assert.equal(report.withinPropBudget, true);
  assert.equal(report.withinWorkshopNodeBudget, true);
  assert.ok(report.maxStudioActionProps <= 2);
  assert.ok(report.maxStudioActionNodes <= 240);
  const forestRabbit = measureForestSittingNodes('rabbit');
  assert.ok(forestRabbit > 0);
});
