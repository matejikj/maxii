const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { verify } = require('../tools/device/verify-release-evidence.cjs');
const fixtures = ['scene-scroll', 'motion-idle', 'milestone-celebration', 'scene-transition'];
test('release gate rejects absent hardware evidence', () => {
  assert.throws(() =>
    verify(
      { schemaVersion: 1, release: '1.0.0', gitCommit: 'a'.repeat(40), devices: [] },
      os.tmpdir(),
    ),
  );
});
test('release gate checks physical status, raw trace, budgets, and both platforms (synthetic data)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumi-gate-'));
  try {
    fs.writeFileSync(path.join(dir, 'trace.txt'), 'synthetic trace; NOT real device evidence');
    const scenarios = fixtures.map((name) => ({
      name,
      frames: 700,
      p95FrameLatencyMs: 15,
      overBudgetPercent: 1,
      memoryDeltaMB: 4,
      rawTrace: 'trace.txt',
    }));
    const evidence = {
      schemaVersion: 1,
      release: '1.0.0',
      gitCommit: 'a'.repeat(40),
      devices: ['android', 'ios'].map((platform) => ({
        platform,
        physical: true,
        buildType: 'release',
        model: 'Test Device',
        osVersion: 'TestOS',
        refreshHz: 60,
        scenarios,
      })),
    };
    assert.equal(verify(evidence, dir).status, 'accepted');
    assert.throws(() => verify({ ...evidence, devices: evidence.devices.slice(0, 1) }, dir));
    assert.throws(() =>
      verify(
        {
          ...evidence,
          devices: [{ ...evidence.devices[0], physical: false }, evidence.devices[1]],
        },
        dir,
      ),
    );
    const bad = [
      {
        ...evidence.devices[0],
        scenarios: [{ ...scenarios[0], p95FrameLatencyMs: 100 }, ...scenarios.slice(1)],
      },
      evidence.devices[1],
    ];
    assert.throws(() => verify({ ...evidence, devices: bad }, dir));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
