import { DateTime } from 'luxon';
import { AppError } from '../errors';
import type { CalendarDate, TimeZoneId } from './types';
import type { Instant } from '../ports/clock';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function calendarDateFromParts(year: number, month: number, day: number): CalendarDate {
  const probe = DateTime.fromObject({ year, month, day }, { zone: 'UTC' });
  if (!probe.isValid) {
    throw new AppError('VALIDATION', 'Calendar date is not a real day', {
      details: { year, month, day },
    });
  }
  return { year: probe.year, month: probe.month, day: probe.day };
}

export function parseCalendarDate(isoDate: string): CalendarDate {
  const match = ISO_DATE.exec(isoDate);
  if (!match) {
    throw new AppError('VALIDATION', 'Calendar date must use YYYY-MM-DD', {
      details: { reason: 'format' },
    });
  }
  return calendarDateFromParts(Number(match[1]), Number(match[2]), Number(match[3]));
}

export function formatCalendarDate(date: CalendarDate): string {
  return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

export function compareCalendarDates(a: CalendarDate, b: CalendarDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

export function calendarDateInZone(instant: Instant, timeZone: TimeZoneId): CalendarDate {
  const local = DateTime.fromMillis(instant.epochMs, { zone: timeZone });
  if (!local.isValid) {
    throw new AppError('VALIDATION', 'Instant cannot be projected into the time zone', {
      details: { timeZone },
    });
  }
  return { year: local.year, month: local.month, day: local.day };
}

/** Start of the local calendar day as a UTC instant. */
export function startOfCalendarDay(date: CalendarDate, timeZone: TimeZoneId): Instant {
  const local = DateTime.fromObject(
    { year: date.year, month: date.month, day: date.day, hour: 0, minute: 0, second: 0, millisecond: 0 },
    { zone: timeZone },
  );
  if (!local.isValid) {
    throw new AppError('VALIDATION', 'Calendar day has no valid local midnight', {
      details: { timeZone, date: formatCalendarDate(date) },
    });
  }
  return { epochMs: local.toMillis() };
}

/** Exclusive end of the local calendar day (start of the next local day). */
export function endOfCalendarDayExclusive(date: CalendarDate, timeZone: TimeZoneId): Instant {
  const next = DateTime.fromObject(
    { year: date.year, month: date.month, day: date.day, hour: 0, minute: 0, second: 0, millisecond: 0 },
    { zone: timeZone },
  ).plus({ days: 1 });
  if (!next.isValid) {
    throw new AppError('VALIDATION', 'Next calendar day is invalid', {
      details: { timeZone, date: formatCalendarDate(date) },
    });
  }
  return { epochMs: next.toMillis() };
}
