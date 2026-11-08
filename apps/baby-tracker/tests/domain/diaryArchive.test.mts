import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asChildId,
  asEntityId,
  asRevisionId,
  asTimeZoneId,
  careEventsToPrivateCsv,
  compareDiaryArchives,
  createDiaryArchive,
  createNoteEvent,
  escapeCsvCell,
  parseDiaryArchive,
  zonedInstant,
} from '../../src/domain/index.ts';

const zone = asTimeZoneId('Europe/Prague');

test('diary archive compare counts newer local care without merging', () => {
  const older = createNoteEvent({
    eventId: asEntityId('note_old'),
    revisionId: asRevisionId('rev_old'),
    childId: asChildId('child_1'),
    occurredAt: zonedInstant({ epochMs: 1_000 }, zone),
    createdAt: zonedInstant({ epochMs: 1_000 }, zone),
    body: 'older',
  });
  const newer = createNoteEvent({
    eventId: asEntityId('note_new'),
    revisionId: asRevisionId('rev_new'),
    childId: asChildId('child_1'),
    occurredAt: zonedInstant({ epochMs: 2_000 }, zone),
    createdAt: zonedInstant({ epochMs: 2_000 }, zone),
    body: 'newer',
  });
  const current = createDiaryArchive({
    createdAtMs: 3_000,
    schemaCompatibility: 4,
    profiles: [],
    careEvents: [older, newer],
    sessions: [],
    drafts: [],
    revisions: [],
    receipts: [],
    deletions: [],
    meta: [],
  });
  const incoming = createDiaryArchive({
    createdAtMs: 1_500,
    schemaCompatibility: 4,
    profiles: [],
    careEvents: [older],
    sessions: [],
    drafts: [],
    revisions: [],
    receipts: [],
    deletions: [],
    meta: [],
  });
  const compare = compareDiaryArchives(current, incoming);
  assert.equal(compare.newerLocalCareEvents, 1);
  assert.equal(compare.merges, false);
  assert.equal(compare.replacesLiveDiary, true);
});

test('parseDiaryArchive rejects unsupported format and oversized payloads', () => {
  assert.throws(
    () => parseDiaryArchive({ format: 'other', manifest: {} }),
    (error: unknown) => error instanceof Error && /Unsupported diary archive format/.test(error.message),
  );
  assert.throws(
    () => parseDiaryArchive('x'.repeat(21 * 1024 * 1024)),
    (error: unknown) => error instanceof Error && /size limit/.test(error.message),
  );
});

test('CSV export guards formula injection and marks private data', () => {
  assert.equal(escapeCsvCell('=cmd()'), "'=cmd()");
  assert.equal(escapeCsvCell('+1'), "'+1");
  assert.equal(escapeCsvCell('safe'), 'safe');
  const note = createNoteEvent({
    eventId: asEntityId('note_csv'),
    revisionId: asRevisionId('rev_csv'),
    childId: asChildId('child_1'),
    occurredAt: zonedInstant({ epochMs: 1_000 }, zone),
    createdAt: zonedInstant({ epochMs: 1_000 }, zone),
    body: '=HYPERLINK("x")',
  });
  const csv = careEventsToPrivateCsv([note]);
  assert.match(csv, /private care export/i);
  assert.match(csv, /Not a full recovery backup/);
  assert.match(csv, /'=HYPERLINK/);
});
