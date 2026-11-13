import type { AppUserId, DeviceId, FamilyId } from './ids.ts';
import type { ChildLinkDecision } from './invitations.ts';

/**
 * Client-side enrollment intent that survives network retries. Repeating the
 * same idempotency key must not create a second family.
 */
export type EnrollmentIntent = {
  readonly kind: 'create_family' | 'accept_invitation';
  readonly idempotencyKey: string;
  readonly startedAt: string;
  readonly familyDisplayName?: string;
  readonly invitationTokenPresent: boolean;
  readonly localChildId: string;
  readonly localActorId: string;
  readonly localDeviceId: DeviceId | string;
  readonly childLinkDecision: ChildLinkDecision;
  readonly checkpointId: string | null;
  readonly status: 'pending' | 'awaiting_network' | 'completed' | 'deferred';
};

export type ChildLinkComparison = {
  readonly localChildId: string;
  readonly localDisplayName: string;
  readonly localBirthDate: string | null;
  readonly remoteChildId: string | null;
  readonly remoteDisplayName: string | null;
  readonly remoteBirthDate: string | null;
};

/**
 * Name and birthday may look alike across unrelated children. Never treat that
 * as proof they are the same person — the caregiver must choose explicitly.
 */
export function suggestChildLinkDecision(comparison: ChildLinkComparison): {
  readonly autoMergeAllowed: false;
  readonly nameLooksSimilar: boolean;
  readonly birthDateLooksSimilar: boolean;
  readonly requiresExplicitDecision: true;
} {
  const nameLooksSimilar =
    normalizeName(comparison.localDisplayName) ===
      normalizeName(comparison.remoteDisplayName ?? '') &&
    normalizeName(comparison.localDisplayName).length > 0;
  const birthDateLooksSimilar =
    comparison.localBirthDate != null &&
    comparison.remoteBirthDate != null &&
    comparison.localBirthDate === comparison.remoteBirthDate;
  return {
    autoMergeAllowed: false,
    nameLooksSimilar,
    birthDateLooksSimilar,
    requiresExplicitDecision: true,
  };
}

export function applyExplicitChildLinkDecision(input: {
  readonly decision: ChildLinkDecision;
  readonly localChildId: string;
  readonly remoteChildId: string | null;
}): {
  readonly ok: boolean;
  readonly sharedChildId: string | null;
  readonly keepSeparateLocalChild: boolean;
  readonly deferred: boolean;
  readonly reason?: string;
} {
  switch (input.decision) {
    case 'founding_profile':
      return {
        ok: true,
        sharedChildId: input.localChildId,
        keepSeparateLocalChild: false,
        deferred: false,
      };
    case 'same_child':
      if (!input.remoteChildId) {
        return {
          ok: false,
          sharedChildId: null,
          keepSeparateLocalChild: true,
          deferred: false,
          reason: 'remote_child_required',
        };
      }
      return {
        ok: true,
        sharedChildId: input.remoteChildId,
        keepSeparateLocalChild: false,
        deferred: false,
      };
    case 'different_child':
      return {
        ok: true,
        sharedChildId: null,
        keepSeparateLocalChild: true,
        deferred: false,
      };
    case 'defer':
      return {
        ok: true,
        sharedChildId: null,
        keepSeparateLocalChild: true,
        deferred: true,
      };
    default:
      return {
        ok: false,
        sharedChildId: null,
        keepSeparateLocalChild: true,
        deferred: false,
        reason: 'unknown_decision',
      };
  }
}

/**
 * Actor/device provenance may attach to the authenticated app user, but never
 * rewrite authorship of another member's events.
 */
export function bindLocalActorToAccount(input: {
  readonly localActorId: string;
  readonly authenticatedAppUserId: AppUserId;
  readonly claimedAuthorAppUserId: AppUserId | null;
}):
  | { readonly ok: true; readonly boundAppUserId: AppUserId }
  | { readonly ok: false; readonly reason: string } {
  if (
    input.claimedAuthorAppUserId != null &&
    input.claimedAuthorAppUserId !== input.authenticatedAppUserId
  ) {
    return { ok: false, reason: 'cannot_claim_other_member_authorship' };
  }
  return { ok: true, boundAppUserId: input.authenticatedAppUserId };
}

export function markEnrollmentAwaitingNetwork(intent: EnrollmentIntent): EnrollmentIntent {
  return { ...intent, status: 'awaiting_network' };
}

export function completeEnrollment(
  intent: EnrollmentIntent,
  familyId: FamilyId,
): EnrollmentIntent & { readonly familyId: FamilyId } {
  return { ...intent, status: 'completed', familyId };
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('cs');
}
