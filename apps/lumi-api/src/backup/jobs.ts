import type { RemoteBackupManifest } from '@lumi/contracts';
import { pruneBackupIdsOlderThan } from '@lumi/contracts';
import type { BackupRepositoryPort, LogicalBackupPayload } from './logicalExport.ts';
import { buildLogicalBackupPayload, sealLogicalBackup } from './logicalExport.ts';
import type { ErasureRegistryPort } from './erasureRegistry.ts';

export type BackupJobResult =
  | {
      readonly ok: true;
      readonly kind: 'backup.daily';
      readonly backupId: string;
      readonly completedAt: string;
    }
  | {
      readonly ok: true;
      readonly kind: 'backup.retention.prune';
      readonly deletedBackupIds: readonly string[];
    }
  | {
      readonly ok: false;
      readonly kind: string;
      readonly reason: string;
      readonly liveDataMutated: false;
    };

export async function runDailyBackupJob(input: {
  readonly repository: BackupRepositoryPort;
  readonly appTables: Readonly<Record<string, unknown>>;
  readonly identityTables: Readonly<Record<string, unknown>>;
  readonly now: string;
  readonly provider: RemoteBackupManifest['provider'];
  readonly archiveKey: RemoteBackupManifest['archiveKey'];
}): Promise<BackupJobResult> {
  try {
    const payload: LogicalBackupPayload = buildLogicalBackupPayload({
      appTables: input.appTables,
      identityTables: input.identityTables,
      exportedAt: input.now,
    });
    const sealed = sealLogicalBackup({
      payload,
      scope: 'ops_host',
      familyId: null,
      provider: input.provider,
      archiveKey: input.archiveKey,
      now: input.now,
    });
    const stored = await input.repository.putEncryptedCopy({
      backupId: sealed.manifest.backupId,
      ciphertext: sealed.ciphertext,
      manifest: sealed.manifest,
    });
    return {
      ok: true,
      kind: 'backup.daily',
      backupId: sealed.manifest.backupId,
      completedAt: stored.verifiedAt,
    };
  } catch (error) {
    return {
      ok: false,
      kind: 'backup.daily',
      reason: error instanceof Error ? error.message : 'backup_failed',
      liveDataMutated: false,
    };
  }
}

export async function runRetentionPruneJob(input: {
  readonly repository: BackupRepositoryPort;
  readonly nowMs: number;
}): Promise<BackupJobResult> {
  try {
    const listed = await input.repository.listCompleted();
    const toDelete = pruneBackupIdsOlderThan({
      backupIdsByCompletedAt: listed,
      nowMs: input.nowMs,
    });
    for (const backupId of toDelete) {
      await input.repository.deleteBackup(backupId);
    }
    return {
      ok: true,
      kind: 'backup.retention.prune',
      deletedBackupIds: toDelete,
    };
  } catch (error) {
    return {
      ok: false,
      kind: 'backup.retention.prune',
      reason: error instanceof Error ? error.message : 'prune_failed',
      liveDataMutated: false,
    };
  }
}

/** Ensure the off-host registry mirror is readable before confirming ops health. */
export async function assertErasureRegistryDurable(
  registry: ErasureRegistryPort,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await registry.load();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'registry_unreadable',
    };
  }
}
