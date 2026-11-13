import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asChildId,
  asEntityId,
  asRevisionId,
  asTimeZoneId,
  createDraft,
  createNoteEvent,
  createNursingEvent,
  createSleepEvent,
  zonedInstant,
} from '../../src/domain/index.ts';
import {
  appendHistoryPage,
  draftPreviewFields,
  groupHistoryByDay,
  historyCountLabel,
  parseHistoryDateInput,
  presentHistoryEvent,
  shiftHistoryDay,
} from '../../src/features/history/historyPresentation.ts';

const zone = asTimeZoneId('Europe/Prague');
const childId = asChildId('child_history_presentation');
const at = (iso: string) => zonedInstant({ epochMs: Date.parse(iso) }, zone);
function note(id: string, iso: string) {
  return createNoteEvent({
    eventId: asEntityId(id),
    childId,
    revisionId: asRevisionId(`rev_${id}`),
    occurredAt: at(iso),
    createdAt: at('2026-02-01T12:00:00Z'),
    body: 'Vzpomínka',
  });
}

test('history date picker accepts complete Czech/ISO dates and rejects partial and impossible dates', () => {
  assert.equal(parseHistoryDateInput(' 1. 2. 2026 '), '2026-02-01');
  assert.equal(parseHistoryDateInput('2024-02-29'), '2024-02-29');
  for (const value of [
    '',
    '1.2.',
    '2026-1',
    '31.4.2026',
    '29.2.2025',
    '2026-02-30',
    '0000-01-01',
  ]) {
    assert.equal(parseHistoryDateInput(value), null, value);
  }
});

test('day navigation uses calendar days through DST changes and the end of a year', () => {
  assert.equal(shiftHistoryDay('2026-03-29', 1), '2026-03-30');
  assert.equal(shiftHistoryDay('2026-10-25', -1), '2026-10-24');
  assert.equal(shiftHistoryDay('2026-12-31', 1), '2027-01-01');
});

test('history groups by local care time, not UTC dates or the later save date', () => {
  const early = note('early', '2026-01-01T22:30:00Z');
  const late = note('late', '2026-01-01T23:30:00Z');
  const source = [early, late];
  const groups = groupHistoryByDay(source, zone);
  assert.deepEqual(
    groups.map((group) => group.day),
    ['2026-01-02', '2026-01-01'],
  );
  assert.deepEqual(source, [early, late]);
});

test('spring DST gap and repeated autumn clocks retain stable instant ordering', () => {
  const first = note('a', '2026-10-25T00:30:00Z');
  const second = note('b', '2026-10-25T01:30:00Z');
  const group = groupHistoryByDay([first, second], zone)[0]!;
  assert.deepEqual(
    group.events.map((event) => event.eventId),
    ['b', 'a'],
  );
  assert.equal(presentHistoryEvent(first, zone).clock, presentHistoryEvent(second, zone).clock);
  assert.equal(presentHistoryEvent(note('spring', '2026-03-29T01:30:00Z'), zone).clock, '03:30');
});

test('overnight sleep belongs to its start day and names the different end day', () => {
  const sleep = createSleepEvent({
    eventId: asEntityId('sleep'),
    childId,
    revisionId: asRevisionId('rev_sleep'),
    occurrence: {
      kind: 'known',
      start: at('2026-01-01T22:00:00Z'),
      end: at('2026-01-02T07:00:00Z'),
    },
    createdAt: at('2026-01-02T07:00:00Z'),
  });
  assert.equal(groupHistoryByDay([sleep], zone)[0]!.day, '2026-01-01');
  assert.match(presentHistoryEvent(sleep, zone).detail, /23:00–08:00 · konec 2\./);
  const nursing = createNursingEvent({
    eventId: asEntityId('nursing'),
    childId,
    revisionId: asRevisionId('rev_nursing'),
    occurrence: { kind: 'unknownDuration', observedAt: at('2026-01-01T22:00:00Z') },
    createdAt: at('2026-01-01T22:00:00Z'),
  });
  assert.match(presentHistoryEvent(nursing, zone).detail, /bez známé délky/);
});

test('overlapping history pages merge without duplicate records or unstable ties', () => {
  const a = note('a', '2026-01-01T12:00:00Z');
  const b = note('b', '2026-01-01T12:00:00Z');
  const c = note('c', '2026-01-01T11:00:00Z');
  const previous = [b, a];
  assert.deepEqual(
    appendHistoryPage(previous, [a, c, c]).map((event) => event.eventId),
    ['b', 'a', 'c'],
  );
  assert.deepEqual(previous, [b, a]);
});

test('draft previews preserve zero and original text while hiding implementation payload keys', () => {
  const draft = createDraft({
    draftId: asEntityId('draft'),
    childId,
    formType: 'bottle',
    originalEventTime: { epochMs: 1 },
    updatedAt: { epochMs: 2 },
    payload: {
      amount: 0,
      note: 'Vlastní poznámka',
      contents: 'breastMilk',
      originalMs: 1,
      panel: 'bottle',
      privateId: 'secret',
      unknownObject: {},
    },
  });
  const fields = draftPreviewFields(draft);
  assert.deepEqual(fields, [
    { label: 'Obsah', value: 'Mateřské mléko' },
    { label: 'Množství', value: '0' },
    { label: 'Poznámka', value: 'Vlastní poznámka' },
  ]);
  assert.equal(draft.originalEventTime.epochMs, 1);
  assert.deepEqual([0, 1, 2, 5].map(historyCountLabel), [
    '0 záznamů',
    '1 záznam',
    '2 záznamy',
    '5 záznamů',
  ]);
});
