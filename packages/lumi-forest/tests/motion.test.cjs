const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  LUMI_ANIMALS, CHARACTER_BLUEPRINTS, compileCharacter, serializeVectorNode,
  prepareCharacterMotion, reconstructPreparedCharacter, LUMI_MOTION_PROFILE,
  LUMI_MOTION_BUDGETS, shouldAnimate, shouldBlink, validateMotionProfile,
} = require('../.test-dist/core/index.js');
const expressions = ['neutral', 'happy', 'curious', 'sleepy'];
const poses = ['sitting', 'standing', 'sleeping'];

for (const species of LUMI_ANIMALS) {
  test(`motion topology ${species}: stable all pose/expression variants`, () => {
    const blueprint = CHARACTER_BLUEPRINTS[species];
    for (const pose of poses) for (const expression of expressions) {
      const opts = { pose, expression };
      const motion = prepareCharacterMotion(blueprint, opts);
      const expected = compileCharacter(blueprint, opts);
      assert.strictEqual(motion.source, expected, 'should reuse character compiler cache/reference');
      assert.equal(serializeVectorNode(reconstructPreparedCharacter(motion)), serializeVectorNode(expected),
        `${species}/${pose}/${expression} differs in geometry or painter order`);
      assert.equal(motion.parts.filter(p => p.channel === 'leftEye').length, 1);
      assert.equal(motion.parts.filter(p => p.channel === 'rightEye').length, 1);
      assert.ok(motion.parts.every(p => p.channel === 'static' || p.pivot && Number.isFinite(p.pivot.x) && Number.isFinite(p.pivot.y)));
      assert.equal(!!motion.outerProps, pose === 'sleeping');
      assert.ok(motion.parts.filter(p => p.channel !== 'static').length <= LUMI_MOTION_BUDGETS.maxAnimatedSvgGroupsPerCharacter);
    }
  });
  test(`motion topology ${species}: accessories/proportions do not reorder anatomy`, () => {
    const options = { pose: 'standing', expression: 'happy', accessories: ['star', 'scarf'],
      proportions: species === 'hedgehog' ? { body: 1.03 } : { head: 1.06, ears: 1.02 } };
    const motion = prepareCharacterMotion(CHARACTER_BLUEPRINTS[species], options);
    const result = compileCharacter(CHARACTER_BLUEPRINTS[species], options);
    assert.equal(serializeVectorNode(reconstructPreparedCharacter(motion)), serializeVectorNode(result));
    assert.equal(motion.parts.filter(p => p.role === 'accessory').length, 2);
    assert.equal(motion.parts.at(-1).role, 'accessory');
    assert.deepEqual(motion.parts.slice(0,-2).map(p => p.id), CHARACTER_BLUEPRINTS[species].base.parts
      .map((part, index) => ({part,index})).sort((a,b) => a.part.order - b.part.order || a.index - b.index).map(x => x.part.id));
  });
}

test('motion is system-first: neither caller nor visibility bypass OS Reduce Motion', () => {
  for (const enabled of [true, false]) for (const reducedMotion of [true, false])
    for (const foreground of [true, false]) for (const visible of [true, false]) {
      const state = { enabled, reducedMotion, foreground, visible };
      assert.equal(shouldAnimate(state), enabled && !reducedMotion && foreground && visible);
    }
});

test('sleepy faces and sleeping poses never blink; still character does not move', () => {
  assert.equal(shouldBlink('idle', 'neutral', 'sitting'), true);
  assert.equal(shouldBlink('idle', 'curious', 'standing'), true);
  assert.equal(shouldBlink('idle', 'sleepy', 'sitting'), false);
  assert.equal(shouldBlink('idle', 'neutral', 'sleeping'), false);
  assert.equal(shouldBlink('sleeping', 'neutral', 'sitting'), false);
  assert.equal(shouldBlink('still', 'neutral', 'sitting'), false);
});

test('motion recipes are valid, bounded and low amplitude', () => {
  assert.strictEqual(validateMotionProfile(LUMI_MOTION_PROFILE), LUMI_MOTION_PROFILE);
  assert.ok(LUMI_MOTION_PROFILE.amplitude.breatheScale < 1.05);
  assert.ok(LUMI_MOTION_PROFILE.timing.blinkIntervalMs > 3000);
  assert.ok(LUMI_MOTION_BUDGETS.maxTransitionDocuments === 2);
  assert.throws(() => validateMotionProfile({ ...LUMI_MOTION_PROFILE,
    amplitude: {...LUMI_MOTION_PROFILE.amplitude, breatheScale: 1.9} }), /Invalid breathing/);
  assert.throws(() => validateMotionProfile({ ...LUMI_MOTION_PROFILE,
    timing: {...LUMI_MOTION_PROFILE.timing, blinkCloseMs: 16000} }), /Invalid motion timing/);
  assert.throws(() => validateMotionProfile({ ...LUMI_MOTION_PROFILE,
    timing: {...LUMI_MOTION_PROFILE.timing, blinkCloseMs: 4600} }), /Blink cycle/);
});

test('motion source contract: frame callbacks cannot compile geometry or set JS state', () => {
  const root = path.join(__dirname, '../src/react-native/motion');
  const character = fs.readFileSync(path.join(root, 'LumiAnimatedCharacter.tsx'), 'utf8');
  const transition = fs.readFileSync(path.join(root, 'LumiSceneTransition.tsx'), 'utf8');
  assert.match(character, /useMemo\(\(\) => prepareCharacterMotion\(/);
  assert.match(character, /useAnimatedProps/);
  assert.match(character, /cancelAnimation/);
  assert.doesNotMatch(character, /requestAnimationFrame|setInterval/);
  assert.doesNotMatch(transition, /composeScene\(|compileCharacter\(/);
  assert.match(transition, /setOutgoing\(null\)/);
  const nativeCode = [character, transition].join('\n');
  assert.doesNotMatch(nativeCode, /runOnJS|scheduleOnRN/);
});


test('animated procedural character reserves a movement envelope outside UI exclusions', () => {
  const { planProceduralScene, inflate, intersect } = require('../.test-dist/core/index.js');
  const shapes = [
    { width: 390, height: 844 }, { width: 320, height: 568 },
    { width: 768, height: 1024 }, { width: 1024, height: 768 },
  ];
  for (const viewport of shapes) for (const scene of ['home', 'growth', 'sleep', 'feeding', 'milestones']) {
    const plan = planProceduralScene({ scene, viewport, seed:'motion-safe-zone',
      characterMotionPadding: 18,
      safeZones: [{ id: 'ui-title', x: 20, y: 18, width: Math.min(210, viewport.width-30), height: 120, padding: 8 }],
      density:'regular',
    });
    const character = plan.items.find(x => x.kind === 'character');
    if (character) {
      const envelope = inflate(character.bounds, 18);
      assert.ok(envelope.x >= 0 && envelope.y >= 0);
      assert.ok(envelope.x + envelope.width <= viewport.width);
      assert.ok(envelope.y + envelope.height <= viewport.height);
      for (const exclusion of plan.excluded) assert.equal(intersect(envelope, exclusion), false, `${scene} safe zone collision`);
      for (const item of plan.items.filter(item => item.kind !== 'character')) {
        assert.equal(intersect(envelope, item.bounds), false, `${scene} decoration collision`);
      }
    }
    assert.throws(() => planProceduralScene({ scene, viewport, characterMotionPadding: 33 }), /padding/);
    assert.throws(() => planProceduralScene({ scene, viewport, characterMotionPadding: -1 }), /padding/);
  }
});
test('animated procedural integration never recompiles geometry in animated handlers', () => {
  const nativeCode = require('node:fs').readFileSync(require('node:path').join(__dirname,
    '../src/react-native/motion/LumiAnimatedProceduralBackground.tsx'), 'utf8');
  assert.match(nativeCode, /useMemo\(\(\) => viewport \? planProceduralScene\(/);
  assert.match(nativeCode, /characterMotionPadding: EXTRA_CHARACTER_CLEARANCE/);
  assert.doesNotMatch(nativeCode, /useAnimatedProps|requestAnimationFrame|setInterval/);
});
