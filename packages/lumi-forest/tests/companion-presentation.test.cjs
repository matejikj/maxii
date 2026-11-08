const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  CHARACTER_BLUEPRINTS,
  CHARACTER_COLLECTION,
  CHARACTER_SEMANTIC_STATES,
  LUMI_ANIMALS,
  compileCharacter,
  listSignatureActionIds,
  prepareCharacterMotion,
  reconstructPreparedCharacter,
  resolveCompanionPresentation,
  serializeVectorNode,
} = require('../.test-dist/core/index.js');

test('every species maps all semantic states and two signature actions', () => {
  for (const species of LUMI_ANIMALS) {
    assert.equal(listSignatureActionIds(species).length, 2);
    for (const state of CHARACTER_SEMANTIC_STATES) {
      const still = resolveCompanionPresentation({ species, semantic: state, animate: false });
      assert.equal(still.motion, 'still');
      assert.equal(still.animate, false);
      assert.equal(still.species, species);
      const moving = resolveCompanionPresentation({ species, semantic: state, animate: true });
      if (state === 'static') {
        assert.equal(moving.motion, 'still');
        assert.equal(moving.animate, false);
      } else {
        assert.notEqual(moving.motion, 'still');
        assert.equal(moving.animate, true);
      }
    }
    for (const action of CHARACTER_COLLECTION[species].signatureActions) {
      const resolved = resolveCompanionPresentation({
        species,
        signatureAction: action.id,
        animate: true,
      });
      assert.equal(resolved.signatureActionId, action.id);
      assert.equal(resolved.prop, action.prop);
      assert.equal(resolved.semantic, action.semantic);
    }
  }
});

test('unknown signature action and species fail closed without throwing', () => {
  const calm = resolveCompanionPresentation({
    species: 'dragon',
    signatureAction: 'missing-action',
    expression: 'happy',
    motion: 'idle',
    animate: false,
  });
  assert.equal(calm.species, 'rabbit');
  assert.equal(calm.motion, 'still');
  assert.equal(calm.prop, null);
  assert.equal(calm.signatureActionId, null);
});

test('one-shot gestures settle to calm; reduce-motion keeps meaning', () => {
  const perk = resolveCompanionPresentation({
    species: 'rabbit',
    signatureAction: 'earPerk',
    animate: true,
  });
  assert.equal(perk.settlesToCalm, true);
  assert.equal(perk.motion, 'perk');

  const staticPerk = resolveCompanionPresentation({
    species: 'rabbit',
    recognition: 'earPerk',
    animate: false,
  });
  assert.equal(staticPerk.animate, false);
  assert.equal(staticPerk.expression, 'curious');
  assert.equal(staticPerk.pose, 'sitting');

  const staticTilt = resolveCompanionPresentation({
    species: 'rabbit',
    recognition: 'headTilt',
    animate: false,
  });
  assert.equal(staticTilt.pose, 'standing');
  assert.equal(staticTilt.expression, 'curious');
});

test('signature props compile into motion topology without reordering anatomy', () => {
  for (const species of LUMI_ANIMALS) {
    for (const action of CHARACTER_COLLECTION[species].signatureActions) {
      if (action.prop == null) continue;
      const options = {
        pose: 'standing',
        expression: 'curious',
        prop: action.prop,
      };
      const prepared = prepareCharacterMotion(CHARACTER_BLUEPRINTS[species], options);
      const compiled = compileCharacter(CHARACTER_BLUEPRINTS[species], options);
      assert.equal(
        serializeVectorNode(reconstructPreparedCharacter(prepared)),
        serializeVectorNode(compiled),
      );
      assert.equal(prepared.parts.at(-1).role, 'accessory');
    }
  }
});
