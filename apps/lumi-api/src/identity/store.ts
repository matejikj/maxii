import { randomUUID } from 'node:crypto';
import type {
  AppUserId,
  CreateFamilyRequest,
  CreateFamilyResponse,
  ExternalIdentityBinding,
  FamilyId,
  FamilyMembership,
  MembershipId,
} from '@lumi/contracts';
import { LUMI_API_LIMITS, LUMI_API_PROTOCOL_VERSION } from '@lumi/contracts';

export type FamilyRecord = {
  readonly familyId: FamilyId;
  readonly displayName: string;
  readonly createdAt: string;
  readonly createdBy: AppUserId;
};

export type FamilyObjectRecord = {
  readonly objectId: string;
  readonly familyId: FamilyId;
  readonly kind: string;
  readonly label: string;
  readonly createdAt: string;
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
  readonly idempotency = new Map<string, CreateFamilyResponse>();

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
        throw new Error('external_identity_collision');
      }
      return;
    }
    this.bindings.push({
      appUserId: input.appUserId,
      issuer: input.issuer,
      subject: input.subject,
      boundAt: input.now,
      revokedAt: null,
    });
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
      throw Object.assign(new Error('unsupported_schema'), { code: 'unsupported_schema' });
    }
    if (
      !request.idempotencyKey ||
      request.idempotencyKey.length > LUMI_API_LIMITS.maxIdempotencyKeyLength
    ) {
      throw Object.assign(new Error('validation'), { code: 'validation' });
    }
    const displayName = request.displayName.trim();
    if (!displayName || displayName.length > LUMI_API_LIMITS.maxDisplayNameLength) {
      throw Object.assign(new Error('validation'), { code: 'validation' });
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
}
