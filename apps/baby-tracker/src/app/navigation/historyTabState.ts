import type { CareSubtype, HistoryBucket } from '../../domain';

/**
 * In-session History tab memory. Kept out of unprotected disk caches so care
 * filters and drafts are not leaked through web localStorage.
 */
export type HistoryFilter = HistoryBucket;

export type HistorySection = 'timeline' | 'drafts' | 'trash';

export type HistoryTabState = {
  focusDate: string | null;
  filter: HistoryFilter;
  careSubtype: CareSubtype | null;
  searchQuery: string;
  section: HistorySection;
  scrollOffsetY: number;
  openDraftFormType: string | null;
};

export function createInitialHistoryTabState(): HistoryTabState {
  return {
    focusDate: null,
    filter: 'all',
    careSubtype: null,
    searchQuery: '',
    section: 'timeline',
    scrollOffsetY: 0,
    openDraftFormType: null,
  };
}

/** Explicit “Zobrazit dnešní záznamy” — jump to today and clear filters. */
export function showTodayRecords(todayIsoDate: string): HistoryTabState {
  return {
    focusDate: todayIsoDate,
    filter: 'all',
    careSubtype: null,
    searchQuery: '',
    section: 'timeline',
    scrollOffsetY: 0,
    openDraftFormType: null,
  };
}

/** Clears only query constraints; section and scroll stay as the user left them. */
export function clearHistoryFilters(previous: HistoryTabState): HistoryTabState {
  return {
    ...previous,
    filter: 'all',
    careSubtype: null,
    searchQuery: '',
    focusDate: null,
  };
}

export function historyFiltersActive(state: HistoryTabState): boolean {
  return (
    state.filter !== 'all' ||
    state.careSubtype != null ||
    state.searchQuery.trim().length > 0 ||
    state.focusDate != null
  );
}

/** Ordinary return to History keeps the previous filters and scroll. */
export function restoreHistoryContext(previous: HistoryTabState): HistoryTabState {
  return { ...previous };
}

export function formatIsoCalendarDate(epochMs: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(epochMs));
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}
