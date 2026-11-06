/** Non-native JS microbenchmark. Report results; never use as a CI performance gate. */
const { performance } = require('node:perf_hooks');
const { composeScene, serializeScene } = require('../.test-dist/core/index.js');
const n = 5000;
const args = { scene: 'growth', seed: 'sample', density: 'regular' };
for (let i = 0; i < 400; i++) composeScene(args);
const t0 = performance.now();
for (let i = 0; i < n; i++) composeScene({ ...args, seed: String(i) });
const t1 = performance.now();
const doc = composeScene(args);
for (let i = 0; i < n; i++) serializeScene(doc);
const t2 = performance.now();
const f = (a,b) => ((b-a)/n).toFixed(4);
console.log(`compile: ${f(t0,t1)} ms/scene; serialize: ${f(t1,t2)} ms/scene (Node, not native FPS)`);
