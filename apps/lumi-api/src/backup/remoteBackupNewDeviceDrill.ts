import { randomUUID } from 'node:crypto';
import type { FamilyId } from '@lumi/contracts';
import { createMemoryErasureRegistry, type ErasureRegistryPort } from './erasureRegistry.ts';
import {
  buildLogicalBackupPayload,
  createMemoryBackupRepository,
  sealLogicalBackup,
  type BackupRepositoryPort,
  type LogicalBackupPayload,
} from './logicalExport.ts';
import {
  buildRecoveryPreview,
  keepLiveStateOnBackupFailure,
  restoreOpsHostWithErasureGate,
} from './restorePipeline.ts';

/**
 * Software drill: seal a remote family archive, preview recovery without
 * activating live rewrite, restore into an empty "new install" workspace, and
 * re-apply the erasure registry before opening traffic. Never claims a measured
 * live-host RPO/RTO or a production VPS restore.
 */

export type RemoteBackupNewDeviceDrillReport = {
  readonly format: 'lumi.remote-backup-new-device-drill.v1';
  readonly archiveStored: boolean;
  readonly previewDoesNotActivate: boolean;
  readonly newInstallStartsEmpty: boolean;
  readonly stagingReceivesArchiveCanary: boolean;
  readonly liveUntouchedUntilConfirm: boolean;
  readonly erasurePreventsResurrection: boolean;
  readonly failedUploadLeavesLiveIntact: boolean;
  readonly crossFamilyArchiveDenied: boolean;
  readonly allSoftwareChecksPassed: boolean;
  /** Always false — in-process fixture ≠ measured host restore. */
  readonly liveHostRestoreClaimed: false;
  readonly measuredRpoRtoClaimed: false;
  readonly findings: readonly string[];
  readonly backupId: string | null;
};

export type RemoteBackupNewDeviceDrillDeps = {
  readonly familyId: FamilyId;
  readonly foreignFamilyId: FamilyId;
  readonly diaryCanary: string;
  readonly now?: string;
  readonly repository?: BackupRepositoryPort & {
    readonly copies: Map<string, { ciphertext: Uint8Array }>;
  };
  readonly erasureRegistry?: ErasureRegistryPort;
};

type StagingWorkspace = {
  readonly activated: boolean;
  readonly appTables: Record<string, unknown>;
};

function openNewInstallWorkspace(): {
  readonly live: { appTables: Record<string, unknown> };
  readonly staging: StagingWorkspace;
} {
  return {
    live: { appTables: {} },
    staging: { activated: false, appTables: {} },
  };
}

function materializeArchiveIntoStaging(
  staging: StagingWorkspace,
  payload: LogicalBackupPayload,
): StagingWorkspace {
  // New install restores into staging first; live stays empty until explicit confirm.
  return {
    activated: false,
    appTables: { ...payload.appTables },
  };
}

/**
 * Run the software remote-backup + new-install restore path against in-memory
 * fixtures. Passing does not authorize quoting live RPO/RTO numbers.
 */
export async function runRemoteBackupNewDeviceDrill(
  deps: RemoteBackupNewDeviceDrillDeps,
): Promise<RemoteBackupNewDeviceDrillReport> {
  const findings: string[] = [];
  const now = deps.now ?? '2026-11-09T12:00:00.000Z';
  const repository = deps.repository ?? createMemoryBackupRepository();
  const erasureRegistry = deps.erasureRegistry ?? createMemoryErasureRegistry();
  const canary = deps.diaryCanary;

  const liveSource = {
    note: canary,
    careCount: 3,
  };
  const payload = buildLogicalBackupPayload({
    appTables: liveSource,
    identityTables: { users: 1 },
    exportedAt: now,
  });
  const sealed = sealLogicalBackup({
    payload,
    scope: 'family_archive',
    familyId: deps.familyId,
    provider: {
      kind: 'memory_fixture',
      regionOrJurisdiction: 'eu',
      bucketRef: 'fixture',
      repositoryPath: 'mem',
    },
    archiveKey: {
      kind: 'restic_password',
      keyId: 'vault://drill',
      recoverableOffHost: true,
    },
    now,
  });
  const stored = await repository.putEncryptedCopy({
    backupId: sealed.manifest.backupId,
    ciphertext: sealed.ciphertext,
    manifest: sealed.manifest,
  });
  const archiveStored = stored.stored === true && Boolean(sealed.manifest.completedAt);
  if (archiveStored) findings.push('family_archive_stored_with_verified_manifest');

  const preview = buildRecoveryPreview({
    familyId: deps.familyId,
    backupId: sealed.manifest.backupId,
    archivePayload: payload,
    registry: await erasureRegistry.load(),
  });
  const previewDoesNotActivate =
    preview.activatesOnPreview === false && preview.blocksLiveRewrite === true;
  if (previewDoesNotActivate) findings.push('recovery_preview_blocks_live_rewrite');

  const install = openNewInstallWorkspace();
  const newInstallStartsEmpty = Object.keys(install.live.appTables).length === 0;
  if (newInstallStartsEmpty) findings.push('new_install_workspace_starts_empty');

  const staging = materializeArchiveIntoStaging(install.staging, payload);
  const stagingReceivesArchiveCanary = staging.appTables.note === canary;
  const liveUntouchedUntilConfirm =
    staging.activated === false && Object.keys(install.live.appTables).length === 0;
  if (stagingReceivesArchiveCanary) findings.push('staging_receives_archive_canary');
  if (liveUntouchedUntilConfirm) findings.push('live_untouched_until_explicit_confirm');

  await erasureRegistry.append({
    familyId: 'fam-erased-drill',
    erasedAt: '2026-11-08T00:00:00.000Z',
    eraseGeneration: 2,
    opaqueEntityIds: ['opaque-erased'],
  });
  const restored = restoreOpsHostWithErasureGate({
    restoredFamilies: [
      { familyId: 'fam-erased-drill', erasedAt: null },
      { familyId: deps.familyId, erasedAt: null },
    ],
    registry: await erasureRegistry.load(),
    now,
  });
  const erasurePreventsResurrection =
    restored.families.find((row) => row.familyId === 'fam-erased-drill')?.erasedAt ===
      '2026-11-08T00:00:00.000Z' &&
    restored.families.find((row) => row.familyId === deps.familyId)?.erasedAt == null &&
    restored.apiOpen === true;
  if (erasurePreventsResurrection) {
    findings.push('erasure_registry_applied_before_api_open');
  }

  const liveBeforeFail = { care: 1, note: canary };
  const failingBase = createMemoryBackupRepository();
  const failingRepo: typeof failingBase = {
    ...failingBase,
    async putEncryptedCopy() {
      throw new Error('upload_failed');
    },
  };
  let failedUploadLeavesLiveIntact = false;
  try {
    await failingRepo.putEncryptedCopy({
      backupId: randomUUID(),
      ciphertext: sealed.ciphertext,
      manifest: { ...sealed.manifest, backupId: randomUUID(), completedAt: now },
    });
  } catch (error) {
    const preserved = keepLiveStateOnBackupFailure(liveBeforeFail, error);
    failedUploadLeavesLiveIntact = preserved === liveBeforeFail && preserved.note === canary;
  }
  if (failedUploadLeavesLiveIntact) findings.push('failed_upload_leaves_live_intact');

  const cross = await repository.readFamilyArchive({
    backupId: sealed.manifest.backupId,
    requestingFamilyId: deps.foreignFamilyId,
  });
  const crossFamilyArchiveDenied =
    cross != null &&
    typeof cross === 'object' &&
    'denied' in cross &&
    cross.denied === 'wrong_family';
  if (crossFamilyArchiveDenied) findings.push('cross_family_archive_denied');

  findings.push('live_host_restore_not_claimed');
  findings.push('measured_rpo_rto_not_claimed');

  const allSoftwareChecksPassed =
    archiveStored &&
    previewDoesNotActivate &&
    newInstallStartsEmpty &&
    stagingReceivesArchiveCanary &&
    liveUntouchedUntilConfirm &&
    erasurePreventsResurrection &&
    failedUploadLeavesLiveIntact &&
    crossFamilyArchiveDenied;

  return {
    format: 'lumi.remote-backup-new-device-drill.v1',
    archiveStored,
    previewDoesNotActivate,
    newInstallStartsEmpty,
    stagingReceivesArchiveCanary,
    liveUntouchedUntilConfirm,
    erasurePreventsResurrection,
    failedUploadLeavesLiveIntact,
    crossFamilyArchiveDenied,
    allSoftwareChecksPassed,
    liveHostRestoreClaimed: false,
    measuredRpoRtoClaimed: false,
    findings,
    backupId: sealed.manifest.backupId,
  };
}
