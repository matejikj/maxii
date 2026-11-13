import {
  createChildPrivateArchive,
  parseChildPrivateArchive,
  planChildPrivateExport,
  previewChildPrivateArchiveRestore,
  serializeChildPrivateArchive,
  applyChildPrivateArchiveToStaging,
  type ActorId,
  type ChildPrivateArchive,
  type ChildPrivateArchiveApplyResult,
  type ChildPrivateArchiveRestorePreview,
  type ChildPrivateExportFilters,
  type ChildPrivateExportManifest,
  type PortfolioItem,
  type Project,
  type ShareSnapshot,
  type UnitOfWorkFactory,
} from '../domain';

export type ChildPrivateExportPreview = {
  /** False while the private workspace is inactive — nothing is counted. */
  readonly available: boolean;
  readonly manifest: ChildPrivateExportManifest | null;
  /** Czech summary lines derived only from real counts. */
  readonly summaryLines: readonly string[];
  /**
   * True only when a logical archive object was built for this preview.
   * Sealing to a password file remains a separate portable-backup step.
   */
  readonly fileGenerated: boolean;
  readonly archive: ChildPrivateArchive | null;
  readonly archiveJson: string | null;
};

const UNAVAILABLE: ChildPrivateExportPreview = {
  available: false,
  manifest: null,
  summaryLines: [],
  fileGenerated: false,
  archive: null,
  archiveJson: null,
};

function describeManifest(manifest: ChildPrivateExportManifest): string[] {
  if (manifest.projectCount === 0 && manifest.portfolioCount === 0 && manifest.shareCount === 0) {
    return ['Zatím není co exportovat — vlastní prostor je prázdný.'];
  }
  return [
    `Projekty: ${manifest.projectCount}`,
    `Portfolio: ${manifest.portfolioCount}`,
    `Ukázky: ${manifest.shareCount} (aktivní ${manifest.activeShareCount}, odvolané ${manifest.revokedShareCount})`,
    'Rodinná historie a pečovatelské záznamy nejsou součástí.',
  ];
}

/** Pure preview from already loaded rows (tests and callers that own the lists). */
export function previewChildPrivateExport(input: {
  readonly ownerAppUserId: ActorId;
  readonly childPrivateModeActive: boolean;
  readonly projects: readonly Project[];
  readonly portfolio: readonly PortfolioItem[];
  readonly shares: readonly ShareSnapshot[];
  readonly filters?: ChildPrivateExportFilters | undefined;
  readonly createdAtMs?: number | undefined;
  /** When true, also materialize the logical archive JSON for this owner. */
  readonly buildArchive?: boolean | undefined;
}): ChildPrivateExportPreview {
  const plan = planChildPrivateExport(input);
  if (!plan.ok) return UNAVAILABLE;
  const base: ChildPrivateExportPreview = {
    available: true,
    manifest: plan.manifest,
    summaryLines: describeManifest(plan.manifest),
    fileGenerated: false,
    archive: null,
    archiveJson: null,
  };
  if (input.buildArchive !== true) return base;

  const built = createChildPrivateArchive({
    ownerAppUserId: input.ownerAppUserId,
    childPrivateModeActive: true,
    createdAtMs: input.createdAtMs ?? Date.now(),
    projects: input.projects,
    portfolio: input.portfolio,
    shares: input.shares,
    filters: input.filters,
  });
  if (!built.ok) return UNAVAILABLE;
  return {
    ...base,
    fileGenerated: true,
    archive: built.archive,
    archiveJson: serializeChildPrivateArchive(built.archive),
    summaryLines: [
      ...describeManifest(plan.manifest),
      'Logický archiv vlastního prostoru je připravený (bez rodinné historie a bez credentials).',
    ],
  };
}

/**
 * Owner-scoped export straight from the local repositories. Lists are read
 * whole and passed through the domain owner filter, so a foreign row in the
 * same database can never reach the archive.
 */
export async function exportChildPrivateWorkspace(input: {
  readonly unitOfWork: UnitOfWorkFactory;
  readonly ownerAppUserId: ActorId;
  readonly childPrivateModeActive: boolean;
  readonly filters?: ChildPrivateExportFilters | undefined;
  readonly createdAtMs?: number | undefined;
  readonly buildArchive?: boolean | undefined;
}): Promise<ChildPrivateExportPreview> {
  if (!input.childPrivateModeActive) return UNAVAILABLE;
  const { projects, portfolio, shares } = await input.unitOfWork.run(async (uow) => ({
    projects: await uow.projects.listAll(),
    portfolio: await uow.portfolio.listAll(),
    shares: await uow.shares.listAll(),
  }));
  return previewChildPrivateExport({
    ownerAppUserId: input.ownerAppUserId,
    childPrivateModeActive: true,
    projects,
    portfolio,
    shares,
    filters: input.filters,
    createdAtMs: input.createdAtMs,
    buildArchive: input.buildArchive ?? true,
  });
}

/** Parse a pasted/decrypted logical archive and describe a soft restore. */
export function stageChildPrivateArchiveRestore(input: {
  readonly liveOwnerAppUserId: ActorId;
  readonly childPrivateModeActive: boolean;
  readonly supportedRecovery: boolean;
  readonly liveProjects: readonly Project[];
  readonly livePortfolio: readonly PortfolioItem[];
  readonly liveShares: readonly ShareSnapshot[];
  readonly rawArchive: unknown;
}): {
  readonly archive: ChildPrivateArchive;
  readonly preview: ChildPrivateArchiveRestorePreview;
  readonly apply: ChildPrivateArchiveApplyResult;
} {
  const archive = parseChildPrivateArchive(input.rawArchive);
  const preview = previewChildPrivateArchiveRestore({
    liveOwnerAppUserId: input.liveOwnerAppUserId,
    childPrivateModeActive: input.childPrivateModeActive,
    supportedRecovery: input.supportedRecovery,
    liveProjects: input.liveProjects,
    livePortfolio: input.livePortfolio,
    liveShares: input.liveShares,
    archive,
  });
  const apply = applyChildPrivateArchiveToStaging({
    liveOwnerAppUserId: input.liveOwnerAppUserId,
    childPrivateModeActive: input.childPrivateModeActive,
    supportedRecovery: input.supportedRecovery,
    liveProjects: input.liveProjects,
    livePortfolio: input.livePortfolio,
    liveShares: input.liveShares,
    archive,
  });
  return { archive, preview, apply };
}
