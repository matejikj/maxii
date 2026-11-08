import type { ExperienceCareEvent } from '../entities/careEvent';
import type { CalendarDate } from '../time';
import { formatCalendarDate } from '../time';

export type WeeklyGlanceStatement = {
  code: string;
  textCs: string;
  /** Event ids that justify the statement — never a psychological claim. */
  evidenceEventIds: string[];
};

export type WeeklyDevelopmentGlance = {
  weekEndDay: string;
  experienceCount: number;
  statements: WeeklyGlanceStatement[];
  /** True when there is too little data for any descriptive claim. */
  insufficientData: boolean;
};

/**
 * Descriptive weekly glance from recorded experiences only. Sparse weeks stay
 * silent or limited — never invent interest, talent, or developmental scores.
 * Callers pass experiences already scoped to the local week.
 */
export function buildWeeklyDevelopmentGlance(input: {
  endDay: CalendarDate;
  experiences: ExperienceCareEvent[];
}): WeeklyDevelopmentGlance {
  const experiences = input.experiences;

  if (experiences.length === 0) {
    return {
      weekEndDay: formatCalendarDate(input.endDay),
      experienceCount: 0,
      statements: [],
      insufficientData: true,
    };
  }

  const statements: WeeklyGlanceStatement[] = [
    {
      code: 'count',
      textCs: `Tento týden jste zaznamenali ${experiences.length} ${czechExperienceWord(experiences.length)}.`,
      evidenceEventIds: experiences.map((event) => event.eventId),
    },
  ];

  const liked = experiences.filter((event) => event.reaction === 'liked');
  if (liked.length > 0) {
    statements.push({
      code: 'liked',
      textCs:
        liked.length === 1
          ? 'U jedné hry jste označili Zaujalo.'
          : `U těchto ${liked.length} her jste označili Zaujalo.`,
      evidenceEventIds: liked.map((event) => event.eventId),
    });
  }

  const areas = [...new Set(experiences.map((event) => event.area).filter(Boolean))];
  if (areas.length >= 2) {
    statements.push({
      code: 'areas',
      textCs: 'Objevovali jste více než jednu oblast.',
      evidenceEventIds: experiences
        .filter((event) => event.area != null)
        .map((event) => event.eventId),
    });
  }

  return {
    weekEndDay: formatCalendarDate(input.endDay),
    experienceCount: experiences.length,
    statements,
    insufficientData: false,
  };
}

function czechExperienceWord(count: number): string {
  if (count === 1) return 'zkušenost';
  if (count >= 2 && count <= 4) return 'zkušenosti';
  return 'zkušeností';
}
