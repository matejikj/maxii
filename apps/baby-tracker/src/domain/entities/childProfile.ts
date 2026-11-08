import { AppError } from '../errors';
import type { ChildId } from '../ids';
import type { CalendarDate, TimeZoneId } from '../time';
import { asTimeZoneId } from '../time';

export type ChildProfileSettings = {
  /** Zone used for personal day summaries; event detail keeps original zones. */
  summaryTimeZone: TimeZoneId;
};

export type ChildProfile = {
  childId: ChildId;
  displayName: string;
  birthDate: CalendarDate | null;
  settings: ChildProfileSettings;
};

export function createChildProfile(input: {
  childId: ChildId;
  displayName: string;
  birthDate?: CalendarDate | null;
  summaryTimeZone: string;
}): ChildProfile {
  const displayName = input.displayName.trim();
  if (displayName.length === 0) {
    throw new AppError('VALIDATION', 'Child display name is required', {
      details: { reason: 'empty_name' },
    });
  }
  if (displayName.length > 80) {
    throw new AppError('VALIDATION', 'Child display name is too long', {
      details: { reason: 'name_length' },
    });
  }
  return {
    childId: input.childId,
    displayName,
    birthDate: input.birthDate ?? null,
    settings: {
      summaryTimeZone: asTimeZoneId(input.summaryTimeZone),
    },
  };
}
