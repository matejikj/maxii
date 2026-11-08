import type { AppUserId, FamilyId, FamilyRole } from './ids.ts';
import type { FamilyMembership } from './identity.ts';

/**
 * Application-layer tenant gate. familyId from the path is never enough —
 * membership must be active for the authenticated appUserId.
 */
export type AuthorizationDecision =
  | { readonly allow: true; readonly role: FamilyRole }
  | { readonly allow: false; readonly reason: 'not_member' | 'revoked' | 'role_denied' };

export function authorizeFamilyAccess(input: {
  readonly memberships: readonly FamilyMembership[];
  readonly appUserId: AppUserId;
  readonly familyId: FamilyId;
  readonly requiredRoles?: readonly FamilyRole[];
}): AuthorizationDecision {
  const match = input.memberships.find(
    (item) => item.appUserId === input.appUserId && item.familyId === input.familyId,
  );
  if (!match) return { allow: false, reason: 'not_member' };
  if (match.status !== 'active') return { allow: false, reason: 'revoked' };
  if (input.requiredRoles && !input.requiredRoles.includes(match.role)) {
    return { allow: false, reason: 'role_denied' };
  }
  return { allow: true, role: match.role };
}

/**
 * Bind an external (issuer, subject) to a stable appUserId. Same e-mail on two
 * issuers must not auto-merge; revoked bindings stay rejected.
 */
export function resolveActiveBinding(input: {
  readonly bindings: readonly {
    readonly appUserId: AppUserId;
    readonly issuer: string;
    readonly subject: string;
    readonly revokedAt: string | null;
  }[];
  readonly issuer: string;
  readonly subject: string;
}): AppUserId | null {
  const hit = input.bindings.find(
    (item) =>
      item.issuer === input.issuer &&
      item.subject === input.subject &&
      item.revokedAt == null,
  );
  return hit?.appUserId ?? null;
}
