const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  LUMI_ANIMALS,
  CHARACTER_BLUEPRINTS,
  CHARACTER_COLLECTION,
  CHARACTER_COLLECTION_VERSION,
  CHARACTER_PROP_IDS,
  CHARACTER_SEMANTIC_STATES,
  COLLECTION_EXTREME_PROPORTIONS,
  COLLECTION_POSE_EXPRESSION_FIXTURES,
  COLLECTION_SAFE_UI_INSET,
  COLLECTION_SCALE_FIXTURES,
  DEFAULT_GUIDE_SPECIES,
  compileCharacter,
  compileCharacterProp,
  listCollectionEntries,
  resolveCollectionSpecies,
  resolveSemanticPresentation,
  summarizeCollectionComplexity,
} = require('../.test-dist/core/index.js');

test('collection ships eight species with revisions and two signature actions', () => {
  assert.equal(LUMI_ANIMALS.length, 8);
  assert.deepEqual([...LUMI_ANIMALS], [
    'rabbit', 'bear', 'fox', 'otter', 'hedgehog', 'owl', 'squirrel', 'fawn',
  ]);
  for (const species of LUMI_ANIMALS) {
    const entry = CHARACTER_COLLECTION[species];
    assert.equal(entry.species, species);
    assert.equal(entry.signatureActions.length, 2);
    assert.equal(entry.supportedSemanticStates.length, 8);
    assert.ok(entry.artworkRevision.startsWith('lumi.'));
    assert.equal(CHARACTER_BLUEPRINTS[species].artworkRevision, entry.artworkRevision);
    assert.equal(CHARACTER_BLUEPRINTS[species].displayName, entry.displayName);
  }
  assert.equal(listCollectionEntries().length, 8);
  assert.equal(CHARACTER_SEMANTIC_STATES.length, 8);
});

test('unknown species resolve to a static calm rabbit without throwing', () => {
  assert.equal(resolveCollectionSpecies('unicorn'), DEFAULT_GUIDE_SPECIES);
  assert.equal(resolveCollectionSpecies(null), DEFAULT_GUIDE_SPECIES);
  assert.equal(resolveCollectionSpecies('owl'), 'owl');
  const broken = resolveSemanticPresentation('static', true);
  assert.equal(broken.motion, 'still');
  assert.equal(broken.expression, 'neutral');
});

test('offline props compile against every species rig', () => {
  for (const species of LUMI_ANIMALS) {
    const blueprint = CHARACTER_BLUEPRINTS[species];
    for (const prop of CHARACTER_PROP_IDS) {
      const node = compileCharacterProp(prop, blueprint.rig);
      assert.equal(node.kind, 'group');
    }
    const withBook = compileCharacter(blueprint, {
      accessories: ['star'],
      expression: 'curious',
    });
    assert.equal(withBook.kind, 'group');
  }
});

test('collection complexity summary stays install-local', () => {
  const summary = summarizeCollectionComplexity();
  assert.equal(summary.version, CHARACTER_COLLECTION_VERSION);
  assert.equal(summary.speciesCount, 8);
  assert.equal(summary.semanticStates, 8);
  assert.equal(summary.signatureActions, 16);
  assert.equal(summary.blueprintRevisions.owl, 'lumi.owl.art.c2');
});

test('collection fixtures cover scales, extremes and eight semantic poses', () => {
  assert.ok(COLLECTION_SCALE_FIXTURES.compact.width <= 48);
  assert.ok(COLLECTION_SAFE_UI_INSET.bottom >= 16);
  assert.equal(COLLECTION_POSE_EXPRESSION_FIXTURES.length, 8);
  for (const species of LUMI_ANIMALS) {
    if (species === 'hedgehog') {
      assert.throws(() =>
        compileCharacter(CHARACTER_BLUEPRINTS[species], {
          proportions: { ears: COLLECTION_EXTREME_PROPORTIONS.ears },
        }),
      );
      continue;
    }
    const extreme = compileCharacter(CHARACTER_BLUEPRINTS[species], {
      proportions: COLLECTION_EXTREME_PROPORTIONS,
      pose: 'standing',
      expression: 'curious',
    });
    assert.equal(extreme.kind, 'group');
  }
});
