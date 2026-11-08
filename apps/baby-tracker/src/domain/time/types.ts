import type { Instant } from '../ports/clock';

/** IANA zone id such as Europe/Prague; never a fixed UTC offset string alone. */
export type TimeZoneId = string & { readonly __brand: 'TimeZoneId' };

/**
 * Calendar day without a clock time. Birth dates and summary days use this so
 * a midnight timezone shift cannot invent a different birthday.
 */
export type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

/** How precisely the caregiver supplied the wall-clock values. */
export type TimePrecision = 'exact' | 'approximate' | 'unknown';

/**
 * A stored care instant: UTC epoch plus the zone observed at capture.
 * Display zone changes must not rewrite epochMs.
 */
export type ZonedInstant = {
  instant: Instant;
  timeZone: TimeZoneId;
  precision: TimePrecision;
};

/**
 * Half-open care interval [start, end). Unknown duration is a separate variant
 * so summaries never treat a missing end as zero minutes.
 */
export type KnownInterval = {
  kind: 'known';
  start: ZonedInstant;
  end: ZonedInstant;
};

export type UnknownDurationOccurrence = {
  kind: 'unknownDuration';
  observedAt: ZonedInstant;
};

export type CareOccurrence = KnownInterval | UnknownDurationOccurrence;

export type LocalWallTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
};

/**
 * Ambiguous local times at a DST fall-back need an explicit branch; missing
 * spring-forward times need an explicit gap policy.
 */
export type DstResolution =
  | { policy: 'reject' }
  | { policy: 'preferEarlier' }
  | { policy: 'preferLater' }
  | { policy: 'shiftForwardToValid' };
