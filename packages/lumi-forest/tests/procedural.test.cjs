const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  LUMI_SCENES, LUMI_VIEWPORT_FIXTURES, planProceduralScene, composeProceduralScene,
  intersect, contains, normalizeSafeZones, OccupancyGrid, serializeScene, countVectorNodes,
  LUMI_PERFORMANCE_BUDGETS,
} = require('../.test-dist/core/index.js');

const viewports = Object.values(LUMI_VIEWPORT_FIXTURES);
const margins = [
  { id: 'title', x: 12, y: 12, width: 130, height: 65, padding: 10 },
  { id: 'card', x: 12, y: 95, width: 160, height: 145, padding: 10 },
];
const FRAME = (v) => ({ x: 0, y: 0, width: v.width, height: v.height });

for (const scene of LUMI_SCENES) {
  test(`${scene}: deterministic and valid for six form factors and all densities`, () => {
    for (const viewport of viewports) {
      for (const density of ['quiet', 'regular', 'playful']) {
        const request = { viewport, scene, density, seed: 'reproducible', safeZones: margins };
        const first = planProceduralScene(request);
        const again = planProceduralScene(request);
        assert.deepEqual(first, again);
        assert.deepEqual(composeProceduralScene(request), first.document);
        assert.equal(first.document.width, viewport.width);
        assert.equal(first.document.height, viewport.height);
        assert.match(serializeScene(first.document), /<svg/);
        for (const [i, item] of first.items.entries()) {
          assert.ok(contains(FRAME(viewport), item.bounds), `${scene} ${density} ${i} outside viewport`);
          assert.ok(item.bounds.width > 0 && item.bounds.height > 0);
          for (const excluded of first.excluded) assert.ok(!intersect(item.bounds, excluded), `${item.id} intersects UI`);
          for (const previous of first.items.slice(0, i)) {
            assert.ok(!intersect(item.bounds, previous.bounds), `${item.id} intersects ${previous.id}`);
          }
        }
        assert.ok(first.items.length <= LUMI_PERFORMANCE_BUDGETS.maxProceduralPlacedItems, 'bounded number of items');
        assert.ok(countVectorNodes(first.document) <= LUMI_PERFORMANCE_BUDGETS.maxProceduralVectorNodes, 'bounded vector node budget');
      }
    }
  });
}

test('different seeds make distinctive, stable decoration placements', () => {
  const shared = { viewport: { width: 1024, height: 768 }, scene: 'growth', density: 'regular' };
  const a = planProceduralScene({ ...shared, seed: 'alpha' });
  const b = planProceduralScene({ ...shared, seed: 'beta' });
  assert.notDeepEqual(a.items.map(i => i.bounds), b.items.map(i => i.bounds));
  assert.deepEqual(a, planProceduralScene({ ...shared, seed: 'alpha' }));
});

test('overlapping mandatory UI zones are all enforced (even if overlapping each other)', () => {
  const viewport = { width: 390, height: 844 };
  const overlapping = [
    { id: 'left', x: 0, y: 0, width: 270, height: 844, padding: 0 },
    { id: 'right', x: 140, y: 0, width: 250, height: 844, padding: 0 },
  ];
  const plan = planProceduralScene({ scene: 'home', viewport, safeZones: overlapping });
  assert.equal(plan.items.length, 0, 'character and motifs must be omitted');
  assert.equal(plan.omitted.character, true);
  assert.equal(plan.excluded.length, 2);
});

test('fully occupied content region produces only background terrain', () => {
  const viewport = { width: 768, height: 1024 };
  const result = planProceduralScene({ scene: 'sleep', viewport,
    safeZones: [{ id: 'full', x: 0, y: 0, width: 768, height: 1024, padding: 0 }],
  });
  assert.equal(result.items.length, 0);
  assert.equal(result.omitted.character, true);
  assert.equal(result.document.layers.filter(x => x.id === 'landscape').length, 1);
});

test('safe zones clipped correctly when partially outside viewport', () => {
  assert.deepEqual(normalizeSafeZones([
    { id: 'clipped', x: -30, y: 500, width: 100, height: 150, padding: 10 },
    { id: 'completely-away', x: 1000, y: 1000, width: 30, height: 40 },
  ], { width: 390, height: 568 }), [{ x: 0, y: 490, width: 80, height: 78 }]);
});

test('scene generation rejects invalid/hostile inputs without unbounded loops', () => {
  const viewport = { width: 390, height: 844 };
  const req = { viewport, scene: 'home' };
  assert.throws(() => planProceduralScene({ ...req, viewport: { width: Infinity, height: 840 } }), RangeError);
  assert.throws(() => planProceduralScene({ ...req, viewport: { width: 100, height: 840 } }), RangeError);
  assert.throws(() => planProceduralScene({ ...req, seed: 'a'.repeat(257) }), RangeError);
  assert.throws(() => planProceduralScene({ ...req, density: 'extreme' }), RangeError);
  assert.throws(() => planProceduralScene({ ...req, safeZones: Array.from({ length: 33 }, (_, i) => ({ id: `${i}`, x: 1, y: 1, width: 10, height: 10 })) }), RangeError);
  assert.throws(() => planProceduralScene({ ...req, safeZones: [{ id: 'bad', x: NaN, y: 0, width: 10, height: 20 }] }), RangeError);
  assert.throws(() => planProceduralScene({ ...req, safeZones: [{ id: 'bad', x: 1, y: 1, width: -10, height: 20 }] }), RangeError);
  assert.throws(() => new OccupancyGrid(viewport, 0), RangeError);
});

test('occupancy grid blocks overlapping zones and prevents collisions', () => {
  const viewport = { width: 390, height: 844 };
  const grid = new OccupancyGrid(viewport);
  grid.block({ x: 20, y: 20, width: 140, height: 100 });
  grid.block({ x: 80, y: 80, width: 140, height: 100 });
  assert.equal(grid.canPlace({ x: 170, y: 30, width: 30, height: 20 }), true);
  assert.equal(grid.canPlace({ x: 180, y: 130, width: 30, height: 30 }), false);
  assert.equal(grid.reserve({ x: 150, y: 170, width: 40, height: 30 }), false);
  assert.equal(grid.reserve({ x: 230, y: 230, width: 40, height: 30 }), true);
  assert.equal(grid.reserve({ x: 240, y: 240, width: 40, height: 30 }), false);
});
