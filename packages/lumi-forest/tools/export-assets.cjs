/** Export the same scene document consumed by React Native. No duplicated art. */
const fs = require('node:fs');
const path = require('node:path');
const { createLumiSvg, LUMI_SCENES } = require('../.test-dist/core/index.js');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'exports');
fs.mkdirSync(dir, { recursive: true });
for (const scene of LUMI_SCENES) {
  fs.writeFileSync(
    path.join(dir, `${scene}.svg`),
    createLumiSvg({ scene, seed: 'lumi-export-v1', density: 'regular' }),
  );
}
console.log(`Exported ${LUMI_SCENES.length} SVG scenes to ${dir}`);
