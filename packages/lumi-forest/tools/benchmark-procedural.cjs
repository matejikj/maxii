/** Microbenchmark, NODE.JS ONLY — never claim it represents native frame time. */
const { performance } = require('node:perf_hooks');
const { planProceduralScene } = require('../.test-dist/core/index.js');
const fixtures = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
];
function percent(arr, percentile) { return arr[Math.floor((arr.length - 1) * percentile)]; }
for (const viewport of fixtures) {
  const values = [];
  for (let i = 0; i < 1000; i++) {
    const t = performance.now();
    planProceduralScene({ scene: 'home', viewport, seed: `benchmark-${i}`, density: 'playful',
      safeZones: [{id: 'header', x: 14, y: 14, width: 240, height: 90}],
    });
    if (i >= 100) values.push(performance.now() - t);
  }
  values.sort((a,b) => a-b);
  console.log(`${viewport.width}x${viewport.height}: p50 ${percent(values,.5).toFixed(3)}ms p95 ${percent(values,.95).toFixed(3)}ms p99 ${percent(values,.99).toFixed(3)}ms (Node-only)`);
}
