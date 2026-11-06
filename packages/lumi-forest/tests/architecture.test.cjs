const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../src/core');
function scan(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? scan(file) : entry.name.endsWith('.ts') ? [file] : [];
  });
}
test('pure engine must not import native/React modules or reach outside core', () => {
  for (const file of scan(root)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const imported of source.matchAll(/\b(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)) {
      const id = imported[1];
      assert.ok(id.startsWith('.'), `${file} imports external package ${id}`);
      const resolved = path.resolve(path.dirname(file), id);
      assert.ok(resolved.startsWith(root + path.sep), `${file} escapes core via ${id}`);
    }
  }
});
