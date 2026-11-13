const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  LUMI_ANIMALS,
  CHARACTER_BLUEPRINTS,
  compileCharacter,
  prepareCharacterMotion,
  reconstructPreparedCharacter,
  applyAppearanceStylePolish,
  LUMI_MOTION_BUDGETS,
} = require('../.test-dist/core/index.js');

for (const species of LUMI_ANIMALS) {
  test(`sculpted ${species}: material detail stays attached through poses, styles and proportions`, () => {
    const blueprint = CHARACTER_BLUEPRINTS[species];
    const original = JSON.stringify(blueprint);
    const parts = [...blueprint.base.parts].sort((a, b) => a.order - b.order);
    // Every material layer belongs to one anatomical owner, including the glint
    // inside each eye so it disappears with the pupil during a blink.
    for (const id of ['head', 'body', 'belly', 'eye-left', 'eye-right', 'paw-left', 'paw-right']) {
      const owner = parts.find((part) => part.id === id);
      assert.equal(owner.geometry.kind, 'group', `${species}/${id} owns its detail`);
    }
    const proportions = {
      head: 1.15,
      body: 0.82,
      paws: 1.14,
      ...(species === 'hedgehog' ? {} : { ears: 1.3 }),
    };
    for (const pose of blueprint.supportedPoses) {
      for (const expression of blueprint.supportedExpressions) {
        for (const appearanceStyle of ['forest', 'workshop', 'restrained']) {
          const options = { pose, expression, appearanceStyle, proportions, accessories: ['star'] };
          const prepared = prepareCharacterMotion(blueprint, options);
          assert.deepEqual(
            reconstructPreparedCharacter(prepared),
            compileCharacter(blueprint, options),
          );
          assert.equal(prepared.parts.length, parts.length + 1);
          assert.ok(
            prepared.parts.filter((part) => part.channel !== 'static').length <=
              LUMI_MOTION_BUDGETS.maxAnimatedSvgGroupsPerCharacter,
          );
        }
      }
    }
    const options = { pose: 'standing', proportions };
    const compiled = compileCharacter(blueprint, options);
    parts.forEach((part, index) => {
      if (!['head', 'body', 'ear', 'paw', 'muzzle'].includes(part.role)) return;
      const owner = compiled.children[index];
      assert.equal(owner.kind, 'group');
      assert.match(owner.props.transform, /translate|scale/);
      assert.strictEqual(
        owner.children[0],
        part.geometry,
        `${species}/${part.id}: transform wraps the whole material group`,
      );
    });
    assert.equal(JSON.stringify(blueprint), original);
  });

  test(`sculpted ${species}: appearance styles still reach grouped anatomy`, () => {
    const parts = CHARACTER_BLUEPRINTS[species].base.parts;
    const forest = applyAppearanceStylePolish(parts, 'forest');
    const restrained = applyAppearanceStylePolish(parts, 'restrained');
    assert.strictEqual(forest, parts);
    const head = restrained.find((part) => part.id === 'head');
    assert.match(head.geometry.props.transform, /scale\(1 1\.02\)$/);
    for (const part of restrained.filter((part) => part.role === 'cheek')) {
      assert.ok(
        part.geometry.props.opacity <
          forest.find((source) => source.id === part.id).geometry.props.opacity,
      );
    }
    assert.ok(restrained.find((part) => part.id === 'seed-mark').geometry.props.opacity <= 0.35);
    const highlight = parts.find((part) => part.id === 'highlight');
    if (highlight) assert.equal(highlight.role, 'head', 'forehead highlight follows the head');
  });
}
