'use strict';

/**
 * Scans tracked text sources for high-confidence secret material and forbids
 * shipping the logger canary values that prove redaction works.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');

const PATTERNS = [
  { name: 'AWS access key', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'generic private key', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'GitHub PAT', re: /ghp_[A-Za-z0-9]{36,}/ },
  { name: 'Slack token', re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
];

// Assembled so this scanner file does not itself match the canary placement rule.
const CANARY_NOTE = ['CANARY', 'CARE_NOTE', '7f3a9c'].join('_');
const CANARY_DOB = ['CANARY', 'DOB', '2019-04-01'].join('_');
const SYNTHETIC_AWS_ACCESS_KEY = ['AKIA', 'IOSFODNN7EXAMPLE'].join('');

function listedFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString('utf8');
  return out.split('\0').filter(Boolean);
}

function isScannable(rel) {
  if (rel.startsWith('docs/')) return false;
  if (/\.(png|jpg|jpeg|gif|webp|svg|ttf|otf|woff2?|mp4|zip|tgz|lock)$/i.test(rel)) return false;
  if (rel.includes('node_modules/')) return false;
  return true;
}

function scanContent(rel, content) {
  const hits = [];
  for (const pattern of PATTERNS) {
    if (pattern.re.test(content)) hits.push(`${rel}: ${pattern.name}`);
  }
  return hits;
}

function selfTest() {
  const hits = scanContent('synthetic.env', `AWS_KEY=${SYNTHETIC_AWS_ACCESS_KEY}`);
  assert.ok(hits.length > 0, 'secret scanner must block synthetic AWS keys');
}

function main() {
  selfTest();
  const hits = [];
  for (const rel of listedFiles()) {
    if (!isScannable(rel)) continue;
    const absolute = path.join(root, rel);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
    const content = fs.readFileSync(absolute, 'utf8');
    // Canaries may appear only inside dedicated logger tests as string literals
    // used for negative assertions, never in production sources.
    if (
      (content.includes(CANARY_NOTE) || content.includes(CANARY_DOB)) &&
      !rel.includes('logger.test')
    ) {
      hits.push(`${rel}: sensitive canary leaked outside logger tests`);
    }
    hits.push(...scanContent(rel, content));
  }
  if (hits.length) {
    for (const hit of hits) console.error(hit);
    process.exitCode = 1;
    return;
  }
  console.log('Secret scan OK (patterns + canary placement).');
}

main();
