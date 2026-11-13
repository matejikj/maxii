#!/usr/bin/env node
/* Validate Bob ESM/declaration outputs before ever uploading or publishing an npm tarball. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const packageRoot = path.resolve(__dirname, '..');
const required = [
  'lib/module/index.js',
  'lib/module/core/index.js',
  'lib/module/react-native/index.js',
  'lib/typescript/src/index.d.ts',
  'lib/typescript/src/core/index.d.ts',
  'lib/typescript/src/react-native/index.d.ts',
];
function verify(root = packageRoot) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.ok(pkg.version.match(/^\d+\.\d+\.\d+$/), 'Invalid release semver');
  assert.ok(pkg.private !== true, 'Root package private=true cannot be published');
  for (const rel of required) {
    const file = path.join(root, rel);
    assert.ok(
      fs.existsSync(file),
      `Bob build output missing: ${rel}; run npm run build after installing dependencies`,
    );
    assert.ok(fs.statSync(file).size > 20, `Generated file empty: ${rel}`);
  }
  const paths = [
    pkg.main,
    pkg.types,
    ...Object.values(pkg.exports)
      .filter((v) => v && typeof v === 'object')
      .flatMap((v) => [v.types, v.default].filter(Boolean)),
  ];
  for (const p of paths) {
    assert.ok(fs.existsSync(path.join(root, p)), `Public entrypoint missing: ${p}`);
  }
  return { status: 'ready-for-pack', files: required.length };
}
if (require.main === module) {
  try {
    console.log(JSON.stringify(verify(), null, 2));
  } catch (error) {
    console.error(`Cannot package: ${error.message}`);
    process.exitCode = 1;
  }
}
module.exports = { verify };
