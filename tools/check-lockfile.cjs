'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const lockPath = path.join(root, 'package-lock.json');

function main() {
  assert.ok(fs.existsSync(lockPath), 'package-lock.json must exist at the repo root');
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  assert.equal(lock.lockfileVersion, 3, 'expected npm lockfileVersion 3');
  assert.equal(lock.name, 'maxii');
  for (const name of ['apps/baby-tracker', 'apps/lumi-showcase', 'packages/lumi-forest']) {
    const nested = path.join(root, name, 'package-lock.json');
    assert.equal(fs.existsSync(nested), false, `${name} must not ship a nested lockfile`);
  }
  console.log('Lockfile check OK.');
}

main();
