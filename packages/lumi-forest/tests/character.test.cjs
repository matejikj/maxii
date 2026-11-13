const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const {
  compileCharacter,
  CHARACTER_BLUEPRINTS,
  CHARACTER_CATALOG,
  CHARACTER_ANATOMY,
  CHARACTER_ARTWORK,
  LUMI_ANIMALS,
  serializeVectorNode,
  composeScene,
  PROPORTION_LIMITS,
  ACCESSORY_SLOTS,
} = require('../.test-dist/core/index.js');
const { circle } = require('../.test-dist/core/vector/nodes.js');

const POSES = ['sitting', 'standing'];
const EXPRESSIONS = ['neutral', 'happy', 'curious', 'sleepy'];
const hash = (node) => createHash('sha256').update(serializeVectorNode(node)).digest('hex');
function count(node) {
  return 1 + (node.kind === 'group' ? node.children.reduce((n, child) => n + count(child), 0) : 0);
}

for (const species of LUMI_ANIMALS) {
  test(`v2 anatomy ${species}: semantic parts, shared canonical artwork and no mutation`, () => {
    const blueprint = CHARACTER_BLUEPRINTS[species];
    assert.equal(blueprint.schemaVersion, 2);
    assert.equal(blueprint.species, species);
    assert.equal(blueprint.base.kind, 'parts');
    const parts = CHARACTER_ANATOMY[species];
    assert.equal(blueprint.base.parts, parts);
    assert.ok(parts.length >= 15);
    assert.equal(new Set(parts.map((p) => p.id)).size, parts.length);
    for (const role of ['body', 'belly', 'head', 'paw', 'eye', 'nose', 'mouth']) {
      assert.ok(
        parts.some((p) => p.role === role),
        `${species} has ${role}`,
      );
    }
    assert.ok(parts.some((p) => p.id === 'eye-left'));
    assert.ok(parts.some((p) => p.id === 'eye-right'));
    if (species !== 'hedgehog') assert.ok(parts.some((p) => p.role === 'ear'));
    else assert.ok(parts.some((p) => p.role === 'spines'));
    const original = JSON.stringify(blueprint);
    const rendered = compileCharacter(blueprint);
    assert.strictEqual(
      rendered,
      compileCharacter(blueprint, { pose: 'sitting', expression: 'neutral' }),
    );
    assert.strictEqual(rendered, CHARACTER_CATALOG[species].anatomy);
    assert.deepEqual(rendered, CHARACTER_ARTWORK[species]);
    assert.equal(JSON.stringify(blueprint), original);
  });

  test(`v2 ${species}: full pose/expression matrix (2 × 4), deterministic and distinct`, () => {
    const blueprint = CHARACTER_BLUEPRINTS[species];
    const shapes = new Set();
    for (const pose of POSES) {
      for (const expression of EXPRESSIONS) {
        const options = { pose, expression };
        const node = compileCharacter(blueprint, options);
        assert.equal(node.kind, 'group');
        const h = hash(node);
        assert.equal(h, hash(compileCharacter(blueprint, options)));
        assert.ok(count(node) <= 256, `${species} ${pose} ${expression}: node budget`);
        assert.ok(!shapes.has(h), `${species}: duplicate pose/expression ${pose} ${expression}`);
        shapes.add(h);
      }
    }
    assert.equal(shapes.size, 8);
    assert.notEqual(
      hash(compileCharacter(blueprint, { pose: 'sleeping' })),
      hash(compileCharacter(blueprint)),
    );
  });

  test(`v2 ${species}: accessories attach, combine and validate slots`, () => {
    const blueprint = CHARACTER_BLUEPRINTS[species];
    const bare = hash(compileCharacter(blueprint));
    for (const accessory of Object.keys(ACCESSORY_SLOTS)) {
      assert.notEqual(hash(compileCharacter(blueprint, { accessories: [accessory] })), bare);
    }
    assert.ok(
      count(compileCharacter(blueprint, { accessories: ['bow', 'scarf', 'star'] })) >
        count(compileCharacter(blueprint)),
    );
    assert.throws(
      () => compileCharacter(blueprint, { accessories: ['bow', 'flower'] }),
      /slot already occupied/,
    );
    assert.throws(
      () => compileCharacter(blueprint, { accessories: ['scarf', 'scarf'] }),
      /slot already occupied/,
    );
    assert.throws(() => compileCharacter(blueprint, { accessories: ['not-real'] }), RangeError);
    assert.throws(
      () => compileCharacter(blueprint, { accessories: ['bow', 'scarf', 'star', 'flower'] }),
      RangeError,
    );
  });

  test(`v2 ${species}: bounded independent anatomy proportions`, () => {
    const blueprint = CHARACTER_BLUEPRINTS[species];
    const same = hash(compileCharacter(blueprint));
    assert.equal(hash(compileCharacter(blueprint, { proportions: { body: 1, head: 1 } })), same);
    for (const [channel, [lo, hi]] of Object.entries(PROPORTION_LIMITS)) {
      if (channel === 'ears' && species === 'hedgehog') {
        assert.throws(
          () => compileCharacter(blueprint, { proportions: { ears: 1.05 } }),
          RangeError,
        );
        continue;
      }
      const mid = hi;
      assert.notEqual(hash(compileCharacter(blueprint, { proportions: { [channel]: mid } })), same);
      assert.throws(
        () => compileCharacter(blueprint, { proportions: { [channel]: lo - 0.01 } }),
        RangeError,
      );
      assert.throws(
        () => compileCharacter(blueprint, { proportions: { [channel]: hi + 0.01 } }),
        RangeError,
      );
    }
    assert.throws(
      () => compileCharacter(blueprint, { proportions: { head: Number.NaN } }),
      RangeError,
    );
    assert.throws(() => compileCharacter(blueprint, { proportions: { unknown: 1 } }), RangeError);
  });
}

test('v1 compatibility: authored parts still have stable painter order', () => {
  const parts = [
    { id: 'head', role: 'head', order: 5, geometry: circle(10, 10, 5) },
    { id: 'body', role: 'body', order: 0, geometry: circle(5, 5, 3) },
    { id: 'left-eye', role: 'face', order: 5, geometry: circle(6, 6, 1), opacity: 0.5 },
  ];
  const blueprint = {
    schemaVersion: 1,
    species: 'rabbit',
    displayName: 'Test',
    base: { kind: 'parts', parts },
  };
  const original = JSON.stringify(blueprint);
  const result = compileCharacter(blueprint);
  assert.deepEqual(result, compileCharacter(blueprint));
  assert.deepEqual(
    result.children.map((node) =>
      node.kind === 'group' ? node.children[0].props.r : node.props.r,
    ),
    [3, 5, 1],
  );
  assert.equal(result.children[2].props.opacity, 0.5);
  assert.equal(JSON.stringify(blueprint), original);
});

test('v1 compatibility: manually authored variant retained, no unsupported fallbacks', () => {
  const blueprint = {
    schemaVersion: 1,
    species: 'fox',
    displayName: 'Old Fox',
    base: { kind: 'legacy', geometry: circle(0, 0, 10) },
    variants: [
      {
        pose: 'sleeping',
        expression: 'sleepy',
        composition: { kind: 'legacy', geometry: circle(0, 0, 8) },
      },
    ],
  };
  assert.equal(compileCharacter(blueprint).props.r, 10);
  assert.equal(compileCharacter(blueprint, { pose: 'sleeping', expression: 'sleepy' }).props.r, 8);
  assert.throws(() => compileCharacter(blueprint, { pose: 'standing' }), RangeError);
  assert.throws(() => compileCharacter(blueprint, { accessories: ['bow'] }), RangeError);
});

test('v1 invalid part definitions and unsupported schema are rejected', () => {
  const p = { id: 'x', role: 'head', order: 0, geometry: circle(0, 0, 1) };
  const withParts = (...parts) => ({
    schemaVersion: 1,
    species: 'bear',
    displayName: 'B',
    base: { kind: 'parts', parts },
  });
  assert.throws(() => compileCharacter(withParts(p, p)), RangeError);
  assert.throws(() => compileCharacter(withParts({ ...p, role: 'alligator' })), RangeError);
  assert.throws(() => compileCharacter(withParts({ ...p, order: Infinity })), RangeError);
  assert.throws(() => compileCharacter(withParts({ ...p, opacity: 1.5 })), RangeError);
  assert.throws(() => compileCharacter({ ...withParts(p), schemaVersion: 99 }), RangeError);
});

test('scene integration accepts character pose/expression/accessory without affecting scene document contract', () => {
  const original = composeScene({ scene: 'home' });
  const changed = composeScene({
    scene: 'home',
    pose: 'standing',
    expression: 'curious',
    accessories: ['star'],
  });
  assert.equal(changed.schemaVersion, 1);
  assert.deepEqual(original.layers.slice(0, -1), changed.layers.slice(0, -1));
  assert.equal(original.layers.at(-1).id, 'character');
  assert.notDeepEqual(original.layers.at(-1), changed.layers.at(-1));
});

test('v2 custom blueprints require stable anatomy semantics and finite rig landmarks', () => {
  const source = CHARACTER_BLUEPRINTS.rabbit;
  const missingEye = {
    ...source,
    base: { kind: 'parts', parts: source.base.parts.filter((part) => part.id !== 'eye-left') },
  };
  assert.throws(() => compileCharacter(missingEye), /missing anatomical eye-left/);
  const brokenRig = { ...source, rig: { ...source.rig, leftEye: { x: Infinity, y: 0 } } };
  assert.throws(() => compileCharacter(brokenRig), /rig landmark/);
  const duplicates = {
    ...source,
    base: { kind: 'parts', parts: [...source.base.parts, source.base.parts[0]] },
  };
  assert.throws(() => compileCharacter(duplicates), /Duplicate/);
  const excessParts = {
    ...source,
    base: {
      kind: 'parts',
      parts: Array.from({ length: 97 }, (_, index) => ({
        id: `part-${index}`,
        role: 'head',
        order: index,
        geometry: circle(0, 0, 1),
      })),
    },
  };
  assert.throws(() => compileCharacter(excessParts), /part count/);
});

test('common compiled variants reuse bounded immutable geometry references', () => {
  const bunny = CHARACTER_BLUEPRINTS.rabbit;
  const a = compileCharacter(bunny, {
    pose: 'standing',
    expression: 'happy',
    accessories: ['star'],
  });
  const b = compileCharacter(bunny, {
    pose: 'standing',
    expression: 'happy',
    accessories: ['star'],
  });
  assert.strictEqual(a, b);
  assert.equal(hash(a), hash(b));
});
