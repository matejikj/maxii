const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
test('story catalog covers all key components and uses dedicated bundle entry', () => {
  const root = path.resolve(__dirname, '..');
  const entries = fs.readdirSync(path.join(root, 'stories')).filter(n => n.endsWith('.stories.tsx'));
  for (const required of ['Buttons', 'Input', 'Card', 'Typography', 'Timeline', 'Chart', 'BottomSheet', 'Controls', 'EmptyState']) {
    assert.ok(entries.includes(required + '.stories.tsx'));
  }
  const metro = fs.readFileSync(path.join(root, 'metro.config.js'), 'utf8');
  assert.match(metro, /withStorybook/);
  assert.match(fs.readFileSync(path.join(root, '.rnstorybook/index.tsx'), 'utf8'), /registerRootComponent\(StorybookRoot\)/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'App.tsx'), 'utf8'), /\.rnstorybook/);
});
