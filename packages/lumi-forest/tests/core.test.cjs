const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  composeScene, createLumiSvg, planDecorations, LUMI_SCENES, LUMI_ANIMALS,
  CHARACTER_CATALOG, SCENE_CATALOG, seededRandom, escapeSvgAttribute,
} = require('../.test-dist/core/index.js');

const render = (opts) => createLumiSvg(opts);
const flatten = (node) => node.kind === 'group' ? [node, ...node.children.flatMap(flatten)] : [node];

for (const scene of LUMI_SCENES) {
  test(`${scene}: valid deterministic document and SVG`, () => {
    const args = { scene, seed: 'test-seed', density: 'regular' };
    const first = composeScene(args);
    assert.deepEqual(first, composeScene(args));
    assert.equal(first.schemaVersion, 1);
    assert.equal(first.width, 390);
    assert.equal(first.height, 844);
    assert.deepEqual(first.layers.map(l => l.id), ['canvas','landscape','microdetails','plants','sky','character']);
    assert.equal(first.layers.find(l => l.id === 'microdetails').nodes.length, 13);
    const svg = render(args);
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
    assert.ok(svg.endsWith('</svg>'));
    assert.equal(svg, render(args));
    assert.ok(svg.includes(SCENE_CATALOG[scene].palette.bg));
    const charNodes = first.layers.find(l => l.id === 'character').nodes.flatMap(flatten);
    assert.ok(charNodes.length > 15, 'character should contain its complete legacy artwork');
  });
}

test('every character retains declarative geometry', () => {
  assert.equal(Object.keys(CHARACTER_CATALOG).length, 5);
  for (const animal of LUMI_ANIMALS) {
    const c = CHARACTER_CATALOG[animal];
    assert.ok(c.name.length > 0);
    assert.ok(flatten(c.anatomy).length >= 16);
    const xml = render({ scene: 'home', animal });
    assert.ok(xml.includes('translate(288 704) scale(.83)'));
  }
});

test('decorations: count, reserved space and stable ordering', () => {
  const counts = { quiet: 5, regular: 13, playful: 21 };
  for (const [density, count] of Object.entries(counts)) {
    const slots = planDecorations('sleep', 'my-seed', density);
    assert.equal(slots.length, count);
    assert.ok(slots.every(p => p.y >= 618 && p.y <= 816));
    assert.ok(slots.every(p => !(p.x > 166 && p.y > 626)));
    assert.equal(new Set(slots.map(p => `${p.x}/${p.y}`)).size, slots.length);
    assert.deepEqual(slots, planDecorations('sleep', 'my-seed', density));
  }
  assert.notDeepEqual(planDecorations('sleep', 'a', 'regular'), planDecorations('sleep', 'b', 'regular'));
});

test('seed is not leaked in output and XML attributes are escaped', () => {
  const privateSeed = 'not-for-export-&<"user-name';
  const svg = render({ scene: 'home', seed: privateSeed });
  assert.equal(svg.includes(privateSeed), false);
  assert.equal(escapeSvgAttribute('a"&<\'>'), 'a&quot;&amp;&lt;&apos;&gt;');
});

test('invalid values fail loudly (not silently rendered blank)', () => {
  assert.throws(() => composeScene({ scene: 'unknown' }), RangeError);
  assert.throws(() => composeScene({ scene: 'home', animal: 'cat' }), RangeError);
  assert.throws(() => composeScene({ scene: 'home', density: 'nope' }), RangeError);
});

test('scene compilation and serialization leave catalog and artwork unchanged', () => {
  const before = JSON.stringify(CHARACTER_CATALOG);
  const palette = JSON.stringify(SCENE_CATALOG);
  for (let i = 0; i < 100; i++) render({ scene: 'home', seed: String(i) });
  assert.equal(JSON.stringify(CHARACTER_CATALOG), before);
  assert.equal(JSON.stringify(SCENE_CATALOG), palette);
});

test('random generator has reproducible output and bounded 0..1 values', () => {
  const first = seededRandom('x');
  const second = seededRandom('x');
  for (let i = 0; i < 100; i++) {
    const a = first();
    assert.equal(a, second());
    assert.ok(a >= 0 && a < 1);
  }
});
