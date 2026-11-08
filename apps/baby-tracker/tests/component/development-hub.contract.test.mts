import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const developmentScreen = path.join(here, '../../src/features/development/DevelopmentScreen.tsx');
const detailScreen = path.join(here, '../../src/features/development/ActivityDetailScreen.tsx');
const todayCard = path.join(here, '../../src/features/today/TodayTogetherCard.tsx');
const productCopy = path.join(here, '../../src/features/ui/productCopy.ts');

test('development hub wires try, favorites, filters and shared today offer', () => {
  const development = fs.readFileSync(developmentScreen, 'utf8');
  const detail = fs.readFileSync(detailScreen, 'utf8');
  const today = fs.readFileSync(todayCard, 'utf8');
  const copy = fs.readFileSync(productCopy, 'utf8');
  assert.match(development, /Procházet aktivity|development\.library/);
  assert.match(development, /clearFilters|clearSituationFilters/);
  assert.match(development, /weeklyGlance|Týdenní ohlédnutí/);
  assert.match(detail, /weTried|Vyzkoušeli jsme/);
  assert.match(detail, /recordAgain|Zapsat znovu/);
  assert.match(detail, /inFlightRef/);
  assert.match(today, /ensureDailyRecommendationSet/);
  assert.match(copy, /weTried/);
  assert.doesNotMatch(development, /task-\d+|Co-Authored-By/i);
});
