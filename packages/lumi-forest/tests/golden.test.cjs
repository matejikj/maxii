/** Intentional artwork/layout changes require updating these visual contract hashes. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { createLumiSvg } = require('../.test-dist/core/index.js');

const expected = {
  home: '4c2367d65772c20968dcec69c2354ad477f376551dd2391ae80406c01e167821',
  growth: '55a73b186a7f0a56df7f32c37c4713a974924fa10caa5d355f384b12a4a5d502',
  sleep: '2cd8d3f132b7c891a8f03d73225d86a5c1ec60e9901366e0587110035a885ac3',
  feeding: '0098bbbebcd61c9bc3ce702f834d70f77fbab92b0ae5995774d2cf5f098043cd',
  milestones: 'af1866e872206dcd01b026d32e0eb8ce0ae3c452a42fdd7cea141eddf7a11416',
};
for (const [scene, hash] of Object.entries(expected)) {
  test(`golden: ${scene}`, () => {
    const exported = createLumiSvg({ scene, density: 'regular', seed: 'lumi-export-v1' });
    assert.equal(createHash('sha256').update(exported).digest('hex'), hash);
  });
}
