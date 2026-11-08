/** Opaque product identities — never provider subjects or e-mail addresses. */
export type AppUserId = string & { readonly __brand: 'AppUserId' };
export type DeviceId = string & { readonly __brand: 'DeviceId' };
export type FamilyId = string & { readonly __brand: 'FamilyId' };
export type MembershipId = string & { readonly __brand: 'MembershipId' };

export const FAMILY_ROLES = ['admin', 'caregiver'] as const;
export type FamilyRole = (typeof FAMILY_ROLES)[number];

export function isFamilyRole(value: unknown): value is FamilyRole {
  return typeof value === 'string' && (FAMILY_ROLES as readonly string[]).includes(value);
}
