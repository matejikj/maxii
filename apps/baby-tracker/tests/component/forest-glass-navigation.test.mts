import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { forestDockMetrics, forestGlassColors } from '../../src/app/navigation/forestGlass.ts';

const { resolveLumiTheme } = createRequire(import.meta.url)('@lumi/forest-design/core');

function rgb(hex: string): number[] {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}
function luminance(channels: number[]): number {
  const values = channels
    .map((value) => value / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722;
}
function contrast(a: number[], b: number[]): number {
  const first = luminance(a),
    second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test('dock keeps four usable touch targets inside phone, tablet and landscape safe areas', () => {
  for (const width of [320, 411, 768, 1280]) {
    for (const fontScale of [1, 1.15, 1.5, 2, 3]) {
      for (const insets of [
        { left: 0, right: 0, bottom: 0 },
        { left: 0, right: 0, bottom: 34 },
        { left: 44, right: 0, bottom: 21 },
      ]) {
        const dock = forestDockMetrics(width, fontScale, insets);
        assert.ok(dock.left >= insets.left + 12);
        assert.ok(dock.right >= insets.right + 12);
        assert.ok(dock.bottom > insets.bottom);
        assert.ok((width - dock.left - dock.right - 32) / 4 >= 48);
        assert.ok(dock.height >= 80);
      }
    }
  }
});

test('the last scrolled action clears the floating capsule and home gesture area', () => {
  for (const width of [320, 411, 844, 1280]) {
    for (const fontScale of [1, 1.5, 2, 3]) {
      const dock = forestDockMetrics(width, fontScale, { bottom: 34, left: 0, right: 0 });
      const viewportHeight = 800;
      const lastActionBottom = viewportHeight - dock.contentInset - 28;
      const dockTop = viewportHeight - dock.bottom - dock.height;
      assert.ok(lastActionBottom <= dockTop - 24);
      assert.ok(viewportHeight - dock.bottom < viewportHeight - 34);
    }
  }
});

test('large text expands the dock and tablet width stays visually contained', () => {
  const insets = { bottom: 24, left: 0, right: 0 };
  const normal = forestDockMetrics(320, 1, insets);
  const large = forestDockMetrics(320, 2, insets);
  assert.ok(large.height >= normal.height + 24);
  const tablet = forestDockMetrics(1280, 1, insets);
  assert.ok(1280 - tablet.left - tablet.right <= 600);
  assert.equal(tablet.left, tablet.right);
});

test('active and inactive tab labels remain readable in all six motif palettes', () => {
  for (const motif of ['forest', 'garden', 'playground'] as const) {
    for (const mode of ['light', 'dark'] as const) {
      const { colors } = resolveLumiTheme('home', mode, motif);
      const material = forestGlassColors(colors, mode, motif);
      assert.ok(
        contrast(rgb(material.activeInk), rgb(material.active)) >= 4.5,
        `${motif}/${mode}: active`,
      );
      assert.ok(
        contrast(rgb(material.accent), rgb(material.active)) >= 3,
        `${motif}/${mode}: icon details`,
      );
      assert.ok(
        contrast(rgb(material.inactiveInk), rgb(material.opaque)) >= 4.5,
        `${motif}/${mode}: reduced transparency`,
      );
      // Conservative extremes: no credit for the native blur's own tint or sheen.
      const match = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(material.wash)!;
      const alpha = Number(match[4]);
      for (const behind of [0, 255]) {
        const background = [match[1], match[2], match[3]].map(
          (channel) => Number(channel) * alpha + behind * (1 - alpha),
        );
        assert.ok(
          contrast(rgb(material.inactiveInk), background) >= 4.5,
          `${motif}/${mode}: behind ${behind}`,
        );
      }
    }
  }
});
