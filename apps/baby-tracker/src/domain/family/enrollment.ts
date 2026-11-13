import type { ActorId, ChildId, DeviceId } from '../ids.ts';

export type ChildLinkDecision = 'founding_profile' | 'same_child' | 'different_child' | 'defer';

export type EnrollmentIntent = {
  readonly kind: 'create_family' | 'accept_invitation';
  readonly idempotencyKey: string;
  readonly startedAt: string;
  readonly localChildId: ChildId;
  readonly localActorId: ActorId;
  readonly localDeviceId: DeviceId;
  readonly childLinkDecision: ChildLinkDecision;
  readonly checkpointId: string | null;
  readonly status: 'pending' | 'awaiting_network' | 'completed' | 'deferred';
  readonly familyId?: string;
};

export type JoinPreview = {
  readonly familyDisplayName: string;
  readonly invitedRole: 'caregiver';
  readonly remoteChildDisplayName: string | null;
  readonly remoteChildBirthDate: string | null;
  readonly localChildDisplayName: string;
  readonly localChildBirthDate: string | null;
  readonly autoMergeAllowed: false;
  readonly nameLooksSimilar: boolean;
  readonly birthDateLooksSimilar: boolean;
  readonly requiresCheckpoint: true;
  readonly requiresExplicitDecision: true;
};

/**
 * Before any family link, require an isolated checkpoint so a failed or
 * deferred join never destroys the personal diary.
 */
export function requireEnrollmentCheckpoint(input: {
  readonly checkpointId: string | null | undefined;
}): { readonly ok: true } | { readonly ok: false; readonly reason: 'checkpoint_required' } {
  if (!input.checkpointId?.trim()) {
    return { ok: false, reason: 'checkpoint_required' };
  }
  return { ok: true };
}

export function buildJoinPreview(input: {
  readonly familyDisplayName: string;
  readonly localChildDisplayName: string;
  readonly localChildBirthDate: string | null;
  readonly remoteChildDisplayName: string | null;
  readonly remoteChildBirthDate: string | null;
}): JoinPreview {
  const localName = normalizeName(input.localChildDisplayName);
  const remoteName = normalizeName(input.remoteChildDisplayName ?? '');
  return {
    familyDisplayName: input.familyDisplayName,
    invitedRole: 'caregiver',
    remoteChildDisplayName: input.remoteChildDisplayName,
    remoteChildBirthDate: input.remoteChildBirthDate,
    localChildDisplayName: input.localChildDisplayName,
    localChildBirthDate: input.localChildBirthDate,
    autoMergeAllowed: false,
    nameLooksSimilar: localName.length > 0 && localName === remoteName,
    birthDateLooksSimilar:
      input.localChildBirthDate != null &&
      input.remoteChildBirthDate != null &&
      input.localChildBirthDate === input.remoteChildBirthDate,
    requiresCheckpoint: true,
    requiresExplicitDecision: true,
  };
}

export function startEnrollmentIntent(input: {
  readonly kind: EnrollmentIntent['kind'];
  readonly idempotencyKey: string;
  readonly startedAt: string;
  readonly localChildId: ChildId;
  readonly localActorId: ActorId;
  readonly localDeviceId: DeviceId;
  readonly childLinkDecision: ChildLinkDecision;
  readonly checkpointId: string;
}): EnrollmentIntent {
  const checkpoint = requireEnrollmentCheckpoint({ checkpointId: input.checkpointId });
  if (!checkpoint.ok) {
    throw new Error('checkpoint_required');
  }
  return {
    kind: input.kind,
    idempotencyKey: input.idempotencyKey,
    startedAt: input.startedAt,
    localChildId: input.localChildId,
    localActorId: input.localActorId,
    localDeviceId: input.localDeviceId,
    childLinkDecision: input.childLinkDecision,
    checkpointId: input.checkpointId,
    status: 'pending',
  };
}

/** Network drop mid-join keeps the same idempotency key for a safe retry. */
export function markEnrollmentAwaitingNetwork(intent: EnrollmentIntent): EnrollmentIntent {
  return { ...intent, status: 'awaiting_network' };
}

export function completeEnrollment(intent: EnrollmentIntent, familyId: string): EnrollmentIntent {
  return {
    ...intent,
    status: intent.childLinkDecision === 'defer' ? 'deferred' : 'completed',
    familyId,
  };
}

/**
 * Stable entity IDs from an earlier import may dedupe. Similar wall-clock times
 * of unrelated events must never be collapsed without an explicit user choice.
 */
export function planHistoryMerge(input: {
  readonly decision: ChildLinkDecision;
  readonly localEventIds: readonly string[];
  readonly remoteEventIds: readonly string[];
  readonly similarTimePairs: readonly { localId: string; remoteId: string }[];
}): {
  readonly sharedEventIds: readonly string[];
  readonly keepBothSimilarTimePairs: readonly { localId: string; remoteId: string }[];
  readonly deferred: boolean;
} {
  if (input.decision === 'defer' || input.decision === 'different_child') {
    return {
      sharedEventIds: [],
      keepBothSimilarTimePairs: input.similarTimePairs,
      deferred: input.decision === 'defer',
    };
  }
  const remote = new Set(input.remoteEventIds);
  const shared = input.localEventIds.filter((id) => remote.has(id));
  return {
    sharedEventIds: shared,
    keepBothSimilarTimePairs: input.similarTimePairs,
    deferred: false,
  };
}

/**
 * After caregiver revoke, keep unsent local changes visible for manual
 * resolution instead of silently reassigning them to another family.
 */
export function isolateUnsentChangesAfterRevoke(input: {
  readonly unsentOperationIds: readonly string[];
}): {
  readonly isolatedOperationIds: readonly string[];
  readonly maySubmitToServer: false;
} {
  return {
    isolatedOperationIds: [...input.unsentOperationIds],
    maySubmitToServer: false,
  };
}

export function bindLocalActorToVerifiedAccount(input: {
  readonly localActorId: ActorId;
  readonly authenticatedAppUserId: string;
  readonly claimedAuthorAppUserId: string | null;
}):
  | { readonly ok: true; readonly boundAppUserId: string }
  | { readonly ok: false; readonly reason: 'cannot_claim_other_member_authorship' } {
  if (
    input.claimedAuthorAppUserId != null &&
    input.claimedAuthorAppUserId !== input.authenticatedAppUserId
  ) {
    return { ok: false, reason: 'cannot_claim_other_member_authorship' };
  }
  void input.localActorId;
  return { ok: true, boundAppUserId: input.authenticatedAppUserId };
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('cs');
}
