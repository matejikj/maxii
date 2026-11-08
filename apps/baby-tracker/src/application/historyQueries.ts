import type {
  CareEvent,
  CareSubtype,
  ChildId,
  DeletionMarker,
  Draft,
  HistoryBucket,
  SoftDeletedCarePayload,
  TimelineCursor,
  UnitOfWork,
} from '../domain';
import { careSortAtMs } from '../domain/projections/careTime';
import {
  eventMatchesHistoryBucket,
  nextTimelineCursor,
  normalizeSearchText,
} from '../domain/projections/historyQuery';

export type HistoryDayQuery = {
  childId: ChildId;
  fromSortAtMsInclusive: number;
  toSortAtMsExclusive: number;
  bucket: HistoryBucket;
  careSubtype: CareSubtype | null;
  searchQuery: string;
};

export type HistoryPageQuery = {
  childId: ChildId;
  bucket: HistoryBucket;
  careSubtype: CareSubtype | null;
  searchQuery: string;
  limit: number;
  before: TimelineCursor | null;
};

/**
 * Day timeline from committed care only. Drafts and trash stay in their own
 * lists so an empty filtered day never looks like a wiped diary.
 */
export async function loadHistoryDay(
  uow: UnitOfWork,
  query: HistoryDayQuery,
): Promise<CareEvent[]> {
  const needle = normalizeSearchText(query.searchQuery);
  const source = needle
    ? (await uow.search.search(query.childId, needle, 500, null)).events.filter((event) => {
        const sortAt = careSortAtMs(event);
        return sortAt >= query.fromSortAtMsInclusive && sortAt < query.toSortAtMsExclusive;
      })
    : await uow.care.listInSortRange(
        query.childId,
        query.fromSortAtMsInclusive,
        query.toSortAtMsExclusive,
      );
  return source.filter((event) =>
    eventMatchesHistoryBucket(event, query.bucket, query.careSubtype),
  );
}

export async function loadHistoryPage(
  uow: UnitOfWork,
  query: HistoryPageQuery,
): Promise<{ events: CareEvent[]; nextCursor: TimelineCursor | null }> {
  const needle = normalizeSearchText(query.searchQuery);
  const needsClientFilter = query.bucket !== 'all' || query.careSubtype != null;
  // Over-fetch when subtype/bucket filters apply so a dense day of other types
  // cannot starve the visible page.
  const fetchLimit = needsClientFilter ? Math.max(query.limit * 4, query.limit) : query.limit;
  const page = needle
    ? await uow.search.search(query.childId, needle, fetchLimit, query.before)
    : await uow.care.listPage(query.childId, fetchLimit, query.before);
  const events = page.events
    .filter((event) => eventMatchesHistoryBucket(event, query.bucket, query.careSubtype))
    .slice(0, query.limit);
  return {
    events,
    nextCursor: events.length < query.limit ? null : nextTimelineCursor(events),
  };
}

export async function loadDraftsForChild(uow: UnitOfWork, childId: ChildId): Promise<Draft[]> {
  return uow.drafts.listByChild(childId);
}

/** Soft-deleted care still within retention, newest first. */
export async function loadRestorableTrash(
  uow: UnitOfWork,
  nowEpochMs: number,
): Promise<DeletionMarker[]> {
  const markers = await uow.revisions.listDeletions();
  return markers
    .filter(
      (marker) =>
        !marker.payloadPurged &&
        marker.payload != null &&
        marker.retainUntil.epochMs > nowEpochMs,
    )
    .sort((a, b) => b.deletedAt.epochMs - a.deletedAt.epochMs);
}

export function careEventFromTrashMarker(marker: DeletionMarker): CareEvent | null {
  const payload = marker.payload as SoftDeletedCarePayload | null;
  if (!payload || payload.kind !== 'careEvent') return null;
  return payload.event;
}

export async function rebuildSearchIndex(uow: UnitOfWork, childId: ChildId): Promise<number> {
  return uow.search.rebuildForChild(childId);
}
