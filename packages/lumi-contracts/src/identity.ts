import type { AppUserId, DeviceId, FamilyId, FamilyRole, MembershipId } from './ids.ts';
import { LUMI_API_PROTOCOL_VERSION } from './protocol.ts';

/** External OIDC subject is mapped once; product code uses only appUserId. */
export type ExternalIdentityRef = {
  readonly issuer: string;
  readonly subject: string;
};

export type AppUserRecord = {
  readonly appUserId: AppUserId;
  readonly createdAt: string;
  readonly status: 'active' | 'revoked';
};

export type ExternalIdentityBinding = {
  readonly appUserId: AppUserId;
  readonly issuer: string;
  readonly subject: string;
  readonly boundAt: string;
  readonly revokedAt: string | null;
};

export type FamilyMembership = {
  readonly membershipId: MembershipId;
  readonly familyId: FamilyId;
  readonly appUserId: AppUserId;
  readonly role: FamilyRole;
  readonly status: 'active' | 'revoked';
  readonly joinedAt: string;
};

export type CreateFamilyRequest = {
  readonly protocolVersion: typeof LUMI_API_PROTOCOL_VERSION;
  readonly idempotencyKey: string;
  readonly displayName: string;
};

export type CreateFamilyResponse = {
  readonly familyId: FamilyId;
  readonly membershipId: MembershipId;
  readonly role: 'admin';
  readonly created: boolean;
};

export type SessionPrincipal = {
  readonly appUserId: AppUserId;
  readonly deviceId: DeviceId | null;
  readonly issuer: string;
  readonly subject: string;
  readonly expiresAt: string;
};
