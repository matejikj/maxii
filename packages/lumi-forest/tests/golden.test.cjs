/** Intentional artwork/layout changes require updating these visual contract hashes. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { createLumiSvg } = require('../.test-dist/core/index.js');

const expected = {
  home: '103673692b6810261a84fa19b01fa14305ca54aa2dabbcb0f42359003ae263df',
  growth: 'a9ef2bddf0bbf8b0d61e37848f68cfe8ecc75cc2074afc6f7d11547a810f2fec',
  sleep: 'cfe79cd47bbf755a3a9d6c051f035e0a361d41f07dedb0816a699dc423dfe8a9',
  feeding: 'bd47ffe85a198693fcf2e1eb503ce048cdf88de324f9cb86750ec7dd7fc8b6cd',
  milestones: 'b189720578308cbccbdae30dab2c1b32ad740e508e278d634ee63e26518ffa16',
};
for (const [scene, hash] of Object.entries(expected)) {
  test(`golden: ${scene}`, () => {
    const exported = createLumiSvg({ scene, density: 'regular', seed: 'lumi-export-v1' });
    assert.equal(createHash('sha256').update(exported).digest('hex'), hash);
  });
}
