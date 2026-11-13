import type { AppUserId, FamilyId, FamilyRole, MembershipId } from './ids.ts';
import { LUMI_API_PROTOCOL_VERSION } from './protocol.ts';

export type InvitationId = string & { readonly __brand: 'InvitationId' };

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

/** Public invitation preview — never includes the raw secret token. */
export type InvitationPreview = {
  readonly invitationId: InvitationId;
  readonly familyId: FamilyId;
  readonly familyDisplayName: string;
  readonly invitedRole: FamilyRole;
  readonly invitedByAppUserId: AppUserId;
  readonly expiresAt: string;
  readonly status: InvitationStatus;
};

export type CreateInvitationRequest = {
  readonly protocolVersion: typeof LUMI_API_PROTOCOL_VERSION;
  readonly idempotencyKey: string;
  /** Caregiver is the only inviteable role in the first family cut. */
  readonly role: 'caregiver';
  readonly ttlSeconds?: number;
};

export type CreateInvitationResponse = {
  readonly invitationId: InvitationId;
  readonly familyId: FamilyId;
  readonly role: 'caregiver';
  readonly expiresAt: string;
  /** Shown once to the admin; never logged or stored in plaintext. */
  readonly oneTimeToken: string;
  readonly created: boolean;
};

/**
 * Explicit child-link choice from the joining device. Name/birthday similarity
 * must never become an automatic decision on either side.
 */
export type ChildLinkDecision = 'founding_profile' | 'same_child' | 'different_child' | 'defer';

export type AcceptInvitationRequest = {
  readonly protocolVersion: typeof LUMI_API_PROTOCOL_VERSION;
  readonly idempotencyKey: string;
  readonly oneTimeToken: string;
  readonly childLinkDecision: Exclude<ChildLinkDecision, 'founding_profile'>;
  /** Local child the joiner believes they are linking, when deciding same_child. */
  readonly localChildId?: string | null;
  readonly localChildDisplayName?: string | null;
};

export type AcceptInvitationResponse = {
  readonly invitationId: InvitationId;
  readonly familyId: FamilyId;
  readonly membershipId: MembershipId;
  readonly role: FamilyRole;
  readonly familyDisplayName: string;
  readonly created: boolean;
  readonly childLinkDecision: Exclude<ChildLinkDecision, 'founding_profile'>;
  /** When deferred, membership is still created; merge stays local/pending. */
  readonly mergeDeferred: boolean;
};

export type FamilyMemberView = {
  readonly membershipId: MembershipId;
  readonly appUserId: AppUserId;
  readonly role: FamilyRole;
  readonly status: 'active' | 'revoked';
  readonly joinedAt: string;
};

export type TransferAdminRequest = {
  readonly protocolVersion: typeof LUMI_API_PROTOCOL_VERSION;
  readonly targetMembershipId: MembershipId;
};

export type LinkExternalIdentityRequest = {
  readonly protocolVersion: typeof LUMI_API_PROTOCOL_VERSION;
  readonly issuer: string;
  readonly subject: string;
};
