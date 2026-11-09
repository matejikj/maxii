import { DateTime } from 'luxon';
import { AppError } from '../errors';
import type { Instant } from '../ports/clock';
import {
  calendarDateInZone,
  compareCalendarDates,
  formatCalendarDate,
  parseCalendarDate,
} from './calendarDate';
import type { CalendarDate, TimeZoneId } from './types';
import { asTimeZoneId } from './zonedTime';

/**
 * First-year base pack covers birth through the day before the first birthday.
 * Age is never stretched into that window when the child is older.
 */
export const FIRST_CONTENT_MAX_EXCLUSIVE_YEARS = 1;

/**
 * Combined install-local recommendable window after preschool 2–5 publication:
 * birth through the day before the fifth birthday (completed months 0–59).
 */
export const PUBLISHED_CONTENT_MAX_EXCLUSIVE_YEARS = 5;

export type CalendarAge = {
  years: number;
  months: number;
  days: number;
  /** Whole completed months since birth; never derived as dayCount / 30. */
  totalMonths: number;
};

export function assertBirthDateNotFuture(birthDate: CalendarDate, today: CalendarDate): void {
  if (compareCalendarDates(birthDate, today) > 0) {
    throw new AppError('VALIDATION', 'Date of birth cannot be in the future', {
      details: { reason: 'future_dob' },
    });
  }
}

export function calendarAgeOn(birthDate: CalendarDate, onDate: CalendarDate): CalendarAge {
  assertBirthDateNotFuture(birthDate, onDate);

  const birth = DateTime.utc(birthDate.year, birthDate.month, birthDate.day).startOf('day');
  const on = DateTime.utc(onDate.year, onDate.month, onDate.day).startOf('day');
  const diff = on.diff(birth, ['years', 'months', 'days']).toObject();

  const years = Math.trunc(diff.years ?? 0);
  const months = Math.trunc(diff.months ?? 0);
  const days = Math.trunc(diff.days ?? 0);

  return {
    years,
    months,
    days,
    totalMonths: years * 12 + months,
  };
}

/**
 * True from birth date through the calendar day before the first birthday.
 * The first birthday itself is outside the initial 0–11 month base pack. Older
 * ages are reported honestly and are not clamped into that pack window.
 */
export function isWithinFirstContentWindow(birthDate: CalendarDate, onDate: CalendarDate): boolean {
  return isWithinPublishedContentWindow(birthDate, onDate, {
    maxExclusiveYears: FIRST_CONTENT_MAX_EXCLUSIVE_YEARS,
  });
}

/**
 * True while the child's completed months fall inside the currently published
 * install-local catalogs. Outside the window the UI must say the next set is
 * unavailable — never stretch older ages into infant activities.
 */
export function isWithinPublishedContentWindow(
  birthDate: CalendarDate,
  onDate: CalendarDate,
  options: { maxExclusiveYears?: number } = {},
): boolean {
  assertBirthDateNotFuture(birthDate, onDate);
  const years = options.maxExclusiveYears ?? PUBLISHED_CONTENT_MAX_EXCLUSIVE_YEARS;
  const exclusiveEnd = anniversaryOn(birthDate, years);
  return compareCalendarDates(onDate, exclusiveEnd) < 0;
}

export function anniversaryOn(birthDate: CalendarDate, yearsLater: number): CalendarDate {
  const source = DateTime.utc(birthDate.year, birthDate.month, birthDate.day).plus({
    years: yearsLater,
  });
  // Luxon clamps Feb 29 → Feb 28 in non-leap target years, matching civil
  // anniversary handling without inventing March 1 as a birthday.
  if (!source.isValid) {
    throw new AppError('VALIDATION', 'Anniversary date is invalid', {
      details: { birthDate: formatCalendarDate(birthDate), yearsLater },
    });
  }
  return { year: source.year, month: source.month, day: source.day };
}

export function todayInZone(now: Instant, timeZone: TimeZoneId): CalendarDate {
  return calendarDateInZone(now, asTimeZoneId(timeZone));
}

export function parseOptionalBirthDate(isoDate: string | null | undefined): CalendarDate | null {
  if (isoDate == null || isoDate === '') return null;
  return parseCalendarDate(isoDate);
}
