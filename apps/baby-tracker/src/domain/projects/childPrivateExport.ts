import type { ActorId, ChildId } from '../ids';
import { evaluateProjectAccess } from './privacy';
import type { PortfolioItem, Project, ProjectStatus, ShareSnapshot } from './types';

/** Optional narrowing of an owner export; filters never widen the owner boundary. */
export type ChildPrivateExportFilters = {
  readonly childId?: ChildId | undefined;
  readonly statuses?: readonly ProjectStatus[] | undefined;
  readonly includePortfolio?: boolean | undefined;
  readonly includeShares?: boolean | undefined;
  readonly includeRevokedShares?: boolean | undefined;
};

export type ChildPrivateExportManifest = {
  readonly ownerAppUserId: ActorId;
  readonly projectCount: number;
  readonly portfolioCount: number;
  /** Share snapshots authored by the owner (active + revoked when included). */
  readonly shareCount: number;
  readonly activeShareCount: number;
  readonly revokedShareCount: number;
  /** Family history and caregiver data are never part of a child archive. */
  readonly excludedFamilyHistory: true;
  readonly excludedCategories: readonly ChildPrivateExportExcludedCategory[];
};

export type ChildPrivateExportExcludedCategory =
  | 'family_guided_projects'
  | 'family_care_history'
  | 'infant_diary'
  | 'foreign_private_projects'
  | 'foreign_shares'
  | 'credentials';

export const CHILD_PRIVATE_EXPORT_EXCLUDED_CATEGORIES: readonly ChildPrivateExportExcludedCategory[] =
  [
    'family_guided_projects',
    'family_care_history',
    'infant_diary',
    'foreign_private_projects',
    'foreign_shares',
    'credentials',
  ];

export type ChildPrivateExportPlan =
  | {
      readonly ok: true;
      readonly projects: Project[];
      readonly portfolio: PortfolioItem[];
      readonly shares: ShareSnapshot[];
      readonly manifest: ChildPrivateExportManifest;
    }
  | {
      readonly ok: false;
      readonly reason: 'child_mode_inactive';
      readonly projects: readonly [];
      readonly portfolio: readonly [];
      readonly shares: readonly [];
      readonly manifest: null;
    };

/**
 * Inverse of the caregiver family export: only childPrivate rows owned by this
 * app user. familyGuided, foreign private and caregiver rows never qualify.
 */
export function filterProjectsForChildPrivateExport(input: {
  readonly projects: readonly Project[];
  readonly ownerAppUserId: ActorId;
  readonly childPrivateModeActive: boolean;
  readonly filters?: ChildPrivateExportFilters | undefined;
}): Project[] {
  const filters = input.filters ?? {};
  return input.projects.filter((project) => {
    if (project.scope !== 'childPrivate') return false;
    if (project.ownerAppUserId !== input.ownerAppUserId) return false;
    if (filters.childId != null && project.childId !== filters.childId) return false;
    if (filters.statuses != null && !filters.statuses.includes(project.status)) return false;
    return evaluateProjectAccess('export', {
      principalKind: 'owner',
      principalAppUserId: input.ownerAppUserId,
      childPrivateModeActive: input.childPrivateModeActive,
      project,
    }).allowed;
  });
}

/** Portfolio rows follow the exported projects and the owner — never by child id alone. */
export function filterPortfolioForChildPrivateExport(input: {
  readonly items: readonly PortfolioItem[];
  readonly exportedProjectIds: ReadonlySet<string>;
  readonly ownerAppUserId: ActorId;
}): PortfolioItem[] {
  return input.items.filter(
    (item) =>
      item.ownerAppUserId === input.ownerAppUserId &&
      input.exportedProjectIds.has(item.projectId),
  );
}

/** Own share snapshots only; revoked ones appear only when explicitly requested. */
export function filterSharesForChildPrivateExport(input: {
  readonly shares: readonly ShareSnapshot[];
  readonly exportedProjectIds: ReadonlySet<string>;
  readonly ownerAppUserId: ActorId;
  readonly includeRevoked?: boolean | undefined;
}): ShareSnapshot[] {
  return input.shares.filter((share) => {
    if (share.ownerAppUserId !== input.ownerAppUserId) return false;
    if (!input.exportedProjectIds.has(share.sourceProjectId)) return false;
    if (share.revokedAt != null && input.includeRevoked !== true) return false;
    return true;
  });
}

/**
 * Owner-scoped child archive plan: filtered rows plus a manifest of counts.
 * Blocked entirely while the private workspace is inactive.
 */
export function planChildPrivateExport(input: {
  readonly ownerAppUserId: ActorId;
  readonly childPrivateModeActive: boolean;
  readonly projects: readonly Project[];
  readonly portfolio: readonly PortfolioItem[];
  readonly shares: readonly ShareSnapshot[];
  readonly filters?: ChildPrivateExportFilters | undefined;
}): ChildPrivateExportPlan {
  if (!input.childPrivateModeActive) {
    return {
      ok: false,
      reason: 'child_mode_inactive',
      projects: [],
      portfolio: [],
      shares: [],
      manifest: null,
    };
  }
  const filters = input.filters ?? {};
  const projects = filterProjectsForChildPrivateExport({
    projects: input.projects,
    ownerAppUserId: input.ownerAppUserId,
    childPrivateModeActive: true,
    filters,
  });
  const exportedProjectIds = new Set(projects.map((project) => project.projectId as string));
  const portfolio =
    filters.includePortfolio === false
      ? []
      : filterPortfolioForChildPrivateExport({
          items: input.portfolio,
          exportedProjectIds,
          ownerAppUserId: input.ownerAppUserId,
        });
  const shares =
    filters.includeShares === false
      ? []
      : filterSharesForChildPrivateExport({
          shares: input.shares,
          exportedProjectIds,
          ownerAppUserId: input.ownerAppUserId,
          includeRevoked: filters.includeRevokedShares,
        });
  const revokedShareCount = shares.filter((share) => share.revokedAt != null).length;
  return {
    ok: true,
    projects,
    portfolio,
    shares,
    manifest: {
      ownerAppUserId: input.ownerAppUserId,
      projectCount: projects.length,
      portfolioCount: portfolio.length,
      shareCount: shares.length,
      activeShareCount: shares.length - revokedShareCount,
      revokedShareCount,
      excludedFamilyHistory: true,
      excludedCategories: CHILD_PRIVATE_EXPORT_EXCLUDED_CATEGORIES,
    },
  };
}
