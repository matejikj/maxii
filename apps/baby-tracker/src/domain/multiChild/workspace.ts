import { AppError } from '../errors';
import type { ChildId } from '../ids';
import {
  createChildProfile,
  isActiveChildProfile,
  normalizeChildProfile,
  type ChildProfile,
} from '../entities/childProfile';
import type { CareEvent } from '../entities/careEvent';
import type { Draft } from '../entities/draft';
import type { SessionRecord } from '../entities/activeSession';
import type { DiaryArchive } from '../backup/diaryArchive';
import { createDiaryArchive } from '../backup/diaryArchive';

export const META_CHILD_AVATAR_PREFIX = 'pref_baby_avatar_v1:';

export type ChildContextBinding = {
  /** Child the open form or draft was started for — never silent-rewritten. */
  boundChildId: ChildId;
  boundDisplayName: string;
  /** Currently selected writing context in the shell. */
  activeChildId: ChildId;
  contextDiverged: boolean;
};

export type ActiveSessionStripItem = {
  session: SessionRecord;
  childId: ChildId;
  displayName: string;
};

export type DiaryExportScope =
  | { kind: 'all_children' }
  | { kind: 'one_child'; childId: ChildId };

/**
 * Prefer the stored active id when it still names an active profile. Otherwise
 * fall back to the first active child, then any remaining profile. Empty lists
 * stay empty so bootstrap can mint the first Miminko.
 */
export function resolveActiveChildProfile(
  profiles: readonly ChildProfile[],
  activeChildId: string | null,
): ChildProfile | null {
  const normalized = profiles.map(normalizeChildProfile);
  if (normalized.length === 0) return null;
  if (activeChildId) {
    const byMeta = normalized.find((profile) => profile.childId === activeChildId);
    if (byMeta && isActiveChildProfile(byMeta)) return byMeta;
  }
  const firstActive = normalized.find(isActiveChildProfile);
  if (firstActive) return firstActive;
  return normalized[0] ?? null;
}

export function listActiveChildProfiles(profiles: readonly ChildProfile[]): ChildProfile[] {
  return profiles.map(normalizeChildProfile).filter(isActiveChildProfile);
}

export function planAddChildProfile(input: {
  profiles: readonly ChildProfile[];
  childId: ChildId;
  displayName: string;
  birthDate?: ChildProfile['birthDate'];
  summaryTimeZone: string;
}): { profile: ChildProfile; nextActiveChildId: ChildId } {
  const normalized = input.profiles.map(normalizeChildProfile);
  if (normalized.some((profile) => profile.childId === input.childId)) {
    throw new AppError('CONFLICT', 'Child profile id already exists', {
      details: { reason: 'child_exists' },
    });
  }
  const profile = createChildProfile({
    childId: input.childId,
    displayName: input.displayName,
    birthDate: input.birthDate ?? null,
    summaryTimeZone: input.summaryTimeZone,
    status: 'active',
  });
  return { profile, nextActiveChildId: profile.childId };
}

/**
 * Keep at least one active child so care entry never loses a writing context.
 * Archived profiles remain in the diary for history and scoped export.
 */
export function planArchiveChildProfile(input: {
  profiles: readonly ChildProfile[];
  childId: ChildId;
  archivedAtMs: number;
  activeChildId: string | null;
}): {
  archived: ChildProfile;
  nextActiveChildId: ChildId;
} {
  const normalized = input.profiles.map(normalizeChildProfile);
  const target = normalized.find((profile) => profile.childId === input.childId);
  if (!target) {
    throw new AppError('NOT_FOUND', 'Child profile was not found', {
      details: { reason: 'profile_missing' },
    });
  }
  if (!isActiveChildProfile(target)) {
    throw new AppError('CONFLICT', 'Child profile is already archived', {
      details: { reason: 'already_archived' },
    });
  }
  const remainingActive = normalized.filter(
    (profile) => profile.childId !== input.childId && isActiveChildProfile(profile),
  );
  if (remainingActive.length === 0) {
    throw new AppError('VALIDATION', 'At least one active child must remain', {
      details: { reason: 'last_active_child' },
    });
  }
  const archived = createChildProfile({
    childId: target.childId,
    displayName: target.displayName,
    birthDate: target.birthDate,
    summaryTimeZone: target.settings.summaryTimeZone,
    status: 'archived',
    archivedAtMs: input.archivedAtMs,
  });
  const nextActive =
    input.activeChildId === input.childId
      ? remainingActive[0]!
      : resolveActiveChildProfile(
          normalized.map((profile) =>
            profile.childId === input.childId ? archived : profile,
          ),
          input.activeChildId,
        );
  if (!nextActive) {
    throw new AppError('INTERNAL', 'Active child resolution failed after archive', {
      details: { reason: 'active_missing' },
    });
  }
  return { archived, nextActiveChildId: nextActive.childId };
}

export function planSwitchActiveChild(input: {
  profiles: readonly ChildProfile[];
  childId: ChildId;
}): ChildProfile {
  const normalized = input.profiles.map(normalizeChildProfile);
  const target = normalized.find((profile) => profile.childId === input.childId);
  if (!target) {
    throw new AppError('NOT_FOUND', 'Child profile was not found', {
      details: { reason: 'profile_missing' },
    });
  }
  if (!isActiveChildProfile(target)) {
    throw new AppError('VALIDATION', 'Archived child cannot become the writing context', {
      details: { reason: 'archived_not_writable' },
    });
  }
  return target;
}

/**
 * An open form stays bound to the child it was opened for. Switching the shell
 * context must surface the divergence instead of rewriting the draft childId.
 */
export function bindOpenFormToChild(input: {
  boundChildId: ChildId;
  boundDisplayName: string;
  activeChildId: ChildId;
}): ChildContextBinding {
  return {
    boundChildId: input.boundChildId,
    boundDisplayName: input.boundDisplayName,
    activeChildId: input.activeChildId,
    contextDiverged: input.boundChildId !== input.activeChildId,
  };
}

export function assertDraftChildUnchanged(draft: Draft, expectedChildId: ChildId): void {
  if (draft.childId !== expectedChildId) {
    throw new AppError('CONFLICT', 'Draft belongs to a different child', {
      details: {
        reason: 'draft_child_mismatch',
        draftChildId: draft.childId,
        expectedChildId,
      },
    });
  }
}

export function listActiveSessionsForStrip(input: {
  sessions: readonly SessionRecord[];
  profiles: readonly ChildProfile[];
}): ActiveSessionStripItem[] {
  const byId = new Map(
    input.profiles.map(normalizeChildProfile).map((profile) => [profile.childId, profile]),
  );
  return input.sessions
    .filter((session) => session.status === 'running' || session.status === 'paused')
    .map((session) => {
      const profile = byId.get(session.childId);
      return {
        session,
        childId: session.childId,
        displayName: profile?.displayName ?? 'Dítě',
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'cs') || a.childId.localeCompare(b.childId));
}

export function planCareEventReassignment(input: {
  event: CareEvent;
  targetChildId: ChildId;
  profiles: readonly ChildProfile[];
}): { fromChildId: ChildId; toChildId: ChildId; sameChild: boolean } {
  const target = input.profiles
    .map(normalizeChildProfile)
    .find((profile) => profile.childId === input.targetChildId);
  if (!target) {
    throw new AppError('NOT_FOUND', 'Target child profile was not found', {
      details: { reason: 'target_profile_missing' },
    });
  }
  if (!isActiveChildProfile(target)) {
    throw new AppError('VALIDATION', 'Cannot reassign care to an archived child', {
      details: { reason: 'target_archived' },
    });
  }
  return {
    fromChildId: input.event.childId,
    toChildId: target.childId,
    sameChild: input.event.childId === target.childId,
  };
}

/**
 * Scoped portable export must never silently include a second child's rows.
 * Whole-family scope keeps every profile and row exactly as captured.
 */
export function filterDiaryArchiveByScope(
  archive: DiaryArchive,
  scope: DiaryExportScope,
): DiaryArchive {
  if (scope.kind === 'all_children') {
    return archive;
  }
  const childId = scope.childId;
  const profiles = archive.profiles
    .map(normalizeChildProfile)
    .filter((profile) => profile.childId === childId);
  if (profiles.length === 0) {
    throw new AppError('NOT_FOUND', 'Export scope child was not found in the diary', {
      details: { reason: 'export_child_missing' },
    });
  }
  const careEvents = archive.careEvents.filter((event) => event.childId === childId);
  const sessions = archive.sessions.filter((session) => session.childId === childId);
  const drafts = archive.drafts.filter((draft) => draft.childId === childId);
  const entityIds = new Set<string>([
    ...careEvents.map((event) => event.eventId),
    ...sessions.map((session) => session.sessionId),
    ...drafts.map((draft) => draft.draftId),
    childId,
  ]);
  const revisions = archive.revisions.filter((revision) => entityIds.has(revision.entityId));
  const revisionIds = new Set(revisions.map((revision) => revision.revisionId));
  const receipts = archive.receipts.filter((receipt) =>
    receipt.entityIds.some((id) => entityIds.has(id)),
  );
  const deletions = archive.deletions.filter(
    (deletion) => entityIds.has(deletion.entityId) || revisionIds.has(deletion.revisionId),
  );
  const meta = archive.meta.filter((entry) => {
    if (entry.key === 'active_child_id') return entry.value === childId;
    if (entry.key.startsWith(META_CHILD_AVATAR_PREFIX)) return entry.key === `${META_CHILD_AVATAR_PREFIX}${childId}`;
    return true;
  });
  return createDiaryArchive({
    createdAtMs: archive.manifest.createdAtMs,
    schemaCompatibility: archive.manifest.schemaCompatibility,
    profiles,
    careEvents,
    sessions,
    drafts,
    revisions,
    receipts,
    deletions,
    meta: [
      ...meta.filter((entry) => entry.key !== 'active_child_id'),
      { key: 'active_child_id', value: childId },
    ],
  });
}

/**
 * Single-child diaries keep the same childId when multi-child support appears.
 * Adding a second child must not rewrite historical event childIds.
 */
export function assertSingleChildMigrationPreserved(input: {
  beforeChildId: ChildId;
  afterProfiles: readonly ChildProfile[];
  afterCareChildIds: readonly ChildId[];
}): void {
  const after = input.afterProfiles.map(normalizeChildProfile);
  if (!after.some((profile) => profile.childId === input.beforeChildId)) {
    throw new AppError('INTERNAL', 'Original child identity was rewritten', {
      details: { reason: 'child_id_changed' },
    });
  }
  for (const childId of input.afterCareChildIds) {
    if (!after.some((profile) => profile.childId === childId)) {
      throw new AppError('INTERNAL', 'Care row points at an unknown child', {
        details: { reason: 'orphan_care_child' },
      });
    }
  }
}
