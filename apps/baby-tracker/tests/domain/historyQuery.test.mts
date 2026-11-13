import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asChildId,
  asEntityId,
  asRevisionId,
  asTimeZoneId,
  compareCareTimelineDesc,
  createDiaperEvent,
  createNoteEvent,
  eventMatchesHistoryBucket,
  isBeforeTimelineCursor,
  matchesLocalSearch,
  normalizeSearchText,
  searchableTextFromCareEvent,
  zonedInstant,
} from '../../src/domain/index.ts';

const zone = asTimeZoneId('Europe/Prague');
const childId = asChildId('child_hist');
const createdAt = zonedInstant({ epochMs: 1_700_000_100_000 }, zone);

test('timeline sort uses care time with stable event id tie-break', () => {
  const shared = zonedInstant({ epochMs: 1_700_000_000_000 }, zone);
  const a = createDiaperEvent({
    eventId: asEntityId('evt_a'),
    childId,
    revisionId: asRevisionId('rev_a'),
    occurredAt: shared,
    contents: 'wet',
    createdAt,
  });
  const b = createDiaperEvent({
    eventId: asEntityId('evt_b'),
    childId,
    revisionId: asRevisionId('rev_b'),
    occurredAt: shared,
    contents: 'dirty',
    createdAt,
  });
  const laterWrite = createNoteEvent({
    eventId: asEntityId('evt_note'),
    childId,
    revisionId: asRevisionId('rev_note'),
    occurredAt: zonedInstant({ epochMs: 1_699_999_000_000 }, zone),
    body: 'včera večer',
    createdAt: zonedInstant({ epochMs: 1_700_000_200_000 }, zone),
  });
  const sorted = [a, laterWrite, b].sort(compareCareTimelineDesc);
  assert.deepEqual(
    sorted.map((event) => event.eventId),
    ['evt_b', 'evt_a', 'evt_note'],
  );
});

test('local search normalizes accents and matches note bodies', () => {
  const note = createNoteEvent({
    eventId: asEntityId('evt_note_search'),
    childId,
    revisionId: asRevisionId('rev_note_search'),
    occurredAt: zonedInstant({ epochMs: 1_700_000_000_000 }, zone),
    body: 'První úsměv u babičky',
    createdAt,
  });
  const haystack = searchableTextFromCareEvent(note);
  assert.equal(normalizeSearchText('ÚSMĚV'), 'usmev');
  assert.equal(matchesLocalSearch(haystack, 'usmev'), true);
  assert.equal(matchesLocalSearch(haystack, 'pláč'), false);
});

test('care subtype filter stays inside care bucket', () => {
  const diaper = createDiaperEvent({
    eventId: asEntityId('evt_d'),
    childId,
    revisionId: asRevisionId('rev_d'),
    occurredAt: zonedInstant({ epochMs: 1_700_000_000_000 }, zone),
    contents: 'wet',
    createdAt,
  });
  const note = createNoteEvent({
    eventId: asEntityId('evt_n'),
    childId,
    revisionId: asRevisionId('rev_n'),
    occurredAt: zonedInstant({ epochMs: 1_700_000_000_000 }, zone),
    body: 'text',
    createdAt,
  });
  assert.equal(eventMatchesHistoryBucket(diaper, 'care', 'diaper'), true);
  assert.equal(eventMatchesHistoryBucket(diaper, 'care', 'sleep'), false);
  assert.equal(eventMatchesHistoryBucket(note, 'care', null), false);
  assert.equal(eventMatchesHistoryBucket(note, 'notes', null), true);
});

test('timeline cursor is exclusive on equal sort keys', () => {
  assert.equal(isBeforeTimelineCursor(100, 'evt_a', { sortAtMs: 100, eventId: 'evt_b' }), true);
  assert.equal(isBeforeTimelineCursor(100, 'evt_c', { sortAtMs: 100, eventId: 'evt_b' }), false);
  assert.equal(isBeforeTimelineCursor(101, 'evt_a', { sortAtMs: 100, eventId: 'evt_b' }), false);
});
