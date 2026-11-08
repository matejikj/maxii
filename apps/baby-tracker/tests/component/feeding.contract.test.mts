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

test('Today opens feeding recorder instead of unavailable sheet', () => {
  const today = read('features/today/TodayScreen.tsx');
  assert.match(today, /FeedingRecorder/);
  assert.match(today, /NursingSessionController/);
  assert.match(today, /setFeedingOpen/);
  assert.doesNotMatch(today, /feedingSoon|unavailableFeeding/);
});

test('feeding panel remembers kind only and keeps amount optional', () => {
  const source = read('features/today/FeedingRecorder.tsx');
  assert.match(source, /saveLastFeedingKind/);
  assert.match(source, /rememberKindOnly/);
  assert.match(source, /parseMeasuredAmount/);
  assert.match(source, /originalMs/);
  assert.match(source, /QuantityField/);
});

test('nursing controller pauses, switches side, and freezes end', () => {
  const source = read('features/today/NursingSessionController.tsx');
  assert.match(source, /buildPauseNursingCommand/);
  assert.match(source, /buildSwitchNursingSideCommand/);
  assert.match(source, /intendedEndMs/);
  assert.match(source, /undoEndNursing/);
});

test('compact strip can show sleep and nursing together', () => {
  const compact = read('features/shell/CompactActiveSessions.tsx');
  assert.match(compact, /nursing/);
  assert.match(compact, /sleep/);
  assert.match(compact, /nursingElapsedMs/);
});

test('dispatcher exposes nursing session commands', () => {
  const dispatcher = read('application/commandDispatcher.ts');
  assert.match(dispatcher, /startNursingSession/);
  assert.match(dispatcher, /pauseNursingSession/);
  assert.match(dispatcher, /switchNursingSide/);
  assert.match(dispatcher, /endNursingSession/);
  assert.match(dispatcher, /recordFood/);
});
