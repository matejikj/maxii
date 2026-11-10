import {
  createChildPrivateArchive,
  parseChildPrivateArchive,
  previewChildPrivateArchiveRestore,
  applyChildPrivateArchiveToStaging,
  serializeChildPrivateArchive,
  type ActorId,
  type ChildPrivateArchive,
  type ChildPrivateArchiveApplyResult,
  type ChildPrivateArchiveRestorePreview,
  type ChildPrivateExportFilters,
  type PortfolioItem,
  type Project,
  type ShareSnapshot,
  type UnitOfWorkFactory,
} from '../domain';
import { AppError } from '../domain/errors';
import {
  DEFAULT_ARGON2ID_PARAMS,
  type Argon2idParams,
  type PortableBackupEnvelope,
  openPortableBackup,
  parsePortableBackup,
  sealPortableBackup,
  serializePortableBackup,
} from '../infrastructure/crypto/portableBackup';
import { assertPortableBackupReadable } from '../infrastructure/files/portableBackupLimits';

/** Distinct basename so a caregiver diary file is not mistaken for this archive. */
export function childPrivatePortableFileName(nowMs: number): string {
  const stamp = new Date(nowMs).toISOString().replace(/[:.]/g, '-');
  return `lumi-child-private-archive-${stamp}.json`;
}

export type SealedChildPrivateExport = {
  readonly ok: true;
  readonly archive: ChildPrivateArchive;
  readonly envelope: PortableBackupEnvelope;
  readonly serialized: string;
  readonly fileName: string;
  readonly exportedAtMs: number;
  /** Password-sealed portable file — not a live cloud backup claim. */
  readonly sealed: true;
  readonly credentialsIncluded: false;
  readonly familyHistoryIncluded: false;
};

export type SealedChildPrivateExportFailure = {
  readonly ok: false;
  readonly reason: 'child_mode_inactive' | 'empty_password';
};

export type OpenedChildPrivatePortable = {
  readonly archive: ChildPrivateArchive;
  readonly preview: ChildPrivateArchiveRestorePreview;
  readonly apply: ChildPrivateArchiveApplyResult;
};

function sealArchiveJson(
  archive: ChildPrivateArchive,
  password: string,
  argonParams: Argon2idParams,
  nowMs: number,
): SealedChildPrivateExport {
  const plaintext = new TextEncoder().encode(serializeChildPrivateArchive(archive));
  const envelope = sealPortableBackup(plaintext, password, argonParams);
  return {
    ok: true,
    archive,
    envelope,
    serialized: serializePortableBackup(envelope),
    fileName: childPrivatePortableFileName(nowMs),
    exportedAtMs: nowMs,
    sealed: true,
    credentialsIncluded: false,
    familyHistoryIncluded: false,
  };
}

/**
 * Builds the owner-scoped logical archive and seals it with the same Argon2id /
 * XChaCha portable envelope used for caregiver diaries. The password never
 * enters the file; inactive mode yields no envelope.
 */
export function sealChildPrivatePortableArchive(input: {
  readonly ownerAppUserId: ActorId;
  readonly childPrivateModeActive: boolean;
  readonly password: string;
  readonly createdAtMs: number;
  readonly projects: readonly Project[];
  readonly portfolio: readonly PortfolioItem[];
  readonly shares: readonly ShareSnapshot[];
  readonly filters?: ChildPrivateExportFilters | undefined;
  readonly argonParams?: Argon2idParams | undefined;
}): SealedChildPrivateExport | SealedChildPrivateExportFailure {
  if (!input.childPrivateModeActive) {
    return { ok: false, reason: 'child_mode_inactive' };
  }
  if (input.password.length === 0) {
    return { ok: false, reason: 'empty_password' };
  }
  const built = createChildPrivateArchive({
    ownerAppUserId: input.ownerAppUserId,
    childPrivateModeActive: true,
    createdAtMs: input.createdAtMs,
    projects: input.projects,
    portfolio: input.portfolio,
    shares: input.shares,
    filters: input.filters,
  });
  if (!built.ok) {
    return { ok: false, reason: 'child_mode_inactive' };
  }
  return sealArchiveJson(
    built.archive,
    input.password,
    input.argonParams ?? DEFAULT_ARGON2ID_PARAMS,
    input.createdAtMs,
  );
}

/** Same seal path, reading live repositories for the owner. */
export async function exportSealedChildPrivateWorkspace(input: {
  readonly unitOfWork: UnitOfWorkFactory;
  readonly ownerAppUserId: ActorId;
  readonly childPrivateModeActive: boolean;
  readonly password: string;
  readonly createdAtMs: number;
  readonly filters?: ChildPrivateExportFilters | undefined;
  readonly argonParams?: Argon2idParams | undefined;
}): Promise<SealedChildPrivateExport | SealedChildPrivateExportFailure> {
  if (!input.childPrivateModeActive) {
    return { ok: false, reason: 'child_mode_inactive' };
  }
  const { projects, portfolio, shares } = await input.unitOfWork.run(async (uow) => ({
    projects: await uow.projects.listAll(),
    portfolio: await uow.portfolio.listAll(),
    shares: await uow.shares.listAll(),
  }));
  return sealChildPrivatePortableArchive({
    ownerAppUserId: input.ownerAppUserId,
    childPrivateModeActive: true,
    password: input.password,
    createdAtMs: input.createdAtMs,
    projects,
    portfolio,
    shares,
    filters: input.filters,
    argonParams: input.argonParams,
  });
}

/**
 * Decrypts a portable envelope into staging memory and describes a soft restore.
 * Live rows stay untouched until a later explicit apply path writes staging.
 */
export function openSealedChildPrivatePortable(input: {
  readonly serializedEnvelope: string;
  readonly password: string;
  readonly liveOwnerAppUserId: ActorId;
  readonly childPrivateModeActive: boolean;
  readonly supportedRecovery: boolean;
  readonly liveProjects: readonly Project[];
  readonly livePortfolio: readonly PortfolioItem[];
  readonly liveShares: readonly ShareSnapshot[];
}): OpenedChildPrivatePortable {
  assertPortableBackupReadable(input.serializedEnvelope);

  let envelope: PortableBackupEnvelope;
  try {
    envelope = parsePortableBackup(input.serializedEnvelope);
  } catch (error) {
    throw new AppError('VALIDATION', 'Child private portable file is incomplete or invalid', {
      details: { reason: 'envelope_parse' },
      cause: error,
    });
  }

  let plaintext: Uint8Array;
  try {
    plaintext = openPortableBackup(envelope, input.password);
  } catch (error) {
    throw new AppError('CRYPTO', 'Wrong recovery password or tampered child private file', {
      details: { reason: 'envelope_auth' },
      cause: error,
    });
  }

  const decoded = new TextDecoder().decode(plaintext);
  // parseChildPrivateArchive rejects diary-shaped plaintext even if sealed.
  const archive = parseChildPrivateArchive(decoded);
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
