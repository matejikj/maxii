/** Canonical standalone character exports from the SAME core IR as Expo. */
const fs = require('node:fs');
const path = require('node:path');
const { CHARACTER_BLUEPRINTS, LUMI_ANIMALS, compileCharacter, serializeVectorNode } =
  require('../.test-dist/core/index.js');
const output = path.resolve(__dirname, '../exports/characters');
fs.mkdirSync(output, { recursive: true });
const POSES = ['sitting', 'standing'];
const EXPRESSIONS = ['neutral', 'happy', 'curious', 'sleepy'];
const svg = geometry =>
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="330" viewBox="-176 -178 352 360" preserveAspectRatio="xMidYMid meet">' +
  serializeVectorNode(geometry) + '</svg>';
for (const species of LUMI_ANIMALS) {
  for (const pose of POSES) {
    for (const expression of EXPRESSIONS) {
      const node = compileCharacter(CHARACTER_BLUEPRINTS[species], { pose, expression });
      fs.writeFileSync(path.join(output, `${species}__${pose}__${expression}.svg`), svg(node));
    }
  }
  fs.writeFileSync(path.join(output, `${species}__accessories.svg`), svg(compileCharacter(
    CHARACTER_BLUEPRINTS[species], { expression: 'happy', accessories: ['flower', 'scarf', 'star'] },
  )));
}
console.log(`Exported ${LUMI_ANIMALS.length * (POSES.length * EXPRESSIONS.length + 1)} standalone SVG characters`);
