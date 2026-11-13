import type {
  ActiveSession,
  CalendarDate,
  CareEvent,
  ChildId,
  DailyCareOverview,
  TimeZoneId,
  UnitOfWork,
  WeeklyCareOverview,
} from '../domain';
import {
  addCalendarDays,
  buildDailyCareOverview,
  buildWeeklyCareOverview,
  endOfCalendarDayExclusive,
  formatCalendarDate,
  startOfCalendarDay,
} from '../domain';

export type CareOverviewCache = {
  getDaily(key: string, compute: () => Promise<DailyCareOverview>): Promise<DailyCareOverview>;
  getWeekly(key: string, compute: () => Promise<WeeklyCareOverview>): Promise<WeeklyCareOverview>;
  /** Drop derived totals only — never touches durable care rows. */
  invalidate(): void;
};

/**
 * Rebuildable in-memory projection cache. A fault or care commit clears it so
 * the next read recomputes from committed diary rows.
 */
export function createCareOverviewCache(): CareOverviewCache {
  let daily = new Map<string, DailyCareOverview>();
  let weekly = new Map<string, WeeklyCareOverview>();
  return {
    async getDaily(key, compute) {
      const hit = daily.get(key);
      if (hit) return hit;
      const value = await compute();
      daily.set(key, value);
      return value;
    },
    async getWeekly(key, compute) {
      const hit = weekly.get(key);
      if (hit) return hit;
      const value = await compute();
      weekly.set(key, value);
      return value;
    },
    invalidate() {
      daily = new Map();
      weekly = new Map();
    },
  };
}

export async function loadDailyCareOverview(
  uow: UnitOfWork,
  input: {
    childId: ChildId;
    day: CalendarDate;
    summaryTimeZone: TimeZoneId;
    nowEpochMs: number;
    cache?: CareOverviewCache;
  },
): Promise<DailyCareOverview> {
  const key = `day:${input.childId}:${formatCalendarDate(input.day)}:${input.summaryTimeZone}`;
  const compute = async () => {
    const events = await loadOverviewEvents(
      uow,
      input.childId,
      input.day,
      input.day,
      input.summaryTimeZone,
    );
    const activeSessions = await loadActiveSessions(uow, input.childId);
    return buildDailyCareOverview({
      day: input.day,
      summaryTimeZone: input.summaryTimeZone,
      events,
      activeSessions,
      nowEpochMs: input.nowEpochMs,
    });
  };
  if (!input.cache) return compute();
  return input.cache.getDaily(key, compute);
}

export async function loadWeeklyCareOverview(
  uow: UnitOfWork,
  input: {
    childId: ChildId;
    endDay: CalendarDate;
    summaryTimeZone: TimeZoneId;
    nowEpochMs: number;
    cache?: CareOverviewCache;
  },
): Promise<WeeklyCareOverview> {
  const key = `week:${input.childId}:${formatCalendarDate(input.endDay)}:${input.summaryTimeZone}`;
  const compute = async () => {
    const startDay = addCalendarDays(input.endDay, -6);
    const events = await loadOverviewEvents(
      uow,
      input.childId,
      startDay,
      input.endDay,
      input.summaryTimeZone,
    );
    const activeSessions = await loadActiveSessions(uow, input.childId);
    return buildWeeklyCareOverview({
      endDay: input.endDay,
      summaryTimeZone: input.summaryTimeZone,
      events,
      activeSessions,
      nowEpochMs: input.nowEpochMs,
    });
  };
  if (!input.cache) return compute();
  return input.cache.getWeekly(key, compute);
}

/**
 * Pull a slightly wider sort window so overnight sleep/nursing that started
 * before the focus window still participates via day intersection.
 */
async function loadOverviewEvents(
  uow: UnitOfWork,
  childId: ChildId,
  fromDay: CalendarDate,
  toDay: CalendarDate,
  summaryTimeZone: TimeZoneId,
): Promise<CareEvent[]> {
  const fromMs = startOfCalendarDay(addCalendarDays(fromDay, -1), summaryTimeZone).epochMs;
  const toMs = endOfCalendarDayExclusive(toDay, summaryTimeZone).epochMs;
  return uow.care.listInSortRange(childId, fromMs, toMs);
}

async function loadActiveSessions(uow: UnitOfWork, childId: ChildId): Promise<ActiveSession[]> {
  const sleep = await uow.sessions.getActive(childId, 'sleep');
  const nursing = await uow.sessions.getActive(childId, 'nursing');
  return [sleep, nursing].filter((session): session is ActiveSession => session != null);
}
