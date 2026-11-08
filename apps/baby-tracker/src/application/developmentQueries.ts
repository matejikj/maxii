import type {
  CalendarDate,
  CareEvent,
  ChildId,
  ExperienceCareEvent,
  TimeZoneId,
  UnitOfWork,
  UnitOfWorkFactory,
  WeeklyDevelopmentGlance,
} from '../domain';
import {
  addCalendarDays,
  buildWeeklyDevelopmentGlance,
  careEventTouchesLocalDay,
  endOfCalendarDayExclusive,
  startOfCalendarDay,
} from '../domain';

export async function loadWeeklyDevelopmentGlance(
  unitOfWork: UnitOfWorkFactory,
  input: {
    childId: ChildId;
    endDay: CalendarDate;
    summaryTimeZone: TimeZoneId;
  },
): Promise<WeeklyDevelopmentGlance> {
  return unitOfWork.run(async (uow) => {
    const experiences = await loadWeekExperiences(uow, input);
    return buildWeeklyDevelopmentGlance({
      endDay: input.endDay,
      experiences,
    });
  });
}

export async function findTodaysExperienceForActivity(
  unitOfWork: UnitOfWorkFactory,
  input: {
    childId: ChildId;
    activityId: string;
    day: CalendarDate;
    summaryTimeZone: TimeZoneId;
  },
): Promise<ExperienceCareEvent | null> {
  return unitOfWork.run(async (uow) => {
    const events = await loadDayExperiences(uow, input);
    const matches = events.filter((event) => event.activityId === input.activityId);
    if (matches.length === 0) return null;
    return matches.sort((a, b) => b.occurredAt.instant.epochMs - a.occurredAt.instant.epochMs)[0]!;
  });
}

async function loadWeekExperiences(
  uow: UnitOfWork,
  input: {
    childId: ChildId;
    endDay: CalendarDate;
    summaryTimeZone: TimeZoneId;
  },
): Promise<ExperienceCareEvent[]> {
  const startDay = addCalendarDays(input.endDay, -6);
  const fromMs = startOfCalendarDay(startDay, input.summaryTimeZone).epochMs;
  const toMs = endOfCalendarDayExclusive(input.endDay, input.summaryTimeZone).epochMs;
  const rows = await uow.care.listInSortRange(input.childId, fromMs, toMs);
  return rows.filter((event): event is ExperienceCareEvent => {
    if (event.type !== 'experience') return false;
    for (let offset = 0; offset < 7; offset += 1) {
      const day = addCalendarDays(startDay, offset);
      if (careEventTouchesLocalDay(event, day, input.summaryTimeZone)) return true;
    }
    return false;
  });
}

async function loadDayExperiences(
  uow: UnitOfWork,
  input: {
    childId: ChildId;
    day: CalendarDate;
    summaryTimeZone: TimeZoneId;
  },
): Promise<ExperienceCareEvent[]> {
  const fromMs = startOfCalendarDay(input.day, input.summaryTimeZone).epochMs;
  const toMs = endOfCalendarDayExclusive(input.day, input.summaryTimeZone).epochMs;
  const rows = await uow.care.listInSortRange(input.childId, fromMs, toMs);
  return rows.filter(
    (event): event is ExperienceCareEvent =>
      event.type === 'experience' && careEventTouchesLocalDay(event, input.day, input.summaryTimeZone),
  );
}

export function isExperienceEvent(event: CareEvent): event is ExperienceCareEvent {
  return event.type === 'experience';
}
