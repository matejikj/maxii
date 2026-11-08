const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  CHARACTER_ANATOMY,
  CHARACTER_BLUEPRINTS,
  RABBIT_ANATOMY_BASELINE,
  RABBIT_ARTWORK_REVISION,
  SELECTED_RABBIT_ART_VARIANT,
  buildRabbitArtVariants,
  compileCharacter,
  prepareCharacterMotion,
  recognitionPresentation,
  resolveRecognitionCompileOptions,
  shouldBlink,
  LUMI_MOTION_BUDGETS,
} = require('../.test-dist/core/index.js');

test('rabbit art variants stay comparable and selected B ships', () => {
  const variants = buildRabbitArtVariants(RABBIT_ANATOMY_BASELINE);
  assert.equal(variants.length, 3);
  assert.deepEqual(variants.map((v) => v.id), ['A', 'B', 'C']);
  assert.equal(SELECTED_RABBIT_ART_VARIANT, 'B');
  assert.equal(CHARACTER_BLUEPRINTS.rabbit.artworkRevision, RABBIT_ARTWORK_REVISION);
  assert.deepEqual(CHARACTER_ANATOMY.rabbit, variants.find((v) => v.id === 'B').parts);
  for (const variant of variants) {
    const ids = variant.parts.map((part) => part.id);
    assert.ok(ids.includes('eye-left'));
    assert.ok(ids.includes('eye-right'));
    assert.ok(ids.includes('head'));
    assert.equal(new Set(ids).size, ids.length);
    const node = compileCharacter({
      ...CHARACTER_BLUEPRINTS.rabbit,
      base: { kind: 'parts', parts: variant.parts },
    });
    assert.equal(node.kind, 'group');
  }
  assert.notEqual(
    JSON.stringify(variants[0].parts),
    JSON.stringify(variants[1].parts),
    'A and B must differ',
  );
  assert.notEqual(
    JSON.stringify(variants[1].parts),
    JSON.stringify(variants[2].parts),
    'B and C must differ',
  );
});

test('recognition actions provide static fallbacks and motion topology stays in budget', () => {
  for (const action of ['earPerk', 'headTilt']) {
    const presentation = recognitionPresentation(action);
    assert.ok(presentation.staticFallback.expression);
    assert.ok(presentation.staticFallback.pose);
    const animated = resolveRecognitionCompileOptions(action, true);
    const still = resolveRecognitionCompileOptions(action, false);
    assert.notEqual(animated.motion, 'still');
    assert.equal(still.motion, 'still');
    assert.equal(still.expression, presentation.staticFallback.expression);
  }
  assert.equal(shouldBlink('perk', 'curious', 'sitting'), true);
  assert.equal(shouldBlink('tilt', 'curious', 'sitting'), false);
  const motion = prepareCharacterMotion(CHARACTER_BLUEPRINTS.rabbit, {
    pose: 'sitting',
    expression: 'curious',
  });
  assert.ok(
    motion.parts.filter((part) => part.channel !== 'static').length
      <= LUMI_MOTION_BUDGETS.maxAnimatedSvgGroupsPerCharacter,
  );
});
