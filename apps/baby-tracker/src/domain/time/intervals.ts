import { DateTime } from 'luxon';
import { AppError } from '../errors';
import type { Instant } from '../ports/clock';
import { calendarDateInZone, endOfCalendarDayExclusive, startOfCalendarDay } from './calendarDate';
import type { CalendarDate, KnownInterval, TimeZoneId, ZonedInstant } from './types';

/** Half-open millisecond interval used for projections and overlap math. */
export type EpochInterval = {
  startMs: number;
  endMs: number;
};

export function knownInterval(start: ZonedInstant, end: ZonedInstant): KnownInterval {
  if (end.instant.epochMs < start.instant.epochMs) {
    throw new AppError('VALIDATION', 'Interval end cannot precede start', {
      details: { reason: 'end_before_start' },
    });
  }
  return { kind: 'known', start, end };
}

export function toEpochInterval(interval: KnownInterval): EpochInterval {
  return {
    startMs: interval.start.instant.epochMs,
    endMs: interval.end.instant.epochMs,
  };
}

export function durationMs(interval: EpochInterval): number {
  return Math.max(0, interval.endMs - interval.startMs);
}

export function intersectInterval(
  interval: EpochInterval,
  window: EpochInterval,
): EpochInterval | null {
  const startMs = Math.max(interval.startMs, window.startMs);
  const endMs = Math.min(interval.endMs, window.endMs);
  if (endMs <= startMs) return null;
  return { startMs, endMs };
}

export function dayWindow(date: CalendarDate, timeZone: TimeZoneId): EpochInterval {
  const start = startOfCalendarDay(date, timeZone);
  const end = endOfCalendarDayExclusive(date, timeZone);
  return { startMs: start.epochMs, endMs: end.epochMs };
}

/** Portion of a care interval that falls inside one local calendar day. */
export function intersectWithLocalDay(
  interval: KnownInterval,
  date: CalendarDate,
  summaryTimeZone: TimeZoneId,
): EpochInterval | null {
  return intersectInterval(toEpochInterval(interval), dayWindow(date, summaryTimeZone));
}

/**
 * Merge overlapping or abutting intervals so the same moment is never counted
 * twice in sleep totals. Input order does not matter.
 */
export function unionIntervals(intervals: readonly EpochInterval[]): EpochInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  const merged: EpochInterval[] = [{ ...sorted[0]! }];
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i]!;
    const last = merged[merged.length - 1]!;
    if (current.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, current.endMs);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

export function totalUnionDurationMs(intervals: readonly EpochInterval[]): number {
  return unionIntervals(intervals).reduce((sum, part) => sum + durationMs(part), 0);
}

/**
 * Nursing active time excludes pauses. Segments are half-open active spans;
 * callers must not insert pause gaps as zero-duration care.
 */
export function nursingActiveDurationMs(segments: readonly EpochInterval[]): number {
  for (const segment of segments) {
    if (segment.endMs < segment.startMs) {
      throw new AppError('VALIDATION', 'Nursing segment end cannot precede start', {
        details: { reason: 'segment_order' },
      });
    }
  }
  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i]!.startMs < sorted[i - 1]!.endMs) {
      throw new AppError('VALIDATION', 'Nursing segments cannot overlap', {
        details: { reason: 'segment_overlap' },
      });
    }
  }
  return sorted.reduce((sum, part) => sum + durationMs(part), 0);
}

/**
 * A single midnight-crossing sleep stays one event. Day totals split duration
 * via intersectWithLocalDay instead of inventing a second stored event.
 */
export function crossesLocalMidnight(interval: KnownInterval, timeZone: TimeZoneId): boolean {
  const startDate = calendarDateInZone(interval.start.instant, timeZone);
  const endInstant: Instant =
    interval.end.instant.epochMs > interval.start.instant.epochMs
      ? { epochMs: interval.end.instant.epochMs - 1 }
      : interval.end.instant;
  const endDate = calendarDateInZone(endInstant, timeZone);
  return (
    startDate.year !== endDate.year ||
    startDate.month !== endDate.month ||
    startDate.day !== endDate.day
  );
}

export function localParts(zoned: ZonedInstant): { year: number; month: number; day: number } {
  const local = DateTime.fromMillis(zoned.instant.epochMs, { zone: zoned.timeZone });
  return { year: local.year, month: local.month, day: local.day };
}

export function assertChronological(start: Instant, end: Instant): void {
  if (end.epochMs < start.epochMs) {
    throw new AppError('VALIDATION', 'End cannot precede start', {
      details: { reason: 'end_before_start' },
    });
  }
}
