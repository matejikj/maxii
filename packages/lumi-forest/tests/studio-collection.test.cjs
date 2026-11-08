const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  LUMI_ANIMALS,
  CHARACTER_BLUEPRINTS,
  CHARACTER_COLLECTION,
  CHARACTER_PROP_IDS,
  FOREST_PROP_IDS,
  CHARACTER_APPEARANCE_STYLES,
  STUDIO_ACTION_IDS,
  STUDIO_ACTIONS,
  STUDIO_COLLECTION_VERSION,
  STUDIO_PROP_IDS,
  compileCharacter,
  compileCharacterProp,
  compileStudioActionStatic,
  listStudioActionsForSpecies,
  resolveStudioAction,
  restrainedPortraitScale,
  summarizeStudioComplexity,
} = require('../.test-dist/core/index.js');

test('forest signature actions stay two per species after workshop expansion', () => {
  assert.equal(FOREST_PROP_IDS.length, 4);
  assert.equal(STUDIO_PROP_IDS.length, 6);
  assert.equal(CHARACTER_PROP_IDS.length, 10);
  for (const species of LUMI_ANIMALS) {
    assert.equal(CHARACTER_COLLECTION[species].signatureActions.length, 2);
  }
});

test('studio ships eight static actions for four known guides', () => {
  assert.equal(STUDIO_ACTION_IDS.length, 8);
  assert.deepEqual(
    STUDIO_ACTION_IDS.map((id) => STUDIO_ACTIONS[id].species),
    ['rabbit', 'rabbit', 'bear', 'bear', 'owl', 'owl', 'squirrel', 'squirrel'],
  );
  assert.equal(listStudioActionsForSpecies('rabbit').length, 2);
  assert.equal(listStudioActionsForSpecies('fox').length, 0);
  assert.equal(resolveStudioAction('missing'), null);
  assert.equal(resolveStudioAction('planPath')?.capability, 'studio.planPath');
});

test('workshop props and static action poses compile offline for every guide', () => {
  for (const prop of STUDIO_PROP_IDS) {
    for (const species of LUMI_ANIMALS) {
      const node = compileCharacterProp(prop, CHARACTER_BLUEPRINTS[species].rig);
      assert.equal(node.kind, 'group');
    }
  }
  for (const id of STUDIO_ACTION_IDS) {
    const action = STUDIO_ACTIONS[id];
    const blueprint = CHARACTER_BLUEPRINTS[action.species];
    const node = compileStudioActionStatic(blueprint, id, 'workshop');
    assert.ok(node);
    assert.equal(node.kind, 'group');
    assert.equal(compileStudioActionStatic(blueprint, id, 'restrained')?.kind, 'group');
  }
  assert.equal(compileStudioActionStatic(CHARACTER_BLUEPRINTS.fox, 'planPath'), null);
  assert.equal(compileStudioActionStatic(CHARACTER_BLUEPRINTS.rabbit, 'unknown'), null);
});

test('appearance styles render for all eight species without remote assets', () => {
  assert.deepEqual([...CHARACTER_APPEARANCE_STYLES], ['forest', 'workshop', 'restrained']);
  for (const species of LUMI_ANIMALS) {
    for (const style of CHARACTER_APPEARANCE_STYLES) {
      const node = compileCharacter(CHARACTER_BLUEPRINTS[species], {
        pose: 'sitting',
        expression: 'neutral',
        appearanceStyle: style,
      });
      assert.equal(node.kind, 'group');
    }
  }
  assert.ok(restrainedPortraitScale(24) < restrainedPortraitScale(48));
});

test('studio complexity summary stays install-local', () => {
  const summary = summarizeStudioComplexity();
  assert.equal(summary.version, STUDIO_COLLECTION_VERSION);
  assert.equal(summary.studioActions, 8);
  assert.equal(summary.studioProps, 6);
  assert.equal(summary.appearanceStyles, 3);
  assert.equal(summary.speciesWithStudioActions, 4);
});
