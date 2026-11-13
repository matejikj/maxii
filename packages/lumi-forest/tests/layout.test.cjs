const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  LUMI_VIEWPORT_FIXTURES,
  resolveAspectMode,
  computeViewportLayout,
  composeScene,
  LUMI_SCENES,
} = require('../.test-dist/core/index.js');
const canvas = { width: 390, height: 844 };

for (const [name, size] of Object.entries(LUMI_VIEWPORT_FIXTURES)) {
  test(`viewport ${name}: finite stable bounds and expected mode`, () => {
    const resolved = resolveAspectMode(size);
    assert.equal(resolved, size.width / size.height > 0.62 ? 'contain' : 'cover');
    const layout = computeViewportLayout(canvas, size);
    assert.deepEqual(layout, computeViewportLayout(canvas, size));
    assert.ok(
      layout.scale > 0 && Number.isFinite(layout.offsetX) && Number.isFinite(layout.offsetY),
    );
    assert.ok(layout.visible.x >= 0 && layout.visible.y >= 0);
    assert.ok(layout.visible.width > 0 && layout.visible.height > 0);
    assert.ok(layout.visible.width <= 390 && layout.visible.height <= 844);
    // Character anchor stays visible; xMidYMax prevents it being clipped off-screen.
    assert.ok(layout.visible.x <= 288 && layout.visible.x + layout.visible.width >= 288);
    assert.ok(layout.visible.y <= 704 && layout.visible.y + layout.visible.height >= 704);
    for (const scene of LUMI_SCENES) {
      const doc = composeScene({ scene });
      assert.equal(doc.width, canvas.width);
      assert.equal(doc.height, canvas.height);
    }
  });
}

test('viewport invalid dimensions and explicit modes', () => {
  assert.throws(() => resolveAspectMode({ width: 0, height: 100 }), RangeError);
  assert.throws(
    () => computeViewportLayout({ width: 0, height: 844 }, { width: 390, height: 844 }),
    RangeError,
  );
  assert.throws(() => resolveAspectMode({ width: NaN, height: 844 }), RangeError);
  assert.equal(resolveAspectMode({ width: 1024, height: 768 }, 'cover'), 'cover');
  assert.equal(resolveAspectMode({ width: 320, height: 568 }, 'contain'), 'contain');
});
