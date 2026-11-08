import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const homeScreenPath = path.join(here, '../../src/features/today/HomeScreen.tsx');

test('Today home screen keeps brand-first Czech empty state and header semantics', () => {
  const source = fs.readFileSync(homeScreenPath, 'utf8');
  assert.match(source, /Deník miminka/);
  assert.match(source, /Každý den spolu/);
  assert.match(source, /accessibilityRole="header"/);
  assert.match(source, /LumiCharacter/);
  assert.doesNotMatch(source, /storybook|showcase/i);
});
