import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asChildId,
  asEntityId,
  asRevisionId,
  asTimeZoneId,
  buildDailyCareOverview,
  buildWeeklyCareOverview,
  createBottleEvent,
  createDiaperEvent,
  createSleepEvent,
  knownInterval,
  startSession,
  zonedInstant,
} from '../../src/domain/index.ts';
import { presentCareOverview } from '../../src/features/care/presentCareOverview.ts';

const zone = asTimeZoneId('Europe/Prague');
const childId = asChildId('child_overview');
const createdAt = zonedInstant({ epochMs: 1_700_000_100_000 }, zone);

test('unknown bottle amount stays out of ml totals and is named as missing', () => {
  const known = createBottleEvent({
    eventId: asEntityId('bottle_known'),
    childId,
    revisionId: asRevisionId('rev_b1'),
    occurredAt: zonedInstant({ epochMs: 1_700_000_000_000 }, zone),
    contents: 'formula',
    amount: { value: 120, unit: 'ml' },
    createdAt,
  });
  const missing = createBottleEvent({
    eventId: asEntityId('bottle_missing'),
    childId,
    revisionId: asRevisionId('rev_b2'),
    occurredAt: zonedInstant({ epochMs: 1_700_000_010_000 }, zone),
    contents: 'formula',
    amount: null,
    createdAt,
  });
  const day = { year: 2023, month: 11, day: 14 };
  const overview = buildDailyCareOverview({
    day,
    summaryTimeZone: zone,
    events: [known, missing],
  });
  assert.equal(overview.bottles.stats.recordedMl, 120);
  assert.equal(overview.bottles.stats.feedingsMissingAmount, 1);
  assert.deepEqual(overview.bottles.sourceEventIds.sort(), ['bottle_known', 'bottle_missing']);
  const copy = presentCareOverview(overview);
  assert.match(copy.bottles, /Zaznamenáno 120 ml/);
  assert.match(copy.bottles, /množství chybí/);
  assert.doesNotMatch(copy.bottles, /nedostatek|zdrav/);
});

test('overlapping sleep intervals union once inside a day', () => {
  const day = { year: 2023, month: 11, day: 14 };
  const start = zonedInstant({ epochMs: Date.UTC(2023, 10, 14, 10, 0) }, zone);
  const mid = zonedInstant({ epochMs: Date.UTC(2023, 10, 14, 11, 0) }, zone);
  const end = zonedInstant({ epochMs: Date.UTC(2023, 10, 14, 12, 0) }, zone);
  const a = createSleepEvent({
    eventId: asEntityId('sleep_a'),
    childId,
    revisionId: asRevisionId('rev_s1'),
    occurrence: knownInterval(start, end),
    createdAt,
  });
  const b = createSleepEvent({
    eventId: asEntityId('sleep_b'),
    childId,
    revisionId: asRevisionId('rev_s2'),
    occurrence: knownInterval(mid, end),
    createdAt,
  });
  const overview = buildDailyCareOverview({
    day,
    summaryTimeZone: zone,
    events: [a, b],
  });
  assert.equal(overview.sleep.stats.recordedIntervalMs, 2 * 60 * 60 * 1000);
});

test('midnight-crossing sleep splits across days without a second event', () => {
  // Europe/Prague winter: local midnight 2023-11-15 is UTC 23:00 previous day.
  const start = zonedInstant({ epochMs: Date.UTC(2023, 10, 14, 22, 0) }, zone);
  const end = zonedInstant({ epochMs: Date.UTC(2023, 10, 15, 2, 0) }, zone);
  const event = createSleepEvent({
    eventId: asEntityId('sleep_cross'),
    childId,
    revisionId: asRevisionId('rev_cross'),
    occurrence: knownInterval(start, end),
    createdAt,
  });
  const day14 = buildDailyCareOverview({
    day: { year: 2023, month: 11, day: 14 },
    summaryTimeZone: zone,
    events: [event],
  });
  const day15 = buildDailyCareOverview({
    day: { year: 2023, month: 11, day: 15 },
    summaryTimeZone: zone,
    events: [event],
  });
  assert.equal(day14.sleep.sourceEventIds.length, 1);
  assert.equal(day15.sleep.sourceEventIds.length, 1);
  assert.equal(
    day14.sleep.stats.recordedIntervalMs + day15.sleep.stats.recordedIntervalMs,
    end.instant.epochMs - start.instant.epochMs,
  );
  assert.notEqual(day14.sleep.stats.recordedIntervalMs, 0);
  assert.notEqual(day15.sleep.stats.recordedIntervalMs, 0);
});

test('diaper both counts once as a diaper and once toward wet and dirty', () => {
  const event = createDiaperEvent({
    eventId: asEntityId('diaper_both'),
    childId,
    revisionId: asRevisionId('rev_d1'),
    occurredAt: zonedInstant({ epochMs: Date.UTC(2023, 10, 14, 12, 0) }, zone),
    contents: 'both',
    createdAt,
  });
  const overview = buildDailyCareOverview({
    day: { year: 2023, month: 11, day: 14 },
    summaryTimeZone: zone,
    events: [event],
  });
  assert.equal(overview.diapers.stats.diapers, 1);
  assert.equal(overview.diapers.stats.wet, 1);
  assert.equal(overview.diapers.stats.dirty, 1);
});

test('weekly sleep sums day intersections and keeps unique source ids', () => {
  const start = zonedInstant({ epochMs: Date.UTC(2023, 10, 14, 22, 0) }, zone);
  const end = zonedInstant({ epochMs: Date.UTC(2023, 10, 15, 2, 0) }, zone);
  const event = createSleepEvent({
    eventId: asEntityId('sleep_week'),
    childId,
    revisionId: asRevisionId('rev_week'),
    occurrence: knownInterval(start, end),
    createdAt,
  });
  const week = buildWeeklyCareOverview({
    endDay: { year: 2023, month: 11, day: 15 },
    summaryTimeZone: zone,
    events: [event],
  });
  assert.equal(week.sleep.sourceEventIds.length, 1);
  assert.equal(week.sleep.stats.recordedIntervalMs, end.instant.epochMs - start.instant.epochMs);
  assert.equal(week.days.length, 7);
});

test('DST spring gap still projects sleep by absolute instants', () => {
  // 2026-03-29 Europe/Prague spring forward: 02:00 local becomes 03:00.
  const start = zonedInstant({ epochMs: Date.UTC(2026, 2, 29, 0, 30) }, zone);
  const end = zonedInstant({ epochMs: Date.UTC(2026, 2, 29, 2, 30) }, zone);
  const event = createSleepEvent({
    eventId: asEntityId('sleep_dst'),
    childId,
    revisionId: asRevisionId('rev_dst'),
    occurrence: knownInterval(start, end),
    createdAt,
  });
  const overview = buildDailyCareOverview({
    day: { year: 2026, month: 3, day: 29 },
    summaryTimeZone: zone,
    events: [event],
  });
  assert.equal(overview.sleep.stats.recordedIntervalMs, 2 * 60 * 60 * 1000);
  assert.equal(start.instant.epochMs, Date.UTC(2026, 2, 29, 0, 30));
});

test('running sleep is marked incomplete and does not invent a finished total', () => {
  const startedAt = zonedInstant({ epochMs: Date.UTC(2023, 10, 14, 12, 0) }, zone);
  const session = startSession({
    sessionId: asEntityId('session_sleep'),
    childId,
    kind: 'sleep',
    startedAt,
  });
  const overview = buildDailyCareOverview({
    day: { year: 2023, month: 11, day: 14 },
    summaryTimeZone: zone,
    events: [],
    activeSessions: [session],
    nowEpochMs: Date.UTC(2023, 10, 14, 13, 0),
  });
  assert.equal(overview.running.length, 1);
  assert.equal(overview.running[0]?.incomplete, true);
  assert.equal(overview.sleep.stats.recordedIntervalMs, 0);
  const copy = presentCareOverview(overview);
  assert.match(copy.running[0] ?? '', /průběžné/);
});
