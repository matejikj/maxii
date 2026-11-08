/**
 * In-session History tab memory. Kept out of unprotected disk caches so care
 * filters and drafts are not leaked through web localStorage.
 */
export type HistoryFilter = 'all' | 'care' | 'activities' | 'notes';

export type HistoryTabState = {
  focusDate: string | null;
  filter: HistoryFilter;
  scrollOffsetY: number;
  openDraftFormType: string | null;
};

export function createInitialHistoryTabState(): HistoryTabState {
  return {
    focusDate: null,
    filter: 'all',
    scrollOffsetY: 0,
    openDraftFormType: null,
  };
}

/** Explicit “Zobrazit dnešní záznamy” — jump to today and clear filters. */
export function showTodayRecords(todayIsoDate: string): HistoryTabState {
  return {
    focusDate: todayIsoDate,
    filter: 'all',
    scrollOffsetY: 0,
    openDraftFormType: null,
  };
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
