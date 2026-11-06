const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  LUMI_SCENES, LUMI_DENSITIES, composeScene, countVectorNodes,
  LUMI_PERFORMANCE_BUDGETS,
} = require('../.test-dist/core/index.js');
for (const scene of LUMI_SCENES) {
  for (const density of LUMI_DENSITIES) {
    test(`IR node budget: ${scene}/${density}`, () => {
      const doc = composeScene({ scene, density, seed: 'budget' });
      assert.ok(countVectorNodes(doc) <= LUMI_PERFORMANCE_BUDGETS.maxVectorNodesPerScene,
        `${scene}/${density} exceeded visual complexity guardrail`);
      assert.ok(doc.layers.find(l => l.id === 'microdetails').nodes.length <= LUMI_PERFORMANCE_BUDGETS.maxDecorations);
    });
  }
}
