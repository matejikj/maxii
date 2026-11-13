import type {
  BottleCareEvent,
  CareEvent,
  DiaperCareEvent,
  FoodCareEvent,
  GrowthCareEvent,
  NursingCareEvent,
  SleepCareEvent,
} from '../entities/careEvent';
import type { ActiveSession } from '../entities/activeSession';
import type { CalendarDate, TimeZoneId } from '../time';
import {
  addCalendarDays,
  calendarDateInZone,
  dayWindow,
  formatCalendarDate,
  intersectInterval,
  intersectWithLocalDay,
  knownInterval,
  toEpochInterval,
  zonedInstant,
} from '../time';
import { careSortAtMs } from './careTime';
import { buildGrowthSeries, type GrowthSeries } from './growthSeries';
import {
  summarizeBottles,
  summarizeDiapers,
  summarizeFood,
  summarizeNursing,
  summarizeSleepForDay,
  type BottleDaySummary,
  type DiaperDaySummary,
  type FoodDaySummary,
  type NursingDaySummary,
  type SleepDaySummary,
} from './careSummaries';

export type CareOverviewPeriod = 'day' | 'week';

export type IndicatorMeta = {
  unit: string;
  periodLabel: string;
  /** Civil day or week start used for the projection window. */
  focusDate: string;
  summaryTimeZone: TimeZoneId;
};

export type RunningCareIndicator = {
  sessionId: string;
  kind: 'sleep' | 'nursing';
  /** Elapsed so far inside the focus window; open end stays explicitly in progress. */
  recordedSoFarMs: number;
  incomplete: true;
};

export type TracedSummary<T> = {
  stats: T;
  sourceEventIds: string[];
};

export type DailyCareOverview = {
  period: 'day';
  meta: IndicatorMeta;
  sleep: TracedSummary<SleepDaySummary>;
  nursing: TracedSummary<NursingDaySummary>;
  bottles: TracedSummary<BottleDaySummary>;
  food: TracedSummary<FoodDaySummary>;
  diapers: TracedSummary<DiaperDaySummary>;
  growth: {
    series: GrowthSeries;
    sourceEventIds: string[];
  };
  running: RunningCareIndicator[];
};

export type WeeklyCareOverview = {
  period: 'week';
  meta: IndicatorMeta;
  /** Inclusive civil days covered by the week window ending on focusDate. */
  days: string[];
  sleep: TracedSummary<SleepDaySummary>;
  nursing: TracedSummary<NursingDaySummary>;
  bottles: TracedSummary<BottleDaySummary>;
  food: TracedSummary<FoodDaySummary>;
  diapers: TracedSummary<DiaperDaySummary>;
  growth: {
    series: GrowthSeries;
    sourceEventIds: string[];
  };
  running: RunningCareIndicator[];
};

/**
 * Whether a committed care row belongs in a local-day projection. Overnight
 * sleep/nursing still contributes when its interval crosses midnight, without
 * inventing a second stored event.
 */
export function careEventTouchesLocalDay(
  event: CareEvent,
  day: CalendarDate,
  summaryTimeZone: TimeZoneId,
): boolean {
  switch (event.type) {
    case 'sleep':
    case 'nursing': {
      if (event.occurrence.kind === 'known') {
        return intersectWithLocalDay(event.occurrence, day, summaryTimeZone) != null;
      }
      return datesEqual(
        calendarDateInZone(event.occurrence.observedAt.instant, summaryTimeZone),
        day,
      );
    }
    case 'growth':
      return datesEqual(calendarDateInZone(event.measuredOn.instant, summaryTimeZone), day);
    default: {
      const sortAt = careSortAtMs(event);
      const window = dayWindow(day, summaryTimeZone);
      return sortAt >= window.startMs && sortAt < window.endMs;
    }
  }
}

export function buildDailyCareOverview(input: {
  day: CalendarDate;
  summaryTimeZone: TimeZoneId;
  events: readonly CareEvent[];
  activeSessions?: readonly ActiveSession[];
  nowEpochMs?: number;
}): DailyCareOverview {
  const { day, summaryTimeZone } = input;
  const touching = input.events.filter((event) =>
    careEventTouchesLocalDay(event, day, summaryTimeZone),
  );
  const sleepEvents = touching.filter((event): event is SleepCareEvent => event.type === 'sleep');
  const nursingEvents = touching.filter(
    (event): event is NursingCareEvent => event.type === 'nursing',
  );
  const bottleEvents = touching.filter(
    (event): event is BottleCareEvent => event.type === 'bottle',
  );
  const foodEvents = touching.filter((event): event is FoodCareEvent => event.type === 'food');
  const diaperEvents = touching.filter(
    (event): event is DiaperCareEvent => event.type === 'diaper',
  );
  const growthEvents = touching.filter(
    (event): event is GrowthCareEvent => event.type === 'growth',
  );

  return {
    period: 'day',
    meta: {
      unit: 'local-day',
      periodLabel: 'Zaznamenaný den',
      focusDate: formatCalendarDate(day),
      summaryTimeZone,
    },
    sleep: {
      stats: summarizeSleepForDay(sleepEvents, day, summaryTimeZone),
      sourceEventIds: sleepEvents.map((event) => event.eventId),
    },
    nursing: {
      stats: summarizeNursing(nursingEvents),
      sourceEventIds: nursingEvents.map((event) => event.eventId),
    },
    bottles: {
      stats: summarizeBottles(bottleEvents),
      sourceEventIds: bottleEvents.map((event) => event.eventId),
    },
    food: {
      stats: summarizeFood(foodEvents),
      sourceEventIds: foodEvents.map((event) => event.eventId),
    },
    diapers: {
      stats: summarizeDiapers(diaperEvents),
      sourceEventIds: diaperEvents.map((event) => event.eventId),
    },
    growth: {
      series: buildGrowthSeries(growthEvents),
      sourceEventIds: growthEvents.map((event) => event.eventId),
    },
    running: runningIndicatorsForDay({
      day,
      summaryTimeZone,
      activeSessions: input.activeSessions ?? [],
      nowEpochMs: input.nowEpochMs ?? Date.now(),
    }),
  };
}

/**
 * Seven local days ending on focusDate (inclusive). Sleep totals sum per-day
 * intersections so a midnight-crossing nap is never double-counted.
 */
export function buildWeeklyCareOverview(input: {
  endDay: CalendarDate;
  summaryTimeZone: TimeZoneId;
  events: readonly CareEvent[];
  activeSessions?: readonly ActiveSession[];
  nowEpochMs?: number;
}): WeeklyCareOverview {
  const days: CalendarDate[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    days.push(addCalendarDays(input.endDay, -offset));
  }

  const daily = days.map((day) =>
    buildDailyCareOverview({
      day,
      summaryTimeZone: input.summaryTimeZone,
      events: input.events,
      ...(input.activeSessions != null ? { activeSessions: input.activeSessions } : {}),
      ...(input.nowEpochMs != null ? { nowEpochMs: input.nowEpochMs } : {}),
    }),
  );

  const sleepIds = uniqueIds(daily.flatMap((row) => row.sleep.sourceEventIds));
  const nursingEvents = uniqueEventsOfType(input.events, daily, 'nursing');
  const bottleEvents = uniqueEventsOfType(input.events, daily, 'bottle');
  const foodEvents = uniqueEventsOfType(input.events, daily, 'food');
  const diaperEvents = uniqueEventsOfType(input.events, daily, 'diaper');
  const growthEvents = uniqueEventsOfType(input.events, daily, 'growth');

  return {
    period: 'week',
    meta: {
      unit: 'local-7-days',
      periodLabel: 'Zaznamenaných 7 dní',
      focusDate: formatCalendarDate(input.endDay),
      summaryTimeZone: input.summaryTimeZone,
    },
    days: days.map(formatCalendarDate),
    sleep: {
      // Duration is the sum of day intersections; event counts stay unique.
      stats: {
        recordedIntervalMs: daily.reduce((sum, row) => sum + row.sleep.stats.recordedIntervalMs, 0),
        eventsWithKnownDuration: sleepIds.filter((id) =>
          input.events.some(
            (event) =>
              event.eventId === id && event.type === 'sleep' && event.occurrence.kind === 'known',
          ),
        ).length,
        eventsMissingDuration: countMissingSleep(input.events, sleepIds),
      },
      sourceEventIds: sleepIds,
    },
    nursing: {
      stats: summarizeNursing(nursingEvents as NursingCareEvent[]),
      sourceEventIds: nursingEvents.map((event) => event.eventId),
    },
    bottles: {
      stats: summarizeBottles(bottleEvents as BottleCareEvent[]),
      sourceEventIds: bottleEvents.map((event) => event.eventId),
    },
    food: {
      stats: summarizeFood(foodEvents as FoodCareEvent[]),
      sourceEventIds: foodEvents.map((event) => event.eventId),
    },
    diapers: {
      stats: summarizeDiapers(diaperEvents as DiaperCareEvent[]),
      sourceEventIds: diaperEvents.map((event) => event.eventId),
    },
    growth: {
      series: buildGrowthSeries(growthEvents as GrowthCareEvent[]),
      sourceEventIds: growthEvents.map((event) => event.eventId),
    },
    running: uniqueRunning(daily.flatMap((row) => row.running)),
  };
}

function uniqueEventsOfType(
  events: readonly CareEvent[],
  daily: readonly DailyCareOverview[],
  type: CareEvent['type'],
): CareEvent[] {
  const ids = new Set(
    daily.flatMap((row) => {
      switch (type) {
        case 'nursing':
          return row.nursing.sourceEventIds;
        case 'bottle':
          return row.bottles.sourceEventIds;
        case 'food':
          return row.food.sourceEventIds;
        case 'diaper':
          return row.diapers.sourceEventIds;
        case 'growth':
          return row.growth.sourceEventIds;
        case 'sleep':
          return row.sleep.sourceEventIds;
        default:
          return [];
      }
    }),
  );
  return events.filter((event) => event.type === type && ids.has(event.eventId));
}

function runningIndicatorsForDay(input: {
  day: CalendarDate;
  summaryTimeZone: TimeZoneId;
  activeSessions: readonly ActiveSession[];
  nowEpochMs: number;
}): RunningCareIndicator[] {
  const window = dayWindow(input.day, input.summaryTimeZone);
  const out: RunningCareIndicator[] = [];
  for (const session of input.activeSessions) {
    if (session.status !== 'running' && session.status !== 'paused') continue;
    const openEndMs =
      session.status === 'running' ? input.nowEpochMs : session.pausedAt.instant.epochMs;
    const openInterval = knownInterval(
      session.startedAt,
      zonedInstant(
        { epochMs: Math.max(openEndMs, session.startedAt.instant.epochMs) },
        input.summaryTimeZone,
      ),
    );
    const part = intersectInterval(toEpochInterval(openInterval), window);
    if (!part) continue;
    out.push({
      sessionId: session.sessionId,
      kind: session.kind,
      recordedSoFarMs: Math.max(0, part.endMs - part.startMs),
      incomplete: true,
    });
  }
  return out;
}

function datesEqual(a: CalendarDate, b: CalendarDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

function uniqueRunning(rows: readonly RunningCareIndicator[]): RunningCareIndicator[] {
  const byId = new Map<string, RunningCareIndicator>();
  for (const row of rows) {
    const previous = byId.get(row.sessionId);
    if (!previous || row.recordedSoFarMs > previous.recordedSoFarMs) {
      byId.set(row.sessionId, row);
    }
  }
  return [...byId.values()];
}

function countMissingSleep(events: readonly CareEvent[], sleepIds: readonly string[]): number {
  let missing = 0;
  for (const id of sleepIds) {
    const event = events.find((row) => row.eventId === id);
    if (event && event.type === 'sleep' && event.occurrence.kind === 'unknownDuration') {
      missing += 1;
    }
  }
  return missing;
}
