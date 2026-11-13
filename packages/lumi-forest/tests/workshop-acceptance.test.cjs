const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  runWorkshopAcceptanceMatrix,
  describeWorkshopDeviceMeasurementPlan,
  workshopAppearanceLabel,
  workshopGuidePreviewHint,
  WORKSHOP_PORTRAIT_SIZES_PX,
  WORKSHOP_DEVICE_MEASUREMENT_SCENARIOS,
  LUMI_PERFORMANCE_BUDGETS,
  measureStudioSceneComplexity,
  COLLECTION_SCALE_FIXTURES,
} = require('../.test-dist/core/index.js');

test('workshop acceptance matrix passes offline without claiming device metrics', () => {
  const report = runWorkshopAcceptanceMatrix();
  assert.equal(
    report.ok,
    true,
    report.cases.map((row) => `${row.name}:${row.detail}`).join('; '),
  );
  assert.equal(report.physicalDeviceMeasured, false);
  assert.equal(report.compiledStyleSemanticCells, 10 * 3 * 8);
  assert.equal(report.compiledStudioActions, 8);
  assert.deepEqual([...WORKSHOP_PORTRAIT_SIZES_PX], [24, 32, 48, 144, 256]);
});

test('workshop device measurement plan forbids fabricated manifests', () => {
  const plan = describeWorkshopDeviceMeasurementPlan();
  assert.equal(plan.requiresPhysicalAndroid, true);
  assert.equal(plan.requiresPhysicalIos, true);
  assert.equal(plan.forbidsFabricatedManifest, true);
  assert.deepEqual([...plan.scenarios], [...WORKSHOP_DEVICE_MEASUREMENT_SCENARIOS]);
});

test('workshop complexity stays inside published performance budgets', () => {
  const report = measureStudioSceneComplexity(
    LUMI_PERFORMANCE_BUDGETS.maxWorkshopActionVectorNodes,
    LUMI_PERFORMANCE_BUDGETS.maxWorkshopVisibleProps,
  );
  assert.equal(report.withinWorkshopNodeBudget, true);
  assert.equal(report.withinPropBudget, true);
});

test('collection scale fixtures cover chip through 256 hero sizes', () => {
  assert.equal(COLLECTION_SCALE_FIXTURES.chip24.width, 24);
  assert.equal(COLLECTION_SCALE_FIXTURES.chip32.width, 32);
  assert.equal(COLLECTION_SCALE_FIXTURES.compact.width, 48);
  assert.equal(COLLECTION_SCALE_FIXTURES.hero144.width, 144);
  assert.equal(COLLECTION_SCALE_FIXTURES.hero256.width, 256);
  assert.equal(workshopAppearanceLabel('workshop'), 'Dílna');
  assert.match(workshopGuidePreviewHint('rabbit', 'restrained'), /Lumi/);
  assert.match(workshopGuidePreviewHint('rabbit', 'restrained'), /Střídmý/);
  assert.match(workshopGuidePreviewHint('rabbit', 'restrained'), /Dekorace/);
});
