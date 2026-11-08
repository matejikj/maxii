'use strict';

/**
 * Writes a minimal CycloneDX-inspired SBOM from the root package-lock without
 * uploading it. The artifact is for review/release evidence, not a secret store.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const outDir = path.join(root, 'reports');
fs.mkdirSync(outDir, { recursive: true });

const components = Object.entries(lock.packages || {})
  .filter(([key, value]) => key.startsWith('node_modules/') && value.version)
  .map(([key, value]) => ({
    type: 'library',
    name: key.replace(/^node_modules\//, ''),
    version: value.version,
    ...(value.license ? { licenses: [{ license: { id: String(value.license) } }] } : {}),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: { type: 'application', name: 'maxii', version: lock.version || '0.0.0' },
  },
  components,
};

const outFile = path.join(outDir, 'sbom.json');
fs.writeFileSync(outFile, `${JSON.stringify(sbom, null, 2)}\n`);
console.log(`Wrote ${outFile} (${components.length} components).`);
