import { randomUUID } from 'node:crypto';
import type {
  AcceptInvitationRequest,
  AcceptInvitationResponse,
  AppUserId,
  CreateFamilyRequest,
  CreateFamilyResponse,
  CreateInvitationRequest,
  CreateInvitationResponse,
  ExternalIdentityBinding,
  FamilyId,
  FamilyMemberView,
  FamilyMembership,
  InvitationId,
  InvitationPreview,
  MembershipId,
} from '@lumi/contracts';
import {
  LUMI_API_LIMITS,
  LUMI_API_PROTOCOL_VERSION,
  authorizeFamilyAdminAction,
  wouldLeaveFamilyWithoutAdmin,
} from '@lumi/contracts';
import { hashInvitationToken, invitationTokenMatches, mintInvitationToken } from './invitationCrypto.ts';

export type FamilyRecord = {
  readonly familyId: FamilyId;
  readonly displayName: string;
  readonly createdAt: string;
  readonly createdBy: AppUserId;
  readonly erasedAt: string | null;
};

export type FamilyObjectRecord = {
  readonly objectId: string;
  readonly familyId: FamilyId;
  readonly kind: string;
  readonly label: string;
  readonly createdAt: string;
};

type InvitationRecord = {
  invitationId: InvitationId;
  familyId: FamilyId;
  role: 'caregiver';
  invitedBy: AppUserId;
  tokenHash: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
  attempts: number;
  acceptedBy: AppUserId | null;
  createdAt: string;
};

/**
 * In-process family directory used for local CI and unit proofs. Postgres
 * migrations mirror the same membership and RLS contracts for real deploys.
 */
export class MemoryFamilyStore {
  readonly users = new Map<AppUserId, { createdAt: string; status: 'active' | 'revoked' }>();
  readonly bindings: ExternalIdentityBinding[] = [];
  readonly families = new Map<FamilyId, FamilyRecord>();
  readonly memberships: FamilyMembership[] = [];
  readonly objects: FamilyObjectRecord[] = [];
  readonly invitations: InvitationRecord[] = [];
  readonly idempotency = new Map<string, CreateFamilyResponse>();
  readonly invitationIdempotency = new Map<string, CreateInvitationResponse>();
  readonly acceptIdempotency = new Map<string, AcceptInvitationResponse>();

  ensureUser(appUserId: AppUserId, now: string): void {
    if (!this.users.has(appUserId)) {
      this.users.set(appUserId, { createdAt: now, status: 'active' });
    }
  }

  bindExternal(input: {
    appUserId: AppUserId;
    issuer: string;
    subject: string;
    now: string;
  }): void {
    const existing = this.bindings.find(
      (item) => item.issuer === input.issuer && item.subject === input.subject,
    );
    if (existing && existing.revokedAt == null) {
      if (existing.appUserId !== input.appUserId) {
        throw codedError('conflict', 'external_identity_collision');
      }
      return;
    }
    if (existing && existing.revokedAt != null) {
      // Revoked bindings stay rejected — a new subject must be linked explicitly.
      throw codedError('forbidden', 'binding_revoked');
    }
    this.bindings.push({
      appUserId: input.appUserId,
      issuer: input.issuer,
      subject: input.subject,
      boundAt: input.now,
      revokedAt: null,
    });
  }

  linkAdditionalIssuer(input: {
    appUserId: AppUserId;
    issuer: string;
    subject: string;
    now: string;
  }): { linked: boolean } {
    this.ensureUser(input.appUserId, input.now);
    const existing = this.bindings.find(
      (item) => item.issuer === input.issuer && item.subject === input.subject,
    );
    if (existing) {
      if (existing.revokedAt != null) {
        throw codedError('forbidden', 'binding_revoked');
      }
      if (existing.appUserId !== input.appUserId) {
        // Same e-mail on another account must not steal this membership graph.
        throw codedError('conflict', 'external_identity_owned_elsewhere');
      }
      return { linked: false };
    }
    this.bindings.push({
      appUserId: input.appUserId,
      issuer: input.issuer,
      subject: input.subject,
      boundAt: input.now,
      revokedAt: null,
    });
    return { linked: true };
  }

  revokeBinding(issuer: string, subject: string, now: string): boolean {
    const binding = this.bindings.find(
      (item) => item.issuer === issuer && item.subject === subject && item.revokedAt == null,
    );
    if (!binding) return false;
    const index = this.bindings.indexOf(binding);
    this.bindings[index] = { ...binding, revokedAt: now };
    return true;
  }

  createFamily(
    appUserId: AppUserId,
    request: CreateFamilyRequest,
    now: string,
  ): CreateFamilyResponse {
    if (request.protocolVersion !== LUMI_API_PROTOCOL_VERSION) {
      throw codedError('unsupported_schema', 'unsupported_schema');
    }
    if (
      !request.idempotencyKey ||
      request.idempotencyKey.length > LUMI_API_LIMITS.maxIdempotencyKeyLength
    ) {
      throw codedError('validation', 'validation');
    }
    const displayName = request.displayName.trim();
    if (!displayName || displayName.length > LUMI_API_LIMITS.maxDisplayNameLength) {
      throw codedError('validation', 'validation');
    }

    const idemKey = `${appUserId}:${request.idempotencyKey}`;
    const prior = this.idempotency.get(idemKey);
    if (prior) return { ...prior, created: false };

    this.ensureUser(appUserId, now);
    const familyId = randomUUID() as FamilyId;
    const membershipId = randomUUID() as MembershipId;
    this.families.set(familyId, {
      familyId,
      displayName,
      createdAt: now,
      createdBy: appUserId,
      erasedAt: null,
    });
    this.memberships.push({
      membershipId,
      familyId,
      appUserId,
      role: 'admin',
      status: 'active',
      joinedAt: now,
    });
    const response: CreateFamilyResponse = {
      familyId,
      membershipId,
      role: 'admin',
      created: true,
    };
    this.idempotency.set(idemKey, response);
    return response;
  }

  listMembers(familyId: FamilyId): readonly FamilyMemberView[] {
    return this.memberships
      .filter((item) => item.familyId === familyId)
      .map((item) => ({
        membershipId: item.membershipId,
        appUserId: item.appUserId,
        role: item.role,
        status: item.status,
        joinedAt: item.joinedAt,
      }));
  }

  createInvitation(
    actorId: AppUserId,
    familyId: FamilyId,
    request: CreateInvitationRequest,
    now: string,
  ): CreateInvitationResponse {
    if (request.protocolVersion !== LUMI_API_PROTOCOL_VERSION) {
      throw codedError('unsupported_schema', 'unsupported_schema');
    }
    if (request.role !== 'caregiver') {
      throw codedError('validation', 'only_caregiver_invites');
    }
    const admin = authorizeFamilyAdminAction({
      memberships: this.memberships,
      appUserId: actorId,
      familyId,
      action: 'invite',
    });
    if (!admin.allow) throw codedError('forbidden', admin.reason);
    const family = this.requireActiveFamily(familyId);

    const idemKey = `${actorId}:${familyId}:${request.idempotencyKey}`;
    const prior = this.invitationIdempotency.get(idemKey);
    if (prior) return { ...prior, created: false, oneTimeToken: '' };

    const ttl = clampTtl(request.ttlSeconds);
    const { token, tokenHash } = mintInvitationToken();
    const invitationId = randomUUID() as InvitationId;
    const expiresAt = new Date(Date.parse(now) + ttl * 1000).toISOString();
    this.invitations.push({
      invitationId,
      familyId,
      role: 'caregiver',
      invitedBy: actorId,
      tokenHash,
      status: 'pending',
      expiresAt,
      attempts: 0,
      acceptedBy: null,
      createdAt: now,
    });
    const response: CreateInvitationResponse = {
      invitationId,
      familyId,
      role: 'caregiver',
      expiresAt,
      oneTimeToken: token,
      created: true,
    };
    this.invitationIdempotency.set(idemKey, response);
    void family;
    return response;
  }

  revokeInvitation(actorId: AppUserId, familyId: FamilyId, invitationId: InvitationId, now: string): boolean {
    const admin = authorizeFamilyAdminAction({
      memberships: this.memberships,
      appUserId: actorId,
      familyId,
      action: 'invite',
    });
    if (!admin.allow) throw codedError('forbidden', admin.reason);
    const invite = this.invitations.find(
      (item) => item.invitationId === invitationId && item.familyId === familyId,
    );
    if (!invite) throw codedError('not_found', 'invitation_not_found');
    if (invite.status !== 'pending') return false;
    invite.status = 'revoked';
    void now;
    return true;
  }

  previewInvitation(token: string, now: string): InvitationPreview {
    const invite = this.findUsableInvitation(token, now, { consumeAttempt: false });
    const family = this.requireActiveFamily(invite.familyId);
    return {
      invitationId: invite.invitationId,
      familyId: invite.familyId,
      familyDisplayName: family.displayName,
      invitedRole: invite.role,
      invitedByAppUserId: invite.invitedBy,
      expiresAt: invite.expiresAt,
      status: invite.status,
    };
  }

  acceptInvitation(
    appUserId: AppUserId,
    request: AcceptInvitationRequest,
    now: string,
  ): AcceptInvitationResponse {
    if (request.protocolVersion !== LUMI_API_PROTOCOL_VERSION) {
      throw codedError('unsupported_schema', 'unsupported_schema');
    }
    if (
      !request.idempotencyKey ||
      request.idempotencyKey.length > LUMI_API_LIMITS.maxIdempotencyKeyLength
    ) {
      throw codedError('validation', 'validation');
    }
    if (
      request.childLinkDecision !== 'same_child' &&
      request.childLinkDecision !== 'different_child' &&
      request.childLinkDecision !== 'defer'
    ) {
      throw codedError('validation', 'child_link_required');
    }

    const idemKey = `${appUserId}:${request.idempotencyKey}`;
    const prior = this.acceptIdempotency.get(idemKey);
    if (prior) return { ...prior, created: false };

    this.ensureUser(appUserId, now);
    const invite = this.findUsableInvitation(request.oneTimeToken, now, { consumeAttempt: true });
    const family = this.requireActiveFamily(invite.familyId);

    const existing = this.memberships.find(
      (item) => item.familyId === invite.familyId && item.appUserId === appUserId,
    );
    if (existing) {
      if (existing.status === 'revoked') {
        throw codedError('forbidden', 'membership_revoked');
      }
      // Concurrent/repeated accept stays caregiver — never escalates to admin.
      const response: AcceptInvitationResponse = {
        invitationId: invite.invitationId,
        familyId: invite.familyId,
        membershipId: existing.membershipId,
        role: existing.role,
        familyDisplayName: family.displayName,
        created: false,
        childLinkDecision: request.childLinkDecision,
        mergeDeferred: request.childLinkDecision === 'defer',
      };
      this.acceptIdempotency.set(idemKey, response);
      invite.status = 'accepted';
      invite.acceptedBy = appUserId;
      return response;
    }

    const membershipId = randomUUID() as MembershipId;
    this.memberships.push({
      membershipId,
      familyId: invite.familyId,
      appUserId,
      role: 'caregiver',
      status: 'active',
      joinedAt: now,
    });
    invite.status = 'accepted';
    invite.acceptedBy = appUserId;
    const response: AcceptInvitationResponse = {
      invitationId: invite.invitationId,
      familyId: invite.familyId,
      membershipId,
      role: 'caregiver',
      familyDisplayName: family.displayName,
      created: true,
      childLinkDecision: request.childLinkDecision,
      mergeDeferred: request.childLinkDecision === 'defer',
    };
    this.acceptIdempotency.set(idemKey, response);
    return response;
  }

  revokeMembership(
    actorId: AppUserId,
    familyId: FamilyId,
    membershipId: MembershipId,
  ): { revoked: boolean } {
    const admin = authorizeFamilyAdminAction({
      memberships: this.memberships,
      appUserId: actorId,
      familyId,
      action: 'revoke_member',
    });
    if (!admin.allow) throw codedError('forbidden', admin.reason);
    const target = this.memberships.find(
      (item) => item.membershipId === membershipId && item.familyId === familyId,
    );
    if (!target) throw codedError('not_found', 'membership_not_found');
    if (target.status === 'revoked') return { revoked: false };
    if (
      wouldLeaveFamilyWithoutAdmin({
        memberships: this.memberships,
        familyId,
        revokeMembershipId: membershipId,
      })
    ) {
      throw codedError('conflict', 'last_admin');
    }
    const index = this.memberships.indexOf(target);
    this.memberships[index] = { ...target, status: 'revoked' };
    return { revoked: true };
  }

  transferAdmin(
    actorId: AppUserId,
    familyId: FamilyId,
    targetMembershipId: MembershipId,
    now: string,
  ): { transferred: boolean } {
    const admin = authorizeFamilyAdminAction({
      memberships: this.memberships,
      appUserId: actorId,
      familyId,
      action: 'transfer_admin',
    });
    if (!admin.allow) throw codedError('forbidden', admin.reason);
    const actor = this.memberships.find(
      (item) =>
        item.familyId === familyId &&
        item.appUserId === actorId &&
        item.status === 'active' &&
        item.role === 'admin',
    );
    const target = this.memberships.find(
      (item) =>
        item.membershipId === targetMembershipId &&
        item.familyId === familyId &&
        item.status === 'active',
    );
    if (!actor || !target) throw codedError('not_found', 'membership_not_found');
    if (target.membershipId === actor.membershipId) return { transferred: false };

    const actorIndex = this.memberships.indexOf(actor);
    const targetIndex = this.memberships.indexOf(target);
    this.memberships[targetIndex] = { ...target, role: 'admin' };
    this.memberships[actorIndex] = { ...actor, role: 'caregiver' };
    void now;
    return { transferred: true };
  }

  /**
   * Soft-erase after the durable off-host registry write already succeeded.
   * Physical rotation of restic copies stays a retention job, not this call.
   */
  eraseFamily(
    actorId: AppUserId,
    familyId: FamilyId,
    now: string,
    proof: { readonly eraseGeneration: number; readonly registryPersisted: true },
  ): {
    familyId: FamilyId;
    erased: boolean;
    eraseGeneration: number;
    registryPersisted: true;
    physicalCopiesPendingRetention: true;
  } {
    void proof;
    const admin = authorizeFamilyAdminAction({
      memberships: this.memberships,
      appUserId: actorId,
      familyId,
      action: 'erase_family',
    });
    if (!admin.allow) throw codedError('forbidden', admin.reason);
    const family = this.families.get(familyId);
    if (!family) throw codedError('not_found', 'family_not_found');
    if (family.erasedAt) {
      return {
        familyId,
        erased: false,
        eraseGeneration: proof.eraseGeneration,
        registryPersisted: true,
        physicalCopiesPendingRetention: true,
      };
    }
    this.families.set(familyId, { ...family, erasedAt: now });
    for (let i = 0; i < this.memberships.length; i += 1) {
      const item = this.memberships[i]!;
      if (item.familyId === familyId && item.status === 'active') {
        this.memberships[i] = { ...item, status: 'revoked' };
      }
    }
    for (const invite of this.invitations) {
      if (invite.familyId === familyId && invite.status === 'pending') {
        invite.status = 'revoked';
      }
    }
    return {
      familyId,
      erased: true,
      eraseGeneration: proof.eraseGeneration,
      registryPersisted: true,
      physicalCopiesPendingRetention: true,
    };
  }

  addObject(familyId: FamilyId, kind: string, label: string, now: string): FamilyObjectRecord {
    const record: FamilyObjectRecord = {
      objectId: randomUUID(),
      familyId,
      kind,
      label,
      createdAt: now,
    };
    this.objects.push(record);
    return record;
  }

  getObject(objectId: string): FamilyObjectRecord | null {
    return this.objects.find((item) => item.objectId === objectId) ?? null;
  }

  listMemberships(appUserId: AppUserId): readonly FamilyMembership[] {
    return this.memberships.filter((item) => item.appUserId === appUserId);
  }

  allMemberships(): readonly FamilyMembership[] {
    return this.memberships;
  }

  private requireActiveFamily(familyId: FamilyId): FamilyRecord {
    const family = this.families.get(familyId);
    if (!family || family.erasedAt) throw codedError('not_found', 'family_not_found');
    return family;
  }

  private findUsableInvitation(
    token: string,
    now: string,
    options: { consumeAttempt: boolean },
  ): InvitationRecord {
    const tokenHash = hashInvitationToken(token);
    const invite = this.invitations.find((item) => invitationTokenMatches(token, item.tokenHash));
    if (!invite) throw codedError('not_found', 'invitation_not_found');
    if (invite.status === 'revoked') throw codedError('forbidden', 'invitation_revoked');
    if (invite.status === 'accepted') throw codedError('conflict', 'invitation_already_used');
    if (Date.parse(invite.expiresAt) <= Date.parse(now) || invite.status === 'expired') {
      invite.status = 'expired';
      throw codedError('forbidden', 'invitation_expired');
    }
    if (options.consumeAttempt) {
      invite.attempts += 1;
      if (invite.attempts > LUMI_API_LIMITS.invitationMaxAttempts) {
        invite.status = 'revoked';
        throw codedError('forbidden', 'invitation_attempts_exceeded');
      }
    }
    void tokenHash;
    return invite;
  }
}

function clampTtl(requested: number | undefined): number {
  const value = requested ?? LUMI_API_LIMITS.invitationDefaultTtlSeconds;
  if (!Number.isFinite(value) || value <= 0) {
    throw codedError('validation', 'invalid_ttl');
  }
  return Math.min(value, LUMI_API_LIMITS.invitationMaxTtlSeconds);
}

function codedError(code: string, reason: string): Error {
  return Object.assign(new Error(reason), { code, reason });
}
