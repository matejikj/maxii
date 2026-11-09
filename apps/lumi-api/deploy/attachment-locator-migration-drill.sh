#!/usr/bin/env bash
# Software drill: family photo object-store locator cutover without live cloud.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
node --experimental-strip-types <<'NODE'
import { runAttachmentLocatorMigrationDrill } from './src/attachments/attachmentLocatorMigrationDrill.ts';

const result = await runAttachmentLocatorMigrationDrill();
for (const row of result.cases) {
  const mark = row.ok ? 'PASS' : 'FAIL';
  console.log(`${mark} ${row.name}: ${row.detail}`);
}
if (!result.ok) {
  console.error('attachment locator migration drill FAILED');
  process.exit(1);
}
console.log('attachment locator migration drill PASS');
NODE
