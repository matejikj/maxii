#!/usr/bin/env node
/** Fail-closed acceptance gate for independently gathered PHYSICAL-device measurements.
 * The manifest is a record of provenance, NOT a substitute for captured device traces.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { LUMI_PERFORMANCE_BUDGETS: B } = require('../../.test-dist/core/index.js');
const requiredScenarios = [
  'scene-scroll',
  'motion-idle',
  'milestone-celebration',
  'scene-transition',
];
const isFinitePositive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
function verify(evidence, dir) {
  assert.equal(evidence.schemaVersion, 1, 'Unsupported device evidence schema');
  assert.equal(evidence.release, '1.0.0', 'Evidence belongs to another release');
  assert.match(evidence.gitCommit, /^[0-9a-f]{40}$/, 'Must record immutable git commit');
  assert.ok(Array.isArray(evidence.devices), 'devices missing');
  const platforms = new Set();
  for (const d of evidence.devices) {
    assert.ok(['android', 'ios'].includes(d.platform), 'Unsupported platform');
    assert.ok(d.physical === true, 'Emulator/simulator cannot approve native performance');
    assert.equal(d.buildType, 'release', 'Dev builds cannot approve performance');
    assert.ok(typeof d.model === 'string' && d.model.length >= 2, 'Device model missing');
    assert.ok(typeof d.osVersion === 'string' && d.osVersion.length >= 2, 'OS version missing');
    assert.ok(
      isFinitePositive(d.refreshHz) && d.refreshHz >= 50 && d.refreshHz <= 144,
      'Invalid refresh rate',
    );
    assert.ok(Array.isArray(d.scenarios), 'Scenario data missing');
    for (const scenario of requiredScenarios) {
      const result = d.scenarios.find((item) => item.name === scenario);
      assert.ok(result, `${d.model}: missing scenario ${scenario}`);
      assert.ok(Number.isInteger(result.frames) && result.frames >= 300, 'Insufficient frames');
      assert.ok(isFinitePositive(result.p95FrameLatencyMs), 'Missing p95 frame latency');
      assert.ok(
        Number.isFinite(result.overBudgetPercent) && result.overBudgetPercent >= 0,
        'Missing missed-frame percentage',
      );
      // 60Hz cap scaled by actual refresh; validated only if tracing semantics match the collector.
      const frameBudget = 1000 / d.refreshHz;
      assert.ok(
        result.p95FrameLatencyMs <= Math.max(frameBudget * 1.5, 11),
        `${d.model}/${scenario}: p95 too high`,
      );
      assert.ok(
        result.overBudgetPercent <= B.goalNativeJankyFramesPercent,
        `${d.model}/${scenario}: jank over budget`,
      );
      assert.ok(
        Number.isFinite(result.memoryDeltaMB) &&
          result.memoryDeltaMB >= 0 &&
          result.memoryDeltaMB <= B.goalAdditionalMemoryMegabytes,
        `${d.model}/${scenario}: memory delta over budget`,
      );
      assert.ok(
        typeof result.rawTrace === 'string' &&
          !path.isAbsolute(result.rawTrace) &&
          !result.rawTrace.includes('..'),
        'Invalid raw trace path',
      );
      const full = path.resolve(dir, result.rawTrace);
      assert.ok(
        full.startsWith(path.resolve(dir) + path.sep) && fs.statSync(full).size > 0,
        'Raw device trace missing',
      );
    }
    platforms.add(d.platform);
  }
  assert.ok(
    platforms.has('android') && platforms.has('ios'),
    'Both physical Android and iOS are required',
  );
  return {
    status: 'accepted',
    devices: evidence.devices.length,
    scenarios: evidence.devices.length * requiredScenarios.length,
  };
}
if (require.main === module) {
  try {
    const inputPath = process.argv[2];
    if (!inputPath)
      throw Error(
        'Supply device evidence manifest path (not available in this offline environment)',
      );
    const absolute = path.resolve(inputPath);
    console.log(
      JSON.stringify(
        verify(JSON.parse(fs.readFileSync(absolute, 'utf8')), path.dirname(absolute)),
        null,
        2,
      ),
    );
  } catch (e) {
    console.error(`Release blocked: ${e.message}`);
    process.exitCode = 1;
  }
}
module.exports = { verify };
