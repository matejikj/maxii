/**
 * Remote family/ops backup wire shapes. Archive format stays provider-agnostic:
 * moving API to Render or DB to Supabase must not rewrite the family export schema.
 */

export const REMOTE_BACKUP_MANIFEST_VERSION = 1 as const;
export const ERASURE_REGISTRY_VERSION = 1 as const;
export const BACKUP_RETENTION_DAYS = 30 as const;

export type BackupProviderKind = 'restic_r2' | 'future_s3_kms' | 'memory_fixture';

export type BackupProviderLocator = {
  readonly kind: BackupProviderKind;
  /** R2 uses eu jurisdiction; location hints alone are not enough. */
  readonly regionOrJurisdiction: string;
  /** Opaque bucket reference — never a signed download URL for another tenant. */
  readonly bucketRef: string;
  readonly repositoryPath: string;
};

export type ArchiveKeyRef = {
  readonly kind: 'restic_password' | 'operator_vault';
  readonly keyId: string;
  /** Loss of the VPS must not lose the only decrypt material. */
  readonly recoverableOffHost: true;
};

export type ObjectStoreEncryptionRef = {
  readonly kind: 'sse_kms' | 'none';
  readonly keyArnOrId: string | null;
  /**
   * Bucket SSE-KMS is an extra layer. Destroying the restic password because
   * the bucket has KMS would break recovery of older snapshots.
   */
  readonly replacesArchiveKey: false;
};

export type RemoteBackupTopology = {
  readonly appDb: boolean;
  readonly identityDb: boolean;
  readonly attachmentsIncluded: boolean;
  /** Live PGDATA copies are never a consistent ops snapshot. */
  readonly livePgDataCopied: false;
};

export type RemoteBackupManifest = {
  readonly schemaVersion: typeof REMOTE_BACKUP_MANIFEST_VERSION;
  readonly backupId: string;
  readonly createdAt: string;
  /** Set only after the off-server copy is verified stored. */
  readonly completedAt: string | null;
  readonly scope: 'ops_host' | 'family_archive';
  readonly familyId: string | null;
  readonly topology: RemoteBackupTopology;
  readonly digestSha256: string;
  readonly provider: BackupProviderLocator;
  readonly archiveKey: ArchiveKeyRef;
  readonly objectStoreEncryption: ObjectStoreEncryptionRef;
  readonly contentVersions: {
    readonly apiImage?: string;
    readonly migrationMax?: number;
  };
};

export type ErasureRegistryEntry = {
  readonly familyId: string;
  readonly erasedAt: string;
  readonly eraseGeneration: number;
  /** Opaque ids only — no diary payloads in the durable registry. */
  readonly opaqueEntityIds: readonly string[];
};

export type ErasureRegistryDocument = {
  readonly schemaVersion: typeof ERASURE_REGISTRY_VERSION;
  readonly updatedAt: string;
  readonly entries: readonly ErasureRegistryEntry[];
};

export type RecoveryPreviewResponse = {
  readonly protocolVersion: number;
  readonly familyId: string;
  readonly backupId: string;
  readonly wouldRestoreEntityCount: number;
  readonly wouldReapplyErasureCount: number;
  readonly activatesOnPreview: false;
  readonly blocksLiveRewrite: true;
};

export type RemoteBackupStatusResponse = {
  readonly protocolVersion: number;
  readonly familyId: string;
  readonly lastCompletedAt: string | null;
  readonly lastAttemptAt: string | null;
  readonly lastAttemptStatus: 'idle' | 'running' | 'completed' | 'failed';
  readonly retentionDays: typeof BACKUP_RETENTION_DAYS;
  readonly scope: 'ops_host' | 'family_archive' | 'none';
  /** Local save is not proof other phones already hold the same copy. */
  readonly claimsOtherDevicesSynced: false;
};

export type FamilyErasureReceipt = {
  readonly familyId: string;
  readonly erased: boolean;
  readonly eraseGeneration: number;
  readonly registryPersisted: true;
  readonly physicalCopiesPendingRetention: true;
};

export function isCompleteRemoteBackup(manifest: RemoteBackupManifest): boolean {
  return manifest.completedAt != null && manifest.digestSha256.length >= 32;
}

export function validateRemoteBackupManifest(
  raw: unknown,
):
  | { readonly ok: true; readonly manifest: RemoteBackupManifest }
  | { readonly ok: false; readonly reason: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'not_object' };
  const m = raw as Partial<RemoteBackupManifest>;
  if (m.schemaVersion !== REMOTE_BACKUP_MANIFEST_VERSION) {
    return { ok: false, reason: 'unsupported_schema' };
  }
  if (!m.backupId || !m.createdAt || !m.digestSha256 || !m.provider || !m.archiveKey) {
    return { ok: false, reason: 'missing_fields' };
  }
  if (m.topology?.livePgDataCopied !== false) {
    return { ok: false, reason: 'live_pgdata_forbidden' };
  }
  if (m.archiveKey.recoverableOffHost !== true) {
    return { ok: false, reason: 'archive_key_must_be_off_host' };
  }
  if (m.objectStoreEncryption?.replacesArchiveKey !== false) {
    return { ok: false, reason: 'kms_must_not_replace_archive_key' };
  }
  if (m.scope === 'family_archive' && !m.familyId) {
    return { ok: false, reason: 'family_archive_needs_family_id' };
  }
  return { ok: true, manifest: m as RemoteBackupManifest };
}

export function pruneBackupIdsOlderThan(input: {
  readonly backupIdsByCompletedAt: readonly { readonly backupId: string; readonly completedAt: string }[];
  readonly nowMs: number;
  readonly retentionDays?: number;
}): readonly string[] {
  const days = input.retentionDays ?? BACKUP_RETENTION_DAYS;
  const cutoff = input.nowMs - days * 24 * 60 * 60 * 1000;
  return input.backupIdsByCompletedAt
    .filter((row) => Date.parse(row.completedAt) < cutoff)
    .map((row) => row.backupId);
}
