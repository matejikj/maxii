/**
 * Server-side owner/grant decisions for child-private rows. Mirrors the SQL
 * RLS policies so unit tests can assert the matrix without a live database.
 * Identity always comes from the authenticated session principal — never from
 * an ownerAppUserId field supplied in a request body.
 */

export type ChildPrivateServerPrincipalKind =
  | 'owner'
  | 'named_recipient'
  | 'other_adult_admin'
  | 'other_adult_caregiver'
  | 'other_child'
  | 'foreign_family'
  | 'inactive_member';

export type ChildPrivateServerResource =
  'project' | 'portfolio' | 'share_snapshot' | 'list' | 'count' | 'export' | 'restore' | 'wipe';

export type ChildPrivateServerAction =
  'read' | 'write' | 'delete' | 'list' | 'count' | 'export' | 'restore' | 'wipe';

export type ChildPrivateServerDecision = {
  readonly allowed: boolean;
  readonly reason:
    | 'owner'
    | 'named_recipient_read_share'
    | 'denied_not_owner'
    | 'denied_family_admin'
    | 'denied_sibling'
    | 'denied_foreign'
    | 'denied_inactive'
    | 'denied_share_revoked'
    | 'denied_not_in_audience'
    | 'denied_live_project_to_recipient';
};

export type ChildPrivateServerAccessInput = {
  readonly principalKind: ChildPrivateServerPrincipalKind;
  /** Authenticated session subject — the only trusted identity. */
  readonly sessionAppUserId: string;
  readonly resource: ChildPrivateServerResource;
  readonly action: ChildPrivateServerAction;
  readonly ownerAppUserId: string;
  readonly share?: {
    readonly audienceAppUserIds: readonly string[];
    readonly revokedAtMs: number | null;
  } | null;
};

/**
 * Family admin/caregiver membership never elevates into child-private access.
 * Recipients may only read an active share snapshot they are listed on.
 */
export function evaluateChildPrivateServerAccess(
  input: ChildPrivateServerAccessInput,
): ChildPrivateServerDecision {
  if (input.principalKind === 'foreign_family') {
    return { allowed: false, reason: 'denied_foreign' };
  }
  if (input.principalKind === 'inactive_member') {
    return { allowed: false, reason: 'denied_inactive' };
  }
  if (input.principalKind === 'other_child') {
    return { allowed: false, reason: 'denied_sibling' };
  }
  if (
    input.principalKind === 'other_adult_admin' ||
    input.principalKind === 'other_adult_caregiver'
  ) {
    return { allowed: false, reason: 'denied_family_admin' };
  }

  if (input.principalKind === 'owner') {
    if (input.sessionAppUserId !== input.ownerAppUserId) {
      // Spoofed "owner" kind with a mismatched session must still deny.
      return { allowed: false, reason: 'denied_not_owner' };
    }
    return { allowed: true, reason: 'owner' };
  }

  // named_recipient
  if (input.resource !== 'share_snapshot' || input.action !== 'read') {
    return { allowed: false, reason: 'denied_live_project_to_recipient' };
  }
  if (input.share == null) {
    return { allowed: false, reason: 'denied_not_in_audience' };
  }
  if (input.share.revokedAtMs != null) {
    return { allowed: false, reason: 'denied_share_revoked' };
  }
  if (!input.share.audienceAppUserIds.includes(input.sessionAppUserId)) {
    return { allowed: false, reason: 'denied_not_in_audience' };
  }
  return { allowed: true, reason: 'named_recipient_read_share' };
}

/** Explicit product rule kept as a typed constant for drills and docs. */
export function familyAdminIsChildPrivateSuperuserOnServer(): false {
  return false;
}
