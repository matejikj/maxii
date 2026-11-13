/** Workshop / appearance-style SVG exports from the same core IR as Expo. */
const fs = require('node:fs');
const path = require('node:path');
const {
  CHARACTER_BLUEPRINTS,
  CHARACTER_APPEARANCE_STYLES,
  LUMI_ANIMALS,
  STUDIO_ACTION_IDS,
  STUDIO_ACTIONS,
  compileCharacter,
  compileStudioActionStatic,
  serializeVectorNode,
} = require('../.test-dist/core/index.js');

const output = path.resolve(__dirname, '../exports/studio-characters');
fs.mkdirSync(output, { recursive: true });

const svg = (geometry) =>
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="330" viewBox="-176 -178 352 360" preserveAspectRatio="xMidYMid meet">' +
  serializeVectorNode(geometry) +
  '</svg>';

let count = 0;
for (const species of LUMI_ANIMALS) {
  for (const style of CHARACTER_APPEARANCE_STYLES) {
    const node = compileCharacter(CHARACTER_BLUEPRINTS[species], {
      pose: 'sitting',
      expression: 'happy',
      appearanceStyle: style,
    });
    fs.writeFileSync(
      path.join(output, `${species}__style-${style}__sitting__happy.svg`),
      svg(node),
    );
    count += 1;
  }
}

for (const actionId of STUDIO_ACTION_IDS) {
  const def = STUDIO_ACTIONS[actionId];
  const node = compileStudioActionStatic(CHARACTER_BLUEPRINTS[def.species], actionId, 'workshop');
  if (!node) throw new Error(`missing studio compile for ${actionId}`);
  fs.writeFileSync(
    path.join(output, `${def.species}__studio-${actionId}__workshop.svg`),
    svg(node),
  );
  count += 1;
}

console.log(`Exported ${count} studio/appearance SVG characters`);
