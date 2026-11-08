import { AppError, DRAFT_AUTOSAVE_DEBOUNCE_MS, type Draft } from '../domain';
import type { CommandDispatcher, DispatchResult } from './commandDispatcher';
import type { DiscardDraftCommand, SaveDraftCommand } from '../domain';

/**
 * Debounced local draft persistence. A failed save never pretends the draft is
 * protected — callers must surface that the in-progress form is at risk.
 */
export type DraftAutosave = {
  schedule(command: SaveDraftCommand): void;
  flush(): Promise<DispatchResult | null>;
  discard(command: DiscardDraftCommand): Promise<DispatchResult>;
  lastError(): AppError | null;
  dispose(): void;
};

export function createDraftAutosave(
  dispatcher: CommandDispatcher,
  options: { debounceMs?: number; nowMs?: () => number } = {},
): DraftAutosave {
  const debounceMs = options.debounceMs ?? DRAFT_AUTOSAVE_DEBOUNCE_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: SaveDraftCommand | null = null;
  let lastError: AppError | null = null;
  let disposed = false;

  async function persist(command: SaveDraftCommand): Promise<DispatchResult> {
    const result = await dispatcher.dispatch(command);
    if (!result.ok) {
      lastError =
        result.error ??
        new AppError('STORAGE', 'Draft was not saved; values are not protected yet', {
          details: { reason: 'draft_unprotected' },
          retryable: true,
        });
    } else {
      lastError = null;
    }
    return result;
  }

  return {
    schedule(command) {
      if (disposed) return;
      pending = command;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const next = pending;
        pending = null;
        timer = null;
        if (next) void persist(next);
      }, debounceMs);
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const next = pending;
      pending = null;
      if (!next) return null;
      return persist(next);
    },
    async discard(command) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      pending = null;
      return dispatcher.dispatch(command);
    },
    lastError() {
      return lastError;
    },
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}

/** Helper for UI: opening a new form must leave the previous draft untouched. */
export function keepPriorDraftWhenStartingFresh(
  prior: Draft | null,
  nextFormType: Draft['formType'],
): Draft | null {
  if (!prior) return null;
  // A brand-new form never overwrites an older draft of any type; History keeps it.
  void nextFormType;
  return prior;
}
