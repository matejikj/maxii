import type { CareEvent } from '../entities/careEvent';
import type { SessionRecord } from '../entities/activeSession';
import type { ChildProfile } from '../entities/childProfile';
import type { Draft } from '../entities/draft';
import type { DeletionMarker, OperationReceipt, Revision } from '../entities/revision';
import { careSortAtMs } from '../projections/careTime';

/** Logical personal diary archive — sealed separately; never carries auth tokens. */
export const DIARY_ARCHIVE_FORMAT = 'lumi.diary-archive.v1' as const;

/** Archives above this schema id need a newer app; older ids remain readable. */
export const DIARY_ARCHIVE_MAX_COMPAT = 8;

export type DiaryArchiveManifest = {
  createdAtMs: number;
  schemaCompatibility: number;
  childId: string | null;
  displayName: string | null;
  careEventCount: number;
  draftCount: number;
  deletionCount: number;
  sessionCount: number;
  newestCareSortAtMs: number | null;
  oldestCareSortAtMs: number | null;
};

export type DiaryArchiveMetaEntry = {
  key: string;
  value: string;
};

/**
 * Cross-platform logical snapshot. Device keys and family sync state must never
 * appear here — only the personal diary the caregiver can recover offline.
 */
export type DiaryArchive = {
  format: typeof DIARY_ARCHIVE_FORMAT;
  manifest: DiaryArchiveManifest;
  profiles: ChildProfile[];
  careEvents: CareEvent[];
  sessions: SessionRecord[];
  drafts: Draft[];
  revisions: Revision[];
  receipts: OperationReceipt[];
  deletions: DeletionMarker[];
  meta: DiaryArchiveMetaEntry[];
};

export type DiaryArchiveCompare = {
  current: DiaryArchiveManifest;
  incoming: DiaryArchiveManifest;
  newerLocalCareEvents: number;
  replacesLiveDiary: true;
  merges: false;
};

export function buildDiaryArchiveManifest(
  archive: Omit<DiaryArchive, 'manifest' | 'format'> & { createdAtMs: number; schemaCompatibility: number },
): DiaryArchiveManifest {
  const primary = archive.profiles[0] ?? null;
  let newest: number | null = null;
  let oldest: number | null = null;
  for (const event of archive.careEvents) {
    const sortAt = careSortAtMs(event);
    newest = newest == null ? sortAt : Math.max(newest, sortAt);
    oldest = oldest == null ? sortAt : Math.min(oldest, sortAt);
  }
  return {
    createdAtMs: archive.createdAtMs,
    schemaCompatibility: archive.schemaCompatibility,
    childId: primary?.childId ?? null,
    displayName: primary?.displayName ?? null,
    careEventCount: archive.careEvents.length,
    draftCount: archive.drafts.length,
    deletionCount: archive.deletions.length,
    sessionCount: archive.sessions.length,
    newestCareSortAtMs: newest,
    oldestCareSortAtMs: oldest,
  };
}

export function createDiaryArchive(input: {
  createdAtMs: number;
  schemaCompatibility: number;
  profiles: ChildProfile[];
  careEvents: CareEvent[];
  sessions: SessionRecord[];
  drafts: Draft[];
  revisions: Revision[];
  receipts: OperationReceipt[];
  deletions: DeletionMarker[];
  meta: DiaryArchiveMetaEntry[];
}): DiaryArchive {
  const body = {
    createdAtMs: input.createdAtMs,
    schemaCompatibility: input.schemaCompatibility,
    profiles: input.profiles,
    careEvents: input.careEvents,
    sessions: input.sessions,
    drafts: input.drafts,
    revisions: input.revisions,
    receipts: input.receipts,
    deletions: input.deletions,
    meta: input.meta,
  };
  return {
    format: DIARY_ARCHIVE_FORMAT,
    manifest: buildDiaryArchiveManifest(body),
    profiles: body.profiles,
    careEvents: body.careEvents,
    sessions: body.sessions,
    drafts: body.drafts,
    revisions: body.revisions,
    receipts: body.receipts,
    deletions: body.deletions,
    meta: body.meta,
  };
}

/**
 * Personal import replaces the live diary. Count how many current care rows are
 * newer than the archive tip so the caregiver sees what would be discarded.
 */
export function compareDiaryArchives(
  current: DiaryArchive,
  incoming: DiaryArchive,
): DiaryArchiveCompare {
  const tip = incoming.manifest.newestCareSortAtMs;
  let newerLocalCareEvents = 0;
  if (tip != null) {
    for (const event of current.careEvents) {
      if (careSortAtMs(event) > tip) newerLocalCareEvents += 1;
    }
  } else {
    newerLocalCareEvents = current.careEvents.length;
  }
  return {
    current: current.manifest,
    incoming: incoming.manifest,
    newerLocalCareEvents,
    replacesLiveDiary: true,
    merges: false,
  };
}
