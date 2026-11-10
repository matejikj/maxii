import type { UnitOfWorkFactory } from '../domain';
import type { ChildPrivateSyncStateStore } from '../domain/sync/childPrivateSyncStateStore';
import type { LocalChildPrivateSyncState } from '../domain/sync/childPrivateTransport';
import {
  applyChildPrivateInboxToWorkspace,
  type ApplyChildPrivateInboxResult,
} from './applyChildPrivateInbox';
import type { ChildPrivateSyncSessionBinding } from './bindChildPrivateSyncSession';

export type ChildPrivateSyncLoopResult = {
  readonly pushed: number;
  readonly pulled: number;
  readonly personalCold: boolean;
  readonly state: LocalChildPrivateSyncState;
  readonly nextDelayMs: number;
  readonly inboxApply: ApplyChildPrivateInboxResult | null;
};

export type ChildPrivateSyncLoop = {
  /** One bounded tick against the durable local outbox snapshot. */
  readonly runOnce: () => Promise<ChildPrivateSyncLoopResult>;
  readonly start: (intervalMs?: number) => void;
  readonly stop: () => void;
  readonly isRunning: () => boolean;
};

const DEFAULT_INTERVAL_MS = 15_000;

/**
 * Loads the durable private sync snapshot, runs one session-bound tick, and
 * writes the result back. Personal builds stay cold until sync env + login.
 * Unapplied inbox rows are materialized into the local diary when a UoW is bound.
 */
export async function runChildPrivateSyncTickWithStore(input: {
  readonly binding: ChildPrivateSyncSessionBinding;
  readonly store: ChildPrivateSyncStateStore;
  readonly attemptId: string;
  readonly nowIso: string;
  readonly batchSize?: number;
  readonly unitOfWork?: UnitOfWorkFactory | undefined;
  readonly sessionAppUserId?: string | null | undefined;
}): Promise<ChildPrivateSyncLoopResult> {
  const loaded = await input.store.load();
  let state = loaded;
  let pushed = 0;
  let pulled = 0;
  let nextDelayMs = 5_000;
  const personalCold = !input.binding.isTransferReady();

  if (!personalCold) {
    const tick = await input.binding.runTick({
      state: loaded,
      attemptId: input.attemptId,
      now: input.nowIso,
      ...(input.batchSize != null ? { batchSize: input.batchSize } : {}),
    });
    state = tick.state;
    pushed = tick.pushed;
    pulled = tick.pulled;
    nextDelayMs = tick.nextDelayMs;
    await input.store.save(state);
  }

  let inboxApply: ApplyChildPrivateInboxResult | null = null;
  if (input.unitOfWork) {
    // Apply even when cold so a prior crash between pull and materialize recovers.
    inboxApply = await applyChildPrivateInboxToWorkspace({
      state,
      unitOfWork: input.unitOfWork,
      now: { epochMs: Date.parse(input.nowIso) },
      sessionAppUserId: input.sessionAppUserId ?? state.ownerAppUserId,
    });
    if (inboxApply.state !== state) {
      state = inboxApply.state;
      await input.store.save(state);
    }
  }

  return {
    pushed,
    pulled,
    personalCold,
    state,
    nextDelayMs,
    inboxApply,
  };
}

/**
 * Periodic bridge from the owner-scoped outbox to the child-private HTTP
 * stream. May be constructed in personal mode; ticks stay cold until sync.
 */
export function createChildPrivateSyncLoop(input: {
  readonly binding: ChildPrivateSyncSessionBinding;
  readonly store: ChildPrivateSyncStateStore;
  readonly unitOfWork?: UnitOfWorkFactory | undefined;
  readonly getSessionAppUserId?: (() => string | null) | undefined;
  readonly createAttemptId?: (() => string) | undefined;
  readonly nowIso?: (() => string) | undefined;
  readonly setIntervalFn?: typeof setInterval;
  readonly clearIntervalFn?: typeof clearInterval;
}): ChildPrivateSyncLoop {
  const setIntervalFn = input.setIntervalFn ?? setInterval;
  const clearIntervalFn = input.clearIntervalFn ?? clearInterval;
  const createAttemptId =
    input.createAttemptId ?? (() => `cp_tick_${Date.now()}`);
  const nowIso = input.nowIso ?? (() => new Date().toISOString());
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;

  const loop: ChildPrivateSyncLoop = {
    async runOnce() {
      if (inFlight) {
        const state = await input.store.load();
        return {
          pushed: 0,
          pulled: 0,
          personalCold: !input.binding.isTransferReady(),
          state,
          nextDelayMs: 5_000,
          inboxApply: null,
        };
      }
      inFlight = true;
      try {
        return await runChildPrivateSyncTickWithStore({
          binding: input.binding,
          store: input.store,
          attemptId: createAttemptId(),
          nowIso: nowIso(),
          unitOfWork: input.unitOfWork,
          sessionAppUserId: input.getSessionAppUserId?.() ?? null,
        });
      } finally {
        inFlight = false;
      }
    },

    start(intervalMs = DEFAULT_INTERVAL_MS) {
      if (timer != null) return;
      const delay = Math.max(1_000, intervalMs);
      // Kick once immediately so pending private work does not wait a full interval.
      void loop.runOnce();
      timer = setIntervalFn(() => {
        void loop.runOnce();
      }, delay);
    },

    stop() {
      if (timer == null) return;
      clearIntervalFn(timer);
      timer = null;
    },

    isRunning() {
      return timer != null;
    },
  };

  return loop;
}
