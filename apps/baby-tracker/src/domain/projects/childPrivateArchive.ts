import type { ActorId } from '../ids';
import {
  CHILD_PRIVATE_EXPORT_EXCLUDED_CATEGORIES,
  planChildPrivateExport,
  type ChildPrivateExportExcludedCategory,
  type ChildPrivateExportFilters,
  type ChildPrivateExportManifest,
} from './childPrivateExport';
import type { PortfolioItem, Project, ShareSnapshot } from './types';

/** Logical owner archive for the child's private workspace — never a diary dump. */
export const CHILD_PRIVATE_ARCHIVE_FORMAT = 'lumi.child-private-archive.v1' as const;

/** Archives above this compatibility id need a newer reader. */
export const CHILD_PRIVATE_ARCHIVE_MAX_COMPAT = 1;

export type ChildPrivateArchiveManifest = ChildPrivateExportManifest & {
  readonly createdAtMs: number;
  readonly schemaCompatibility: number;
  readonly format: typeof CHILD_PRIVATE_ARCHIVE_FORMAT;
};

/**
 * Cross-device logical snapshot of one child's private workspace. Care history,
 * credentials and familyGuided rows must never appear here.
 */
export type ChildPrivateArchive = {
  readonly format: typeof CHILD_PRIVATE_ARCHIVE_FORMAT;
  readonly manifest: ChildPrivateArchiveManifest;
  readonly projects: Project[];
  readonly portfolio: PortfolioItem[];
  readonly shares: ShareSnapshot[];
};

export type ChildPrivateArchiveBuildResult =
  | { readonly ok: true; readonly archive: ChildPrivateArchive }
  | { readonly ok: false; readonly reason: 'child_mode_inactive' };

/**
 * Rebuild counts from entities so a tampered manifest cannot hide foreign rows
 * that somehow slipped into the arrays.
 */
export function buildChildPrivateArchiveManifest(input: {
  readonly ownerAppUserId: ActorId;
  readonly createdAtMs: number;
  readonly schemaCompatibility: number;
  readonly projects: readonly Project[];
  readonly portfolio: readonly PortfolioItem[];
  readonly shares: readonly ShareSnapshot[];
}): ChildPrivateArchiveManifest {
  const revokedShareCount = input.shares.filter((share) => share.revokedAt != null).length;
  return {
    format: CHILD_PRIVATE_ARCHIVE_FORMAT,
    createdAtMs: input.createdAtMs,
    schemaCompatibility: input.schemaCompatibility,
    ownerAppUserId: input.ownerAppUserId,
    projectCount: input.projects.length,
    portfolioCount: input.portfolio.length,
    shareCount: input.shares.length,
    activeShareCount: input.shares.length - revokedShareCount,
    revokedShareCount,
    excludedFamilyHistory: true,
    excludedCategories: CHILD_PRIVATE_EXPORT_EXCLUDED_CATEGORIES,
  };
}

/**
 * Turns an owner export plan into a portable logical archive. Inactive mode
 * yields no file — never an empty “success” archive of someone else's rows.
 */
export function createChildPrivateArchive(input: {
  readonly ownerAppUserId: ActorId;
  readonly childPrivateModeActive: boolean;
  readonly createdAtMs: number;
  readonly schemaCompatibility?: number | undefined;
  readonly projects: readonly Project[];
  readonly portfolio: readonly PortfolioItem[];
  readonly shares: readonly ShareSnapshot[];
  readonly filters?: ChildPrivateExportFilters | undefined;
}): ChildPrivateArchiveBuildResult {
  const plan = planChildPrivateExport({
    ownerAppUserId: input.ownerAppUserId,
    childPrivateModeActive: input.childPrivateModeActive,
    projects: input.projects,
    portfolio: input.portfolio,
    shares: input.shares,
    filters: input.filters,
  });
  if (!plan.ok) {
    return { ok: false, reason: 'child_mode_inactive' };
  }
  const schemaCompatibility = input.schemaCompatibility ?? CHILD_PRIVATE_ARCHIVE_MAX_COMPAT;
  const manifest = buildChildPrivateArchiveManifest({
    ownerAppUserId: input.ownerAppUserId,
    createdAtMs: input.createdAtMs,
    schemaCompatibility,
    projects: plan.projects,
    portfolio: plan.portfolio,
    shares: plan.shares,
  });
  return {
    ok: true,
    archive: {
      format: CHILD_PRIVATE_ARCHIVE_FORMAT,
      manifest,
      projects: plan.projects,
      portfolio: plan.portfolio,
      shares: plan.shares,
    },
  };
}

/** Stable JSON for sealing or writing to disk — key order is not security-critical. */
export function serializeChildPrivateArchive(archive: ChildPrivateArchive): string {
  return JSON.stringify(archive);
}

export type { ChildPrivateExportExcludedCategory };
