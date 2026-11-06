#!/usr/bin/env node
/* Freeze exported names (including types) of each official public TypeScript entrypoint. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const entries = {root:'src/index.ts', core:'src/core/index.ts', native:'src/react-native/index.ts'};
function exportsOf(input, visited = new Set()) {
  const file = path.resolve(root, input);
  if (visited.has(file)) return new Set();
  visited.add(file);
  const code = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names = new Set();
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) {
      const child = statement.moduleSpecifier?.text;
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const e of statement.exportClause.elements) names.add(e.name.text);
      } else if (child?.startsWith('.')) {
        const target = path.resolve(path.dirname(file), child);
        const resolved = [target + '.ts', target + '.tsx', path.join(target, 'index.ts')].find(fs.existsSync);
        if (!resolved) throw Error(`Cannot resolve ${child} in ${file}`);
        for (const name of exportsOf(path.relative(root, resolved), visited)) names.add(name);
      }
    } else if (statement.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword) &&
        (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement) || ts.isEnumDeclaration(statement))) {
      if (statement.name) names.add(statement.name.text);
    } else if (ts.isVariableStatement(statement) && statement.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const decl of statement.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) names.add(decl.name.text);
      }
    }
  }
  return names;
}
const manifest = Object.fromEntries(Object.entries(entries).map(([name,file]) => [name,[...exportsOf(file)].sort()]));
const location = path.join(root,'contracts/public-api.json');
if (process.argv.includes('--approve')) {
  fs.writeFileSync(location, JSON.stringify(manifest,null,2)+'\n');
  console.log('Public API manifest updated (review this diff; treat removals as breaking changes).');
} else {
  assert.deepEqual(manifest, JSON.parse(fs.readFileSync(location, 'utf8')),
    'Public API changed. Review semver and explicitly approve contract with node tools/public-api.cjs --approve');
  console.log(`Public API stable: ${Object.entries(manifest).map(([k,v])=>`${k}=${v.length}`).join(' ')} exports`);
}
