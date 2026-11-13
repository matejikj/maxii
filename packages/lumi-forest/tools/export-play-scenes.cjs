/** Offline visual review uses the very same anatomy and deterministic motion sampler as native. */
const fs = require('node:fs');
const path = require('node:path');
const { LUMI_PLAY_ACTIONS, LUMI_BABY_VARIANTS, compileBaby, compilePlayScene, compileCharacter,
  CHARACTER_BLUEPRINTS, serializeVectorNode } = require('../.test-dist/core/index.js');
const output = path.resolve(__dirname, '../exports/play');
fs.mkdirSync(output, { recursive: true });
const svg = (node, box = '0 48 400 190') => `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="380" viewBox="${box}">${serializeVectorNode(node)}</svg>`;
for (const action of LUMI_PLAY_ACTIONS) for (const frame of [0, .15, .33, .5, .66, .83, 1]) {
  fs.writeFileSync(path.join(output, `${action}__${frame}.svg`), svg(compilePlayScene({ action, babyVariant: 'girl', guideSpecies: 'tiger', babyPose: action === 'tummy' ? 'tummy' : 'sitting' }, frame)));
}
for (const variant of LUMI_BABY_VARIANTS) for (const pose of ['reclined', 'tummy', 'sitting', 'standing']) {
  fs.writeFileSync(path.join(output, `baby-${variant}__${pose}.svg`), svg(compileBaby(variant, pose), '-135 -130 270 300'));
}
for (const species of ['tiger', 'hippo']) for (const expression of ['neutral', 'happy', 'curious', 'sleepy']) {
  fs.writeFileSync(path.join(output, `${species}__${expression}.svg`), svg(compileCharacter(CHARACTER_BLUEPRINTS[species], { expression }), '-176 -178 352 360'));
}
console.log(`Exported ${LUMI_PLAY_ACTIONS.length} motion recipes, 12 baby poses and both new guides to ${output}`);
