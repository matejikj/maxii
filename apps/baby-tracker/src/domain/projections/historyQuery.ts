import type { CareEvent, CareEventType } from '../entities/careEvent';
import type { Draft } from '../entities/draft';
import type { DeletionMarker } from '../entities/revision';
import { careSortAtMs } from './careTime';

/**
 * Care-time ordering with a stable id tie-break so two events at the same
 * instant never swap when a third row is inserted nearby.
 */
export function compareCareTimelineDesc(a: CareEvent, b: CareEvent): number {
  const sortDelta = careSortAtMs(b) - careSortAtMs(a);
  if (sortDelta !== 0) return sortDelta;
  return b.eventId < a.eventId ? -1 : b.eventId > a.eventId ? 1 : 0;
}

export function compareCareTimelineAsc(a: CareEvent, b: CareEvent): number {
  return -compareCareTimelineDesc(a, b);
}

export type HistoryBucket = 'all' | 'care' | 'activities' | 'notes';

export type CareSubtype =
  | 'diaper'
  | 'sleep'
  | 'nursing'
  | 'bottle'
  | 'food'
  | 'growth';

export function eventMatchesHistoryBucket(
  event: CareEvent,
  bucket: HistoryBucket,
  careSubtype: CareSubtype | null = null,
): boolean {
  switch (bucket) {
    case 'all':
      return true;
    case 'care': {
      const isCare =
        event.type === 'diaper' ||
        event.type === 'sleep' ||
        event.type === 'nursing' ||
        event.type === 'bottle' ||
        event.type === 'food' ||
        event.type === 'growth';
      if (!isCare) return false;
      if (careSubtype == null) return true;
      return event.type === careSubtype;
    }
    case 'activities':
      return event.type === 'experience';
    case 'notes':
      return event.type === 'note' || event.type === 'milestone';
  }
}

/** Lowercased searchable text; never sent to analytics — local diary only. */
export function searchableTextFromCareEvent(event: CareEvent): string {
  const parts: string[] = [event.type];
  if (event.note) parts.push(event.note);
  switch (event.type) {
    case 'note':
    case 'milestone':
      parts.push(event.body);
      break;
    case 'experience':
      if (event.title) parts.push(event.title);
      if (event.area) parts.push(event.area);
      break;
    case 'food':
      parts.push(event.description);
      break;
    case 'bottle':
      parts.push(event.contents);
      break;
    case 'diaper':
      parts.push(event.contents);
      break;
    default:
      break;
  }
  return normalizeSearchText(parts.join(' '));
}

export function normalizeSearchText(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchesLocalSearch(haystack: string, query: string): boolean {
  const needle = normalizeSearchText(query);
  if (!needle) return true;
  return haystack.includes(needle);
}

export type SearchDocument = {
  entityId: string;
  childId: string;
  sortAtMs: number;
  docType: CareEventType;
  textNormalized: string;
};

export function searchDocumentFromCareEvent(event: CareEvent): SearchDocument {
  return {
    entityId: event.eventId,
    childId: event.childId,
    sortAtMs: careSortAtMs(event),
    docType: event.type,
    textNormalized: searchableTextFromCareEvent(event),
  };
}

/**
 * Cursor for dense timelines: exclusive upper bound on (sortAtMs, eventId)
 * descending pages so inserts above the cursor never skip a row below.
 */
export type TimelineCursor = {
  sortAtMs: number;
  eventId: string;
};

export function isBeforeTimelineCursor(
  sortAtMs: number,
  eventId: string,
  cursor: TimelineCursor | null,
): boolean {
  if (cursor == null) return true;
  if (sortAtMs < cursor.sortAtMs) return true;
  if (sortAtMs > cursor.sortAtMs) return false;
  return eventId < cursor.eventId;
}

export function nextTimelineCursor(events: readonly CareEvent[]): TimelineCursor | null {
  const last = events[events.length - 1];
  if (!last) return null;
  return { sortAtMs: careSortAtMs(last), eventId: last.eventId };
}

/**
 * History list rows stay typed so later experience/recommendation slots can
 * join without pretending to be durable care events.
 */
export type HistoryTimelineRow =
  | { kind: 'care'; event: CareEvent }
  | { kind: 'draft'; draft: Draft }
  | { kind: 'trash'; marker: DeletionMarker };

/** Recommendation cards must never appear as durable history rows. */
export function isDurableHistoryRow(row: HistoryTimelineRow): boolean {
  return row.kind === 'care';
}
