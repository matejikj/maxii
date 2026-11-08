/** Short undo toast window after a confirmed local write. */
export const UNDO_WINDOW_MS = 10_000;

/** Soft-deleted care stays restorable in trash for seven days. */
export const TRASH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Local draft autosave cadence. Failures must surface as unprotected drafts —
 * the debounce never claims durable storage on its own.
 */
export const DRAFT_AUTOSAVE_DEBOUNCE_MS = 500;
