/** Offline design-only SVG snapshots for review; NOT a simulation of RN/Reanimated frames. */
const fs = require('node:fs');
const path = require('node:path');
const { LUMI_ANIMALS, CHARACTER_BLUEPRINTS, prepareCharacterMotion, serializeVectorNode } = require('../.test-dist/core/index.js');
const dest = path.resolve(__dirname,'../previews/motion-frames'); fs.mkdirSync(dest,{recursive:true});
const variants = [
  { name:'idle', eye:1, ear:0, lift:0 },
  { name:'blink', eye:.06, ear:1.5, lift:0 },
  { name:'ear-sway', eye:1, ear:-3.2, lift:0 },
  { name:'celebrate', eye:1, ear:3.2, lift:-10 },
];
const escap = n => Number(n.toFixed(4));
for (const species of LUMI_ANIMALS) for (const v of variants) {
  const prepared = prepareCharacterMotion(CHARACTER_BLUEPRINTS[species]);
  let inner = '';
  for (const p of prepared.parts) {
    let svg = serializeVectorNode(p.node);
    if (p.channel === 'leftEye'||p.channel === 'rightEye') svg=`<g transform="translate(0 ${p.pivot.y}) scale(1 ${v.eye}) translate(0 ${-p.pivot.y})">${svg}</g>`;
    if (p.channel === 'leftEar'||p.channel === 'rightEar') svg=`<g transform="rotate(${v.ear * (p.channel==='leftEar'?1:-1)} ${p.pivot.x} ${p.pivot.y})">${svg}</g>`;
    inner += svg;
  }
  if (v.lift) inner += `<path d="M-115 -67 l6 15 15 6 -15 6 -6 15 -6 -15 -15 -6 15 -6Z" fill="#F4D28D"/>`;
  const content = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="250" viewBox="-176 -178 352 360"><g transform="translate(0 ${escap(v.lift)})">${inner}</g></svg>`;
  fs.writeFileSync(path.join(dest,`${species}-${v.name}.svg`),content);
}
console.log(`Exported ${LUMI_ANIMALS.length * variants.length} static design-only animation frame samples`);
