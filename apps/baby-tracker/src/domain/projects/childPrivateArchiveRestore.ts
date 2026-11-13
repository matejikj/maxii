import type { ActorId } from '../ids';
import type { ChildPrivateArchive } from './childPrivateArchive';
import type { PortfolioItem, Project, ShareSnapshot } from './types';

export type ChildPrivateArchiveCompare = {
  readonly liveOwnerAppUserId: ActorId;
  readonly archiveOwnerAppUserId: ActorId;
  readonly liveProjectCount: number;
  readonly archiveProjectCount: number;
  readonly livePortfolioCount: number;
  readonly archivePortfolioCount: number;
  readonly liveShareCount: number;
  readonly archiveShareCount: number;
  /** Soft replace never merges foreign caregivers into the private workspace. */
  readonly merges: false;
  readonly replacesOwnerWorkspace: true;
  readonly ownersMatch: boolean;
};

export type ChildPrivateArchiveRestorePreview = {
  readonly status: 'ready' | 'blocked';
  readonly blockedReason: string | null;
  readonly compare: ChildPrivateArchiveCompare;
  /** Soft restore never invents a credential reset or family history pull. */
  readonly credentialsIncluded: false;
  readonly familyHistoryAutoTransfer: false;
  readonly liveRestoreClaimed: false;
};

export type ChildPrivateArchiveStaging = {
  readonly projects: Project[];
  readonly portfolio: PortfolioItem[];
  readonly shares: ShareSnapshot[];
};

export type ChildPrivateArchiveApplyResult =
  | {
      readonly ok: true;
      readonly staging: ChildPrivateArchiveStaging;
      readonly revokedSharesPreserved: number;
    }
  | {
      readonly ok: false;
      readonly reason:
        | 'child_mode_inactive'
        | 'recovery_gate_closed'
        | 'owner_mismatch'
        | 'foreign_rows_in_archive';
      readonly staging: null;
    };

function countOwnerRows(input: {
  readonly ownerAppUserId: ActorId;
  readonly projects: readonly Project[];
  readonly portfolio: readonly PortfolioItem[];
  readonly shares: readonly ShareSnapshot[];
}) {
  return {
    projectCount: input.projects.filter(
      (row) => row.scope === 'childPrivate' && row.ownerAppUserId === input.ownerAppUserId,
    ).length,
    portfolioCount: input.portfolio.filter((row) => row.ownerAppUserId === input.ownerAppUserId)
      .length,
    shareCount: input.shares.filter((row) => row.ownerAppUserId === input.ownerAppUserId).length,
  };
}

/** Side-by-side counts before a soft replace of the owner's private workspace. */
export function compareChildPrivateArchive(input: {
  readonly liveOwnerAppUserId: ActorId;
  readonly liveProjects: readonly Project[];
  readonly livePortfolio: readonly PortfolioItem[];
  readonly liveShares: readonly ShareSnapshot[];
  readonly archive: ChildPrivateArchive;
}): ChildPrivateArchiveCompare {
  const live = countOwnerRows({
    ownerAppUserId: input.liveOwnerAppUserId,
    projects: input.liveProjects,
    portfolio: input.livePortfolio,
    shares: input.liveShares,
  });
  return {
    liveOwnerAppUserId: input.liveOwnerAppUserId,
    archiveOwnerAppUserId: input.archive.manifest.ownerAppUserId,
    liveProjectCount: live.projectCount,
    archiveProjectCount: input.archive.manifest.projectCount,
    livePortfolioCount: live.portfolioCount,
    archivePortfolioCount: input.archive.manifest.portfolioCount,
    liveShareCount: live.shareCount,
    archiveShareCount: input.archive.manifest.shareCount,
    merges: false,
    replacesOwnerWorkspace: true,
    ownersMatch: input.liveOwnerAppUserId === input.archive.manifest.ownerAppUserId,
  };
}

/**
 * Honest preview of a soft archive restore. Live credential recovery stays a
 * separate gate — this only describes what the archive would replace.
 */
export function previewChildPrivateArchiveRestore(input: {
  readonly liveOwnerAppUserId: ActorId;
  readonly childPrivateModeActive: boolean;
  readonly supportedRecovery: boolean;
  readonly liveProjects: readonly Project[];
  readonly livePortfolio: readonly PortfolioItem[];
  readonly liveShares: readonly ShareSnapshot[];
  readonly archive: ChildPrivateArchive;
}): ChildPrivateArchiveRestorePreview {
  const compare = compareChildPrivateArchive(input);
  const common = {
    compare,
    credentialsIncluded: false,
    familyHistoryAutoTransfer: false,
    liveRestoreClaimed: false,
  } as const;

  if (!input.childPrivateModeActive) {
    return {
      ...common,
      status: 'blocked',
      blockedReason: 'Soukromý prostor není aktivní — archiv se neaplikuje.',
    };
  }
  if (!input.supportedRecovery) {
    return {
      ...common,
      status: 'blocked',
      blockedReason: 'Podporovaná obnova přístupu ještě není ověřená.',
    };
  }
  if (!compare.ownersMatch) {
    return {
      ...common,
      status: 'blocked',
      blockedReason: 'Archiv patří jinému účtu a do tohoto workspace se neaplikuje.',
    };
  }
  return {
    ...common,
    status: 'ready',
    blockedReason: null,
  };
}

/**
 * Soft staging replace for one owner's private rows. Foreign live rows stay
 * untouched; revoked shares remain revoked (restore must not republish).
 */
export function applyChildPrivateArchiveToStaging(input: {
  readonly liveOwnerAppUserId: ActorId;
  readonly childPrivateModeActive: boolean;
  readonly supportedRecovery: boolean;
  readonly liveProjects: readonly Project[];
  readonly livePortfolio: readonly PortfolioItem[];
  readonly liveShares: readonly ShareSnapshot[];
  readonly archive: ChildPrivateArchive;
}): ChildPrivateArchiveApplyResult {
  const preview = previewChildPrivateArchiveRestore(input);
  if (preview.status === 'blocked') {
    const reason = !input.childPrivateModeActive
      ? 'child_mode_inactive'
      : !input.supportedRecovery
        ? 'recovery_gate_closed'
        : 'owner_mismatch';
    return { ok: false, reason, staging: null };
  }

  for (const project of input.archive.projects) {
    if (project.scope !== 'childPrivate' || project.ownerAppUserId !== input.liveOwnerAppUserId) {
      return { ok: false, reason: 'foreign_rows_in_archive', staging: null };
    }
  }

  // Keep every non-owner live row; replace only this owner's private surface.
  const projects = [
    ...input.liveProjects.filter(
      (row) => !(row.scope === 'childPrivate' && row.ownerAppUserId === input.liveOwnerAppUserId),
    ),
    ...input.archive.projects,
  ];
  const portfolio = [
    ...input.livePortfolio.filter((row) => row.ownerAppUserId !== input.liveOwnerAppUserId),
    ...input.archive.portfolio,
  ];
  const shares = [
    ...input.liveShares.filter((row) => row.ownerAppUserId !== input.liveOwnerAppUserId),
    ...input.archive.shares,
  ];
  const revokedSharesPreserved = input.archive.shares.filter(
    (share) => share.revokedAt != null,
  ).length;

  return {
    ok: true,
    staging: { projects, portfolio, shares },
    revokedSharesPreserved,
  };
}
