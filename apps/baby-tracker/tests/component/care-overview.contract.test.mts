import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../../src');

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('Care tab hosts day and week overview with recorded-only copy', () => {
  const care = read('features/care/CareScreen.tsx');
  assert.match(care, /CareOverviewPanel/);
  const panel = read('features/care/CareOverviewPanel.tsx');
  assert.match(panel, /Dnes|7 dní/);
  assert.match(panel, /loadDailyCareOverview|loadWeeklyCareOverview/);
  assert.doesNotMatch(panel, /signIn|fetch\(|EXPO_PUBLIC_LUMI_API_URL/i);
  const copy = read('features/care/presentCareOverview.ts');
  assert.match(copy, /Zaznamenáno|Zapsané/);
  assert.doesNotMatch(copy, /diagnóz|nedostatečn[áé] péč|zdravotní závěr/i);
});

test('personal runtime clears overview cache on care commits', () => {
  const bootstrap = read('app/session/BootstrapContext.tsx');
  assert.match(bootstrap, /overviewCache/);
  assert.match(bootstrap, /createCareOverviewCache/);
  assert.match(bootstrap, /invalidate/);
});
