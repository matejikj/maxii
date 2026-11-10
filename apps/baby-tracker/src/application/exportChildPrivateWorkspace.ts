import {
  planChildPrivateExport,
  type ActorId,
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
  /** The preview counts rows; it does not produce a file. */
  readonly fileGenerated: false;
};

const UNAVAILABLE: ChildPrivateExportPreview = {
  available: false,
  manifest: null,
  summaryLines: [],
  fileGenerated: false,
};

function describeManifest(manifest: ChildPrivateExportManifest): string[] {
  if (
    manifest.projectCount === 0 &&
    manifest.portfolioCount === 0 &&
    manifest.shareCount === 0
  ) {
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
}): ChildPrivateExportPreview {
  const plan = planChildPrivateExport(input);
  if (!plan.ok) return UNAVAILABLE;
  return {
    available: true,
    manifest: plan.manifest,
    summaryLines: describeManifest(plan.manifest),
    fileGenerated: false,
  };
}

/**
 * Owner-scoped export preview straight from the local repositories. Lists are
 * read whole and passed through the domain owner filter, so a foreign row in
 * the same database can never reach the manifest.
 */
export async function exportChildPrivateWorkspace(input: {
  readonly unitOfWork: UnitOfWorkFactory;
  readonly ownerAppUserId: ActorId;
  readonly childPrivateModeActive: boolean;
  readonly filters?: ChildPrivateExportFilters | undefined;
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
  });
}
