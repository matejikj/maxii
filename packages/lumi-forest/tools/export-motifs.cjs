/** Exports the same renderer-neutral worlds used by LumiMotifLandscape. */
const fs = require('node:fs');
const path = require('node:path');
const {
  LUMI_MOTIF_IDS,
  compileLumiMotifLandscape,
  serializeScene,
} = require('../.test-dist/core/index.js');
const output = path.resolve(__dirname, '../exports/motifs');
fs.mkdirSync(output, { recursive: true });
for (const motif of LUMI_MOTIF_IDS)
  for (const mode of ['light', 'dark'])
    for (const variant of ['day', 'dusk']) {
      const document = compileLumiMotifLandscape(motif, { mode, variant });
      fs.writeFileSync(
        path.join(output, `${motif}__${mode}__${variant}.svg`),
        serializeScene(document),
      );
    }
console.log('Exported 12 motif / appearance landscapes');
