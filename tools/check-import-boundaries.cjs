'use strict';

/**
 * Enforces architectural import rules for the personal client and framework.
 * Synthetic violations are exercised in-process so CI proves the guard works
 * without leaving a broken file in the tree.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');

const FORBIDDEN_IN_DOMAIN = [
  /(?:^|\/)react(?:-native)?(?:\/|$)/,
  /(?:^|\/)expo(?:-[a-z0-9-]+)?(?:\/|$)/,
  /@lumi\/forest-design/,
  /react-native/,
  /^expo$/,
  /^react$/,
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.expo', 'lib', 'android', 'ios'].includes(entry.name) || entry.name.startsWith('dist-')) {
      continue;
    }
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, out);
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) out.push(file);
  }
  return out;
}

function importsIn(source) {
  return [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

function findDomainViolations(files) {
  const violations = [];
  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    for (const id of importsIn(code)) {
      if (FORBIDDEN_IN_DOMAIN.some((re) => re.test(id))) {
        violations.push(`${path.relative(root, file)} imports ${id}`);
      }
    }
  }
  return violations;
}

function findFrameworkAppViolations(files) {
  const violations = [];
  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    for (const id of importsIn(code)) {
      if (id.includes('baby-tracker') || id.includes('@maxii/baby-tracker')) {
        violations.push(`${path.relative(root, file)} imports ${id}`);
      }
    }
  }
  return violations;
}

function selfTest() {
  const domainBad = findDomainViolations([]);
  assert.deepEqual(domainBad, []);
  const syntheticDomain = findDomainViolations.call(
    null,
    [],
  );
  // Inline synthetic scan without writing files:
  const fakeDomainSource = "import React from 'react';\nexport const x = 1;\n";
  const fakePath = path.join(root, 'apps/baby-tracker/src/domain/__synthetic__.ts');
  const domainHits = [];
  for (const id of importsIn(fakeDomainSource)) {
    if (FORBIDDEN_IN_DOMAIN.some((re) => re.test(id))) {
      domainHits.push(`${fakePath} imports ${id}`);
    }
  }
  assert.ok(domainHits.length > 0, 'boundary checker must detect domain → React');

  const frameworkHits = [];
  const fakeFrameworkSource = "import { App } from '@maxii/baby-tracker';\n";
  for (const id of importsIn(fakeFrameworkSource)) {
    if (id.includes('baby-tracker') || id.includes('@maxii/baby-tracker')) {
      frameworkHits.push(id);
    }
  }
  assert.ok(frameworkHits.length > 0, 'boundary checker must detect framework → app');
  void syntheticDomain;
}

function main() {
  selfTest();
  const domainFiles = walk(path.join(root, 'apps/baby-tracker/src/domain'));
  const domainViolations = findDomainViolations(domainFiles);
  const frameworkFiles = walk(path.join(root, 'packages/lumi-forest/src'));
  const frameworkViolations = findFrameworkAppViolations(frameworkFiles);

  if (domainViolations.length || frameworkViolations.length) {
    for (const line of [...domainViolations, ...frameworkViolations]) console.error(line);
    process.exitCode = 1;
    return;
  }
  console.log(
    `Import boundaries OK (${domainFiles.length} domain files, ${frameworkFiles.length} framework files; synthetic guards passed).`,
  );
}

main();
