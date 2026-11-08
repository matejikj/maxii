import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const guidePath = path.join(here, '../../content/EDITORIAL.txt');
const indexPath = path.join(here, '../../src/content/index.ts');

test('editorial guide and content package exports exist for authors', () => {
  const guide = fs.readFileSync(guidePath, 'utf8');
  const index = fs.readFileSync(indexPath, 'utf8');
  assert.match(guide, /draft/);
  assert.match(guide, /published/);
  assert.match(guide, /content:validate/);
  assert.match(index, /validateActivityRevision/);
  assert.match(index, /buildPublishedCatalog/);
  assert.match(index, /buildCoverageReport/);
  assert.doesNotMatch(guide, /task-\d+|Co-Authored-By/i);
});
