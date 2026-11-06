/** Node.js character IR microbenchmark; NOT React Native frame measurements. */
const { performance } = require('node:perf_hooks');
const { CHARACTER_BLUEPRINTS, LUMI_ANIMALS, compileCharacter } = require('../.test-dist/core/index.js');
const species = LUMI_ANIMALS;
const iterations = 5000;
function measure(factory) {
  for (let i = 0; i < 300; i++) factory(i);
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) factory(i);
  return ((performance.now() - t0) / iterations).toFixed(5);
}
const cached = measure(i => compileCharacter(CHARACTER_BLUEPRINTS[species[i % 5]], {
  pose: i % 2 ? 'standing' : 'sitting', expression: i % 3 ? 'curious' : 'happy',
}));
const proportioned = measure(i => compileCharacter(CHARACTER_BLUEPRINTS[species[i % 5]], {
  pose: i % 2 ? 'standing' : 'sitting', expression: 'happy',
  proportions: { head: 1.02 + (i % 50) / 500 },
}));
console.log(`Character compile cached: ${cached} ms/call; custom proportions: ${proportioned} ms/call (Node.js only)`);
