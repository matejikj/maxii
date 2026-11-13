import {
  FAMILY_ATTACHMENT_QUOTA,
  planFamilyAttachmentReservation,
  type FamilyAttachmentQuotaView,
} from '@lumi/contracts';

/**
 * Quota contract shared by the in-process ledger and the durable Postgres
 * ledger. `view` may be sync (memory) or async (Postgres); callers must await.
 */
export type FamilyAttachmentQuotaPort = {
  view(familyId: string): FamilyAttachmentQuotaView | Promise<FamilyAttachmentQuotaView>;
  reserve(
    familyId: string,
    requestBytes: number,
  ): Promise<
    | { readonly ok: true; readonly reservedBytes: number }
    | {
        readonly ok: false;
        readonly reason: 'quota_exceeded' | 'pending_budget_exceeded' | 'invalid_size';
      }
  >;
  commitReservation(familyId: string, reservedBytes: number): Promise<void>;
  releaseReservation(familyId: string, reservedBytes: number): Promise<void>;
  releaseUsed(familyId: string, usedBytes: number): Promise<void>;
};

type FamilyQuotaState = {
  usedBytes: number;
  reservedBytes: number;
};

/**
 * Per-family quota ledger with atomic reserve/commit/release. Concurrent
 * intents share one mutex so two large uploads cannot both pass a stale read.
 */
export function createFamilyAttachmentQuotaLedger(input?: {
  readonly budgetBytes?: number;
  readonly pendingReservationBudgetBytes?: number;
}) {
  const budgetBytes = input?.budgetBytes ?? FAMILY_ATTACHMENT_QUOTA.familyBudgetBytes;
  const pendingBudget =
    input?.pendingReservationBudgetBytes ?? FAMILY_ATTACHMENT_QUOTA.pendingReservationBudgetBytes;
  const byFamily = new Map<string, FamilyQuotaState>();
  const locks = new Map<string, Promise<void>>();

  async function withFamilyLock<T>(familyId: string, run: () => Promise<T> | T): Promise<T> {
    const previous = locks.get(familyId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    locks.set(
      familyId,
      previous.then(() => gate),
    );
    await previous;
    try {
      return await run();
    } finally {
      release();
      if (locks.get(familyId) === gate) locks.delete(familyId);
    }
  }

  function stateOf(familyId: string): FamilyQuotaState {
    const existing = byFamily.get(familyId);
    if (existing) return existing;
    const fresh = { usedBytes: 0, reservedBytes: 0 };
    byFamily.set(familyId, fresh);
    return fresh;
  }

  return {
    view(familyId: string) {
      const state = stateOf(familyId);
      return {
        familyId,
        budgetBytes,
        usedBytes: state.usedBytes,
        reservedBytes: state.reservedBytes,
        remainingBytes: Math.max(0, budgetBytes - state.usedBytes - state.reservedBytes),
      };
    },

    async reserve(familyId: string, requestBytes: number) {
      return withFamilyLock(familyId, () => {
        const state = stateOf(familyId);
        const plan = planFamilyAttachmentReservation({
          budgetBytes,
          usedBytes: state.usedBytes,
          reservedBytes: state.reservedBytes,
          pendingReservationBudgetBytes: pendingBudget,
          requestBytes,
        });
        if (!plan.ok) return plan;
        state.reservedBytes = plan.nextReservedBytes;
        return { ok: true as const, reservedBytes: requestBytes };
      });
    },

    async commitReservation(familyId: string, reservedBytes: number) {
      return withFamilyLock(familyId, () => {
        const state = stateOf(familyId);
        state.reservedBytes = Math.max(0, state.reservedBytes - reservedBytes);
        state.usedBytes += reservedBytes;
      });
    },

    async releaseReservation(familyId: string, reservedBytes: number) {
      return withFamilyLock(familyId, () => {
        const state = stateOf(familyId);
        state.reservedBytes = Math.max(0, state.reservedBytes - reservedBytes);
      });
    },

    async releaseUsed(familyId: string, usedBytes: number) {
      return withFamilyLock(familyId, () => {
        const state = stateOf(familyId);
        state.usedBytes = Math.max(0, state.usedBytes - usedBytes);
      });
    },
  };
}

export type FamilyAttachmentQuotaLedger = ReturnType<typeof createFamilyAttachmentQuotaLedger>;
