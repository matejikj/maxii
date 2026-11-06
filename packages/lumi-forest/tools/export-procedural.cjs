/** Exports canonical procedural SVG using the same pure compiler as React Native. */
const fs = require('node:fs');
const path = require('node:path');
const {
  LUMI_SCENES, LUMI_VIEWPORT_FIXTURES, planProceduralScene, serializeScene, countVectorNodes,
} = require('../.test-dist/core/index.js');

const target = path.resolve(__dirname, '../exports/procedural');
fs.mkdirSync(target, { recursive: true });
const report = [];
for (const scene of LUMI_SCENES) {
  for (const [name, viewport] of Object.entries(LUMI_VIEWPORT_FIXTURES)) {
    // The canonical fixture includes 2 UI exclusions and a pre-set character anchor area.
    // Coordinates are dp, local to the SVG background surface.
    const safeZones = [
      { id: 'page-header', x: 14, y: 16, width: Math.min(242, viewport.width - 28), height: Math.min(78, viewport.height * .2), padding: 8 },
      { id: 'dashboard-card', x: 14, y: Math.min(126, viewport.height * .26),
        width: Math.min(248, viewport.width - 28), height: Math.min(150, viewport.height * .36), padding: 10 },
    ];
    const planned = planProceduralScene({ scene, viewport, seed: 'visual-regression-v1', density: 'regular', safeZones });
    const file = `${scene}__${name}.svg`;
    fs.writeFileSync(path.join(target, file), serializeScene(planned.document));
    report.push({ scene, name, viewport, items: planned.items.length, nodes: countVectorNodes(planned.document),
      omitted: planned.omitted, safeZones: planned.excluded });
  }
}
fs.writeFileSync(path.join(target, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Exported ${report.length} reproducible procedural SVG scenes`);
