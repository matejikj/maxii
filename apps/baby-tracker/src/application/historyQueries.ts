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
  const source: CareEvent[] = [];
  if (needle) {
    let before: TimelineCursor | null = null;
    // Search pages span the whole diary. A busy newer day must not hide this day.
    for (;;) {
      const page = await uow.search.search(query.childId, needle, 500, before);
      source.push(
        ...page.events.filter((event) => {
          const sortAt = careSortAtMs(event);
          return sortAt >= query.fromSortAtMsInclusive && sortAt < query.toSortAtMsExclusive;
        }),
      );
      const last = page.events[page.events.length - 1];
      if (!page.nextCursor || !last || careSortAtMs(last) < query.fromSortAtMsInclusive) break;
      before = page.nextCursor;
    }
  } else {
    source.push(
      ...(await uow.care.listInSortRange(
        query.childId,
        query.fromSortAtMsInclusive,
        query.toSortAtMsExclusive,
      )),
    );
  }
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
  // Scan bounded source pages until the visible page is full or the source ends.
  // A long run of other care types must not make an older matching record vanish.
  const fetchLimit = needsClientFilter ? Math.max(query.limit * 4, query.limit) : query.limit;
  const events: CareEvent[] = [];
  let before = query.before;
  for (;;) {
    const page = needle
      ? await uow.search.search(query.childId, needle, fetchLimit, before)
      : await uow.care.listPage(query.childId, fetchLimit, before);
    for (const event of page.events) {
      if (eventMatchesHistoryBucket(event, query.bucket, query.careSubtype)) events.push(event);
      if (events.length === query.limit) return { events, nextCursor: nextTimelineCursor(events) };
    }
    if (!page.nextCursor || page.events.length === 0) return { events, nextCursor: null };
    before = page.nextCursor;
  }
}

export async function loadDraftsForChild(uow: UnitOfWork, childId: ChildId): Promise<Draft[]> {
  return uow.drafts.listByChild(childId);
}

/** Soft-deleted care still within retention, newest first; optionally scoped to the selected child. */
export async function loadRestorableTrash(
  uow: UnitOfWork,
  nowEpochMs: number,
  childId?: ChildId,
): Promise<DeletionMarker[]> {
  const markers = await uow.revisions.listDeletions();
  return markers
    .filter(
      (marker) =>
        !marker.payloadPurged &&
        marker.payload != null &&
        marker.retainUntil.epochMs > nowEpochMs &&
        (childId == null || careEventFromTrashMarker(marker)?.childId === childId),
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
