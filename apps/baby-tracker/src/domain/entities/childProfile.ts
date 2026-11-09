import { AppError } from '../errors';
import type { ChildId } from '../ids';
import type { CalendarDate, TimeZoneId } from '../time';
import { asTimeZoneId } from '../time';

export type ChildProfileStatus = 'active' | 'archived';

export type ChildProfileSettings = {
  /** Zone used for personal day summaries; event detail keeps original zones. */
  summaryTimeZone: TimeZoneId;
};

export type ChildProfile = {
  childId: ChildId;
  displayName: string;
  birthDate: CalendarDate | null;
  settings: ChildProfileSettings;
  /**
   * Active profiles accept new care. Archived profiles stay readable in history
   * and export but cannot become the writing context until restored.
   */
  status: ChildProfileStatus;
  archivedAtMs: number | null;
};

export function createChildProfile(input: {
  childId: ChildId;
  displayName: string;
  birthDate?: CalendarDate | null;
  summaryTimeZone: string;
  status?: ChildProfileStatus;
  archivedAtMs?: number | null;
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
  const status = input.status ?? 'active';
  if (status === 'archived' && (input.archivedAtMs == null || input.archivedAtMs <= 0)) {
    throw new AppError('VALIDATION', 'Archived child requires an archive timestamp', {
      details: { reason: 'archive_time_required' },
    });
  }
  return {
    childId: input.childId,
    displayName,
    birthDate: input.birthDate ?? null,
    settings: {
      summaryTimeZone: asTimeZoneId(input.summaryTimeZone),
    },
    status,
    archivedAtMs: status === 'archived' ? (input.archivedAtMs ?? null) : null,
  };
}

/**
 * Older diaries stored profiles without status. Treat missing fields as the
 * original single active child so upgrades keep writing the same identity.
 */
export function normalizeChildProfile(raw: ChildProfile): ChildProfile {
  const status = raw.status === 'archived' ? 'archived' : 'active';
  return createChildProfile({
    childId: raw.childId,
    displayName: raw.displayName,
    birthDate: raw.birthDate ?? null,
    summaryTimeZone: raw.settings.summaryTimeZone,
    status,
    archivedAtMs: status === 'archived' ? (raw.archivedAtMs ?? 1) : null,
  });
}

export function isActiveChildProfile(profile: ChildProfile): boolean {
  return normalizeChildProfile(profile).status === 'active';
}
