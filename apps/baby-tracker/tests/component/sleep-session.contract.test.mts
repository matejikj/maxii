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

test('Today starts sleep via durable command and renames running action', () => {
  const today = read('features/today/TodayScreen.tsx');
  assert.match(today, /useSleepStarter/);
  assert.match(today, /SleepSessionController/);
  assert.match(today, /sleepRunning/);
  assert.doesNotMatch(today, /sleepSoon/);
});

test('end sleep freezes intended end for retries', () => {
  const source = read('features/today/SleepSessionController.tsx');
  assert.match(source, /intendedEndMs/);
  assert.match(source, /endNotSaved/);
  assert.match(source, /undoEndSleep/);
  assert.match(source, /LONG_SESSION_MS/);
  assert.match(source, /endedEarlier/);
});

test('compact strip hides on Today and appears elsewhere', () => {
  const nav = read('app/navigation/RootNavigator.tsx');
  assert.match(nav, /CompactActiveSessions/);
  assert.match(nav, /hideCompact/);
  const compact = read('features/shell/CompactActiveSessions.tsx');
  assert.match(compact, /hidden/);
});

test('Care offers past sleep and no-duration without pretending a timer', () => {
  const care = read('features/care/CareScreen.tsx');
  assert.match(care, /recordPastSleep/);
  assert.match(care, /recordSleepNoDuration/);
  assert.match(care, /unknownDuration|sleepOccurrenceWithoutDuration/);
  assert.match(care, /ne běžící timer/);
});

test('dispatcher exposes sleep session commands', () => {
  const dispatcher = read('application/commandDispatcher.ts');
  assert.match(dispatcher, /startSleepSession/);
  assert.match(dispatcher, /endSleepSession/);
  assert.match(dispatcher, /undoEndSleepSession/);
  assert.match(dispatcher, /intendedEndedAt/);
});
