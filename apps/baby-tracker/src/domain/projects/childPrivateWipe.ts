import type { ActorId, EntityId } from '../ids';
import type { PortfolioItem, Project, ShareSnapshot } from './types';
import { evaluateProjectAccess, type ProjectPrincipalKind } from './privacy';
import { revokeShareSnapshot } from './shareLifecycle';

/** Exact confirmation phrase — mistyped text must not erase anything. */
export const CHILD_PRIVATE_WIPE_CONFIRMATION = 'SMAZAT VLASTNI' as const;

export type ChildPrivateWipeFailureReason =
  'child_mode_inactive' | 'denied_not_owner' | 'confirmation_mismatch';

export type ChildPrivateWipePlan =
  | {
      readonly ok: true;
      readonly ownerAppUserId: ActorId;
      readonly projectIds: readonly EntityId[];
      readonly portfolioItemIds: readonly EntityId[];
      readonly shareIds: readonly EntityId[];
      readonly projectCount: number;
      readonly portfolioCount: number;
      readonly shareCount: number;
      readonly familyGuidedPreserved: true;
      readonly familyCarePreserved: true;
      readonly familyHistoryAutoTransfer: false;
      readonly liveAccountCancellation: false;
      readonly confirmationPhrase: typeof CHILD_PRIVATE_WIPE_CONFIRMATION;
      readonly summaryLines: readonly string[];
    }
  | {
      readonly ok: false;
      readonly reason: ChildPrivateWipeFailureReason;
    };

export type ChildPrivateWipeStaging = {
  readonly projects: readonly Project[];
  readonly portfolio: readonly PortfolioItem[];
  readonly shares: readonly ShareSnapshot[];
};

/**
 * Owner-only plan for erasing this principal's childPrivate workspace rows.
 * Family-guided projects and other owners' private rows are never selected.
 */
export function planChildPrivateWorkspaceWipe(input: {
  readonly ownerAppUserId: ActorId;
  readonly principalAppUserId: ActorId;
  readonly principalKind: ProjectPrincipalKind;
  readonly childPrivateModeActive: boolean;
  readonly projects: readonly Project[];
  readonly portfolio: readonly PortfolioItem[];
  readonly shares: readonly ShareSnapshot[];
}): ChildPrivateWipePlan {
  if (!input.childPrivateModeActive) {
    return { ok: false, reason: 'child_mode_inactive' };
  }
  if (input.principalKind !== 'owner' || input.principalAppUserId !== input.ownerAppUserId) {
    return { ok: false, reason: 'denied_not_owner' };
  }

  const projects = input.projects.filter((project) => {
    if (project.scope !== 'childPrivate') return false;
    return evaluateProjectAccess('delete', {
      principalKind: 'owner',
      principalAppUserId: input.ownerAppUserId,
      childPrivateModeActive: true,
      project,
    }).allowed;
  });
  const projectIds = new Set(projects.map((project) => project.projectId as string));
  const portfolio = input.portfolio.filter(
    (item) => item.ownerAppUserId === input.ownerAppUserId && projectIds.has(item.projectId),
  );
  const shares = input.shares.filter(
    (share) =>
      share.ownerAppUserId === input.ownerAppUserId && projectIds.has(share.sourceProjectId),
  );

  return {
    ok: true,
    ownerAppUserId: input.ownerAppUserId,
    projectIds: projects.map((project) => project.projectId),
    portfolioItemIds: portfolio.map((item) => item.portfolioItemId),
    shareIds: shares.map((share) => share.shareId),
    projectCount: projects.length,
    portfolioCount: portfolio.length,
    shareCount: shares.length,
    familyGuidedPreserved: true,
    familyCarePreserved: true,
    familyHistoryAutoTransfer: false,
    liveAccountCancellation: false,
    confirmationPhrase: CHILD_PRIVATE_WIPE_CONFIRMATION,
    summaryLines: [
      `Vlastní projekty ke smazání: ${projects.length}.`,
      `Portfolio položky: ${portfolio.length}.`,
      `Ukázky k odvolání: ${shares.length}.`,
      'Rodinná péče a cizí private řádky zůstanou.',
    ],
  };
}

/**
 * Applies an owner wipe plan to in-memory collections. Shares are revoked
 * before drop so a leftover snapshot cannot look active again.
 */
export function applyChildPrivateWorkspaceWipe(input: {
  readonly plan: Extract<ChildPrivateWipePlan, { ok: true }>;
  readonly projects: readonly Project[];
  readonly portfolio: readonly PortfolioItem[];
  readonly shares: readonly ShareSnapshot[];
  readonly wipedAtMs: number;
}): ChildPrivateWipeStaging {
  const dropProjects = new Set(input.plan.projectIds.map((id) => id as string));
  const dropPortfolio = new Set(input.plan.portfolioItemIds.map((id) => id as string));
  const dropShares = new Set(input.plan.shareIds.map((id) => id as string));
  const now = { epochMs: input.wipedAtMs };

  return {
    projects: input.projects.filter((project) => !dropProjects.has(project.projectId)),
    portfolio: input.portfolio.filter((item) => !dropPortfolio.has(item.portfolioItemId)),
    shares: input.shares
      .map((share) => (dropShares.has(share.shareId) ? revokeShareSnapshot(share, now) : share))
      .filter((share) => !dropShares.has(share.shareId)),
  };
}

/** True only when the typed phrase matches exactly (trimmed). */
export function childPrivateWipeConfirmationMatches(typed: string): boolean {
  return typed.trim() === CHILD_PRIVATE_WIPE_CONFIRMATION;
}
