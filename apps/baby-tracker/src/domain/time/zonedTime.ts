import { DateTime, IANAZone } from 'luxon';
import { AppError } from '../errors';
import type { Instant } from '../ports/clock';
import type {
  DstResolution,
  LocalWallTime,
  TimePrecision,
  TimeZoneId,
  ZonedInstant,
} from './types';

export function asTimeZoneId(value: string): TimeZoneId {
  if (!IANAZone.isValidZone(value)) {
    throw new AppError('VALIDATION', 'Time zone must be a valid IANA identifier', {
      details: { reason: 'iana' },
    });
  }
  return value as TimeZoneId;
}

export function zonedInstant(
  instant: Instant,
  timeZone: TimeZoneId,
  precision: TimePrecision = 'exact',
): ZonedInstant {
  asTimeZoneId(timeZone);
  return { instant, timeZone, precision };
}

/**
 * Converts a caregiver-entered local wall time into a UTC instant.
 * Gap and overlap policies are explicit so DST never silently invents duration.
 */
export function instantFromLocalWallTime(
  wall: LocalWallTime,
  timeZone: TimeZoneId,
  resolution: DstResolution,
  precision: TimePrecision = 'exact',
): ZonedInstant {
  asTimeZoneId(timeZone);
  const parts = {
    year: wall.year,
    month: wall.month,
    day: wall.day,
    hour: wall.hour,
    minute: wall.minute,
    second: wall.second ?? 0,
  };

  const matches = matchingInstants(parts, timeZone);

  if (matches.length === 0) {
    if (resolution.policy === 'reject') {
      throw new AppError('VALIDATION', 'Local time does not exist because of a DST gap', {
        details: { timeZone, reason: 'dst_gap' },
      });
    }
    if (resolution.policy === 'shiftForwardToValid') {
      return zonedInstant({ epochMs: shiftForwardAcrossGap(parts, timeZone) }, timeZone, precision);
    }
    throw new AppError('VALIDATION', 'DST gap requires reject or shiftForwardToValid', {
      details: { timeZone, reason: 'dst_gap_policy' },
    });
  }

  if (matches.length === 1) {
    return zonedInstant({ epochMs: matches[0]! }, timeZone, precision);
  }

  if (resolution.policy === 'preferEarlier') {
    return zonedInstant({ epochMs: Math.min(...matches) }, timeZone, precision);
  }
  if (resolution.policy === 'preferLater') {
    return zonedInstant({ epochMs: Math.max(...matches) }, timeZone, precision);
  }
  if (resolution.policy === 'reject') {
    throw new AppError('VALIDATION', 'Local time is ambiguous because of a DST overlap', {
      details: { timeZone, reason: 'dst_overlap' },
    });
  }
  throw new AppError('VALIDATION', 'DST overlap requires preferEarlier, preferLater, or reject', {
    details: { timeZone, reason: 'dst_overlap_policy' },
  });
}

function matchingInstants(
  wall: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  },
  timeZone: TimeZoneId,
): number[] {
  const utcGuess = DateTime.utc(
    wall.year,
    wall.month,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );
  if (!utcGuess.isValid) return [];
  const found = new Set<number>();
  for (let deltaHours = -14; deltaHours <= 14; deltaHours += 1) {
    const local = utcGuess.plus({ hours: deltaHours }).setZone(timeZone);
    if (
      local.isValid &&
      local.year === wall.year &&
      local.month === wall.month &&
      local.day === wall.day &&
      local.hour === wall.hour &&
      local.minute === wall.minute &&
      local.second === wall.second
    ) {
      found.add(local.toMillis());
    }
  }
  return [...found].sort((a, b) => a - b);
}

function shiftForwardAcrossGap(
  wall: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  },
  timeZone: TimeZoneId,
): number {
  // Walk the civil clock forward one minute at a time until the local time exists.
  let cursor = DateTime.utc(wall.year, wall.month, wall.day, wall.hour, wall.minute, wall.second);
  for (let step = 0; step < 180; step += 1) {
    cursor = cursor.plus({ minutes: 1 });
    const candidate = {
      year: cursor.year,
      month: cursor.month,
      day: cursor.day,
      hour: cursor.hour,
      minute: cursor.minute,
      second: cursor.second,
    };
    const matches = matchingInstants(candidate, timeZone);
    if (matches.length > 0) return matches[0]!;
  }
  throw new AppError('VALIDATION', 'Could not find a valid local time after DST gap', {
    details: { timeZone, reason: 'dst_gap_unresolved' },
  });
}

export function assertNotFutureInstant(instant: Instant, now: Instant, label: string): void {
  if (instant.epochMs > now.epochMs) {
    throw new AppError('VALIDATION', `${label} cannot be in the future`, {
      details: { reason: 'future' },
    });
  }
}
