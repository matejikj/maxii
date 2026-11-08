import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_QUICK_ACTIONS,
  moveQuickActionEarlier,
  normalizeQuickActionOrder,
} from '../../src/features/today/quickActions.ts';
import { presentCareEvent, presentLastCare } from '../../src/features/today/carePresentation.ts';
import {
  asChildId,
  asEntityId,
  asRevisionId,
  asTimeZoneId,
  createDiaperEvent,
  zonedInstant,
} from '../../src/domain/index.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../../src');

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('Today keeps the care-first layout and diaper entry', () => {
  const today = read('features/today/TodayScreen.tsx');
  assert.match(today, /ActiveMeasurement|measurement\.none/);
  assert.match(today, /quickActions/);
  assert.match(today, /lastCare/);
  assert.match(today, /activitySlot/);
  assert.match(today, /DiaperRecorder/);
  assert.match(today, /showTodayRecords|Zobrazit dnešní záznamy/);
  assert.match(today, /editQuickActions/);
});

test('diaper recorder captures now on direct press and never writes on open', () => {
  const source = read('features/today/DiaperRecorder.tsx');
  assert.match(source, /opening never writes/i);
  assert.match(source, /intentMs = services\.clock\.now\(\)\.epochMs/);
  assert.match(source, /DirectCareActions/);
  assert.match(source, /FormSaveButton/);
  assert.match(source, /undoCreateCare/);
  assert.match(source, /createDraftAutosave/);
});

test('quick action order stays user-controlled', () => {
  assert.deepEqual(normalizeQuickActionOrder(['diaper', 'sleep']), [
    'diaper',
    'sleep',
    'feeding',
    'experience',
  ]);
  assert.deepEqual(DEFAULT_QUICK_ACTIONS[0], 'feeding');
  assert.deepEqual(moveQuickActionEarlier(['feeding', 'sleep', 'diaper', 'experience'], 'diaper'), [
    'feeding',
    'diaper',
    'sleep',
    'experience',
  ]);
});

test('last care presentation does not invent an unknown sleep end', () => {
  const zone = asTimeZoneId('Europe/Prague');
  const diaper = createDiaperEvent({
    eventId: asEntityId('evt_1'),
    childId: asChildId('child_1'),
    revisionId: asRevisionId('rev_1'),
    occurredAt: zonedInstant({ epochMs: 1_700_000_000_000 }, zone),
    contents: 'both',
    createdAt: zonedInstant({ epochMs: 1_700_000_000_000 }, zone),
  });
  const last = presentLastCare([diaper], zone);
  assert.equal(last?.title.includes('mokrá i stolice') || last?.title.includes('Plenka'), true);
  const sleepUnknown = presentCareEvent(
    {
      type: 'sleep',
      eventId: asEntityId('evt_2'),
      childId: asChildId('child_1'),
      revisionId: asRevisionId('rev_2'),
      note: null,
      recordedBy: null,
      createdAt: zonedInstant({ epochMs: 1_700_000_100_000 }, zone),
      occurrence: {
        kind: 'unknownDuration',
        observedAt: zonedInstant({ epochMs: 1_700_000_100_000 }, zone),
      },
    },
    zone,
  );
  assert.match(sleepUnknown.detail, /bez známého konce/);
  assert.doesNotMatch(sleepUnknown.detail, /probuzení|wake/i);
});

test('personal runtime wires commands for Today', () => {
  const bootstrap = read('app/session/BootstrapContext.tsx');
  assert.match(bootstrap, /wirePersonalCommands/);
  assert.match(bootstrap, /commands:/);
  assert.match(bootstrap, /readModels:/);
});
