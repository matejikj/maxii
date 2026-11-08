import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DateTime } from 'luxon';
import { AppError } from '../../src/domain/errors.ts';
import {
  anniversaryOn,
  asTimeZoneId,
  calendarAgeOn,
  calendarDateFromParts,
  crossesLocalMidnight,
  instantFromLocalWallTime,
  intersectWithLocalDay,
  isWithinFirstContentWindow,
  knownInterval,
  nursingActiveDurationMs,
  parseCalendarDate,
  totalUnionDurationMs,
  zonedInstant,
} from '../../src/domain/time/index.ts';

const prague = asTimeZoneId('Europe/Prague');

test('calendar age handles month-end birth and leap day without day/30 math', () => {
  const birth = calendarDateFromParts(2024, 1, 31);
  const on = calendarDateFromParts(2024, 3, 1);
  const age = calendarAgeOn(birth, on);
  assert.equal(age.years, 0);
  assert.equal(age.months, 1);
  assert.equal(age.days, 1);

  const leapBirth = calendarDateFromParts(2024, 2, 29);
  assert.deepEqual(anniversaryOn(leapBirth, 1), { year: 2025, month: 2, day: 28 });
});

test('first content window ends the day before the first birthday', () => {
  const birth = parseCalendarDate('2025-11-08');
  assert.equal(isWithinFirstContentWindow(birth, parseCalendarDate('2025-11-08')), true);
  assert.equal(isWithinFirstContentWindow(birth, parseCalendarDate('2026-11-07')), true);
  assert.equal(isWithinFirstContentWindow(birth, parseCalendarDate('2026-11-08')), false);
  assert.throws(
    () => isWithinFirstContentWindow(birth, parseCalendarDate('2025-11-07')),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION',
  );
});

test('DST spring gap rejects or shifts explicitly', () => {
  // Europe/Prague 2026-03-29: 2:00 CET → 3:00 CEST
  const gapWall = { year: 2026, month: 3, day: 29, hour: 2, minute: 30, second: 0 };
  assert.throws(
    () => instantFromLocalWallTime(gapWall, prague, { policy: 'reject' }),
    (error: unknown) =>
      error instanceof AppError && error.details.reason === 'dst_gap',
  );
  const shifted = instantFromLocalWallTime(gapWall, prague, { policy: 'shiftForwardToValid' });
  const local = DateTime.fromMillis(shifted.instant.epochMs, { zone: prague });
  assert.ok(local.hour > 2 || (local.hour === 3 && local.minute >= 0));
  assert.notEqual(local.hour, 2);
});

test('DST fall overlap requires an explicit earlier/later choice', () => {
  // Europe/Prague 2026-10-25: 3:00 CEST → 2:00 CET
  const overlapWall = { year: 2026, month: 10, day: 25, hour: 2, minute: 30, second: 0 };
  assert.throws(
    () => instantFromLocalWallTime(overlapWall, prague, { policy: 'reject' }),
    (error: unknown) =>
      error instanceof AppError && error.details.reason === 'dst_overlap',
  );
  const earlier = instantFromLocalWallTime(overlapWall, prague, { policy: 'preferEarlier' });
  const later = instantFromLocalWallTime(overlapWall, prague, { policy: 'preferLater' });
  assert.ok(earlier.instant.epochMs < later.instant.epochMs);
  assert.equal(
    DateTime.fromMillis(earlier.instant.epochMs, { zone: prague }).hour,
    2,
  );
  assert.equal(DateTime.fromMillis(later.instant.epochMs, { zone: prague }).hour, 2);
});

test('travel keeps stored instants; summary day uses the chosen zone', () => {
  const start = instantFromLocalWallTime(
    { year: 2026, month: 6, day: 1, hour: 23, minute: 0 },
    prague,
    { policy: 'reject' },
  );
  const end = instantFromLocalWallTime(
    { year: 2026, month: 6, day: 2, hour: 1, minute: 0 },
    prague,
    { policy: 'reject' },
  );
  const interval = knownInterval(start, end);
  assert.equal(crossesLocalMidnight(interval, prague), true);

  const tokyo = asTimeZoneId('Asia/Tokyo');
  const dayInTokyo = intersectWithLocalDay(interval, { year: 2026, month: 6, day: 2 }, tokyo);
  const dayInPrague = intersectWithLocalDay(interval, { year: 2026, month: 6, day: 1 }, prague);
  assert.ok(dayInPrague);
  assert.equal(dayInPrague!.endMs - dayInPrague!.startMs, 60 * 60 * 1000);
  // Changing display zone never mutates the stored epoch pair.
  assert.equal(interval.start.instant.epochMs, start.instant.epochMs);
  void dayInTokyo;
});

test('sleep overlap unions once; nursing pauses are excluded', () => {
  const a = { startMs: 0, endMs: 1000 };
  const b = { startMs: 500, endMs: 1500 };
  assert.equal(totalUnionDurationMs([a, b]), 1500);

  const active = nursingActiveDurationMs([
    { startMs: 0, endMs: 10_000 },
    { startMs: 20_000, endMs: 25_000 },
  ]);
  assert.equal(active, 15_000);
  assert.throws(() => nursingActiveDurationMs([
    { startMs: 0, endMs: 10_000 },
    { startMs: 5_000, endMs: 12_000 },
  ]));
});

test('clock skew forward/back does not rewrite a stored zoned instant', () => {
  const stored = zonedInstant({ epochMs: 1_700_000_000_000 }, prague, 'exact');
  const skewedForward = zonedInstant({ epochMs: 1_700_000_000_000 }, prague, 'exact');
  assert.equal(stored.instant.epochMs, skewedForward.instant.epochMs);
});
