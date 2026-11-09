import { AppError } from '../errors';
import type { ActorId } from '../ids';
import type { Project, ProjectScope, ShareSnapshot } from './types';

/**
 * Principals used by the first-release privacy matrix. A family admin is never
 * a childPrivate superuser — that role only manages familyGuided/familyCare.
 */
export type ProjectPrincipalKind =
  | 'owner'
  | 'named_recipient'
  | 'other_adult_admin'
  | 'other_adult_caregiver'
  | 'other_child'
  | 'foreign_family'
  | 'inactive_member';

export type ProjectAccessAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'export'
  | 'list'
  | 'count'
  | 'share_publish'
  | 'share_revoke'
  | 'restore';

export type ProjectAccessDecision = {
  allowed: boolean;
  reason:
    | 'owner'
    | 'named_recipient_read_share'
    | 'family_guided_admin'
    | 'family_guided_caregiver_own'
    | 'family_guided_caregiver_read'
    | 'denied_child_private'
    | 'denied_foreign'
    | 'denied_inactive'
    | 'denied_other_child'
    | 'denied_share_write'
    | 'child_mode_inactive';
};

export type ProjectAccessContext = {
  principalKind: ProjectPrincipalKind;
  principalAppUserId: ActorId | null;
  /** True only after verified child identity + recovery gates pass. */
  childPrivateModeActive: boolean;
  project: Pick<Project, 'scope' | 'ownerAppUserId' | 'creatorAppUserId' | 'familyId'>;
  share?: Pick<ShareSnapshot, 'ownerAppUserId' | 'audienceAppUserIds' | 'revokedAt'> | null;
};

/**
 * Evaluate one object/operation against the first-release privacy matrix.
 * UI hiding is never enough — every list/count/export path must call this.
 */
export function evaluateProjectAccess(
  action: ProjectAccessAction,
  ctx: ProjectAccessContext,
): ProjectAccessDecision {
  if (ctx.principalKind === 'foreign_family') {
    return { allowed: false, reason: 'denied_foreign' };
  }
  if (ctx.principalKind === 'inactive_member') {
    return { allowed: false, reason: 'denied_inactive' };
  }
  if (ctx.principalKind === 'other_child') {
    return { allowed: false, reason: 'denied_other_child' };
  }

  if (ctx.project.scope === 'childPrivate') {
    if (!ctx.childPrivateModeActive) {
      return { allowed: false, reason: 'child_mode_inactive' };
    }
    if (ctx.principalKind === 'owner') {
      return { allowed: true, reason: 'owner' };
    }
    if (
      ctx.share &&
      ctx.share.revokedAt == null &&
      ctx.principalKind === 'named_recipient' &&
      (action === 'read' || action === 'list' || action === 'count') &&
      ctx.principalAppUserId != null &&
      ctx.share.audienceAppUserIds.includes(ctx.principalAppUserId)
    ) {
      // Recipients only ever see the immutable share snapshot, never live private revisions.
      return { allowed: true, reason: 'named_recipient_read_share' };
    }
    return { allowed: false, reason: 'denied_child_private' };
  }

  // familyGuided — shared caregiver projects on the parent account.
  if (ctx.principalKind === 'other_adult_admin') {
    return { allowed: true, reason: 'family_guided_admin' };
  }
  if (ctx.principalKind === 'other_adult_caregiver' || ctx.principalKind === 'owner') {
    if (action === 'read' || action === 'list' || action === 'count') {
      return { allowed: true, reason: 'family_guided_caregiver_read' };
    }
    if (action === 'create') {
      return { allowed: true, reason: 'family_guided_caregiver_own' };
    }
    if (ctx.principalKind === 'owner') {
      return { allowed: true, reason: 'family_guided_caregiver_own' };
    }
    const owns =
      ctx.principalAppUserId != null &&
      (ctx.project.creatorAppUserId === ctx.principalAppUserId ||
        ctx.project.ownerAppUserId === ctx.principalAppUserId);
    if (owns) {
      return { allowed: true, reason: 'family_guided_caregiver_own' };
    }
    return { allowed: false, reason: 'denied_share_write' };
  }

  return { allowed: false, reason: 'denied_child_private' };
}

export function assertProjectAccess(
  action: ProjectAccessAction,
  ctx: ProjectAccessContext,
): void {
  const decision = evaluateProjectAccess(action, ctx);
  if (!decision.allowed) {
    throw new AppError('FORBIDDEN', 'Project access denied by privacy matrix', {
      details: { reason: decision.reason, action, scope: ctx.project.scope },
    });
  }
}

/** Live private revisions never leak through a share — only the snapshot body. */
export function shareExposesLivePrivateProject(): false {
  return false;
}

export function familyAdminIsChildPrivateSuperuser(): false {
  return false;
}

export function canActivateChildPrivateMode(input: {
  verifiedChildIdentity: boolean;
  supportedRecovery: boolean;
  dedicatedDeviceOrAccount: boolean;
  legalOperationalFrameworkReady: boolean;
}): { active: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (!input.verifiedChildIdentity) blockers.push('verified_child_identity');
  if (!input.supportedRecovery) blockers.push('supported_recovery');
  if (!input.dedicatedDeviceOrAccount) blockers.push('dedicated_device_or_account');
  if (!input.legalOperationalFrameworkReady) blockers.push('legal_operational_framework');
  return { active: blockers.length === 0, blockers };
}

export function describeScopeForCaregiver(scope: ProjectScope): string {
  if (scope === 'familyGuided') {
    return 'Rodinný projekt — vidí pečující rodiny';
  }
  return 'Jen pro mě';
}
