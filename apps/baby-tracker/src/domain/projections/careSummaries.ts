import type {
  BottleCareEvent,
  DiaperCareEvent,
  FoodCareEvent,
  NursingCareEvent,
  SleepCareEvent,
} from '../entities/careEvent';
import { diaperCountContribution } from '../entities/careEvent';
import type { CalendarDate, TimeZoneId } from '../time';
import {
  durationMs,
  intersectWithLocalDay,
  nursingActiveDurationMs,
  totalUnionDurationMs,
  toEpochInterval,
} from '../time';

export type BottleDaySummary = {
  recordedMl: number;
  feedingsWithAmount: number;
  feedingsMissingAmount: number;
};

export type NursingDaySummary = {
  /** Sum of active nursing segments only — pauses never contribute. */
  recordedActiveMs: number;
  eventsWithKnownDuration: number;
  eventsMissingDuration: number;
};

export type FoodDaySummary = {
  events: number;
  eventsWithAmount: number;
  eventsMissingAmount: number;
};

export type SleepDaySummary = {
  /** Union of known intervals intersecting the day; unknown-duration sleeps excluded. */
  recordedIntervalMs: number;
  eventsWithKnownDuration: number;
  eventsMissingDuration: number;
};

export type DiaperDaySummary = {
  diapers: number;
  wet: number;
  dirty: number;
};

/**
 * Bottle ml totals ignore unknown amounts. Zero is included when the caregiver
 * explicitly recorded an empty bottle; null never becomes zero here.
 */
export function summarizeBottles(events: readonly BottleCareEvent[]): BottleDaySummary {
  let recordedMl = 0;
  let feedingsWithAmount = 0;
  let feedingsMissingAmount = 0;
  for (const event of events) {
    if (event.amount == null) {
      feedingsMissingAmount += 1;
      continue;
    }
    if (event.amount.unit !== 'ml') continue;
    feedingsWithAmount += 1;
    recordedMl += event.amount.value;
  }
  return { recordedMl, feedingsWithAmount, feedingsMissingAmount };
}

export function summarizeSleepForDay(
  events: readonly SleepCareEvent[],
  day: CalendarDate,
  summaryTimeZone: TimeZoneId,
): SleepDaySummary {
  const knownParts = [];
  let eventsWithKnownDuration = 0;
  let eventsMissingDuration = 0;
  for (const event of events) {
    if (event.occurrence.kind === 'unknownDuration') {
      eventsMissingDuration += 1;
      continue;
    }
    eventsWithKnownDuration += 1;
    const part = intersectWithLocalDay(event.occurrence, day, summaryTimeZone);
    if (part) knownParts.push(part);
  }
  return {
    recordedIntervalMs: totalUnionDurationMs(knownParts),
    eventsWithKnownDuration,
    eventsMissingDuration,
  };
}

export function summarizeDiapers(events: readonly DiaperCareEvent[]): DiaperDaySummary {
  let diapers = 0;
  let wet = 0;
  let dirty = 0;
  for (const event of events) {
    const part = diaperCountContribution(event);
    diapers += part.diapers;
    wet += part.wet;
    dirty += part.dirty;
  }
  return { diapers, wet, dirty };
}

/**
 * Nursing minutes stay separate from bottle ml and food counts — never merge into
 * a single “intake” total.
 */
export function summarizeNursing(events: readonly NursingCareEvent[]): NursingDaySummary {
  let recordedActiveMs = 0;
  let eventsWithKnownDuration = 0;
  let eventsMissingDuration = 0;
  for (const event of events) {
    if (event.occurrence.kind === 'unknownDuration' || event.activeSegments == null) {
      eventsMissingDuration += 1;
      continue;
    }
    eventsWithKnownDuration += 1;
    recordedActiveMs += nursingActiveDurationMs(event.activeSegments);
  }
  return { recordedActiveMs, eventsWithKnownDuration, eventsMissingDuration };
}

/** Food amounts keep their recorded units; this tally never converts them to ml. */
export function summarizeFood(events: readonly FoodCareEvent[]): FoodDaySummary {
  let eventsWithAmount = 0;
  let eventsMissingAmount = 0;
  for (const event of events) {
    if (event.amount == null) eventsMissingAmount += 1;
    else eventsWithAmount += 1;
  }
  return {
    events: events.length,
    eventsWithAmount,
    eventsMissingAmount,
  };
}

export function knownSleepDurationMs(event: SleepCareEvent): number | null {
  if (event.occurrence.kind === 'unknownDuration') return null;
  return durationMs(toEpochInterval(event.occurrence));
}

export function knownNursingActiveMs(event: NursingCareEvent): number | null {
  if (event.occurrence.kind === 'unknownDuration' || event.activeSegments == null) return null;
  return nursingActiveDurationMs(event.activeSegments);
}
