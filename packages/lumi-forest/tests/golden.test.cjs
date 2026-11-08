/** Intentional artwork/layout changes require updating these visual contract hashes. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { createLumiSvg } = require('../.test-dist/core/index.js');

const expected = {
  home: '103673692b6810261a84fa19b01fa14305ca54aa2dabbcb0f42359003ae263df',
  growth: 'b23ae9518f03d0e4a21e6b651d42e100fa64e72a5988f9fdea09859d2824cfff',
  sleep: 'fa2ca6b9ab465943785d8b3983b48ebcb222aa3697eef78a4df363afad2598c2',
  feeding: '2a295a6ca74a7aaa68779969c9257acfe795f255f0fb9ecbd0593e2da50eec9a',
  milestones: 'c006f8f662a3ffe2df8b96bf0c68ab69e5f43aaa867d755783f5b92cb64b8bbe',
};
for (const [scene, hash] of Object.entries(expected)) {
  test(`golden: ${scene}`, () => {
    const exported = createLumiSvg({ scene, density: 'regular', seed: 'lumi-export-v1' });
    assert.equal(createHash('sha256').update(exported).digest('hex'), hash);
  });
}
