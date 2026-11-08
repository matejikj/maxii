import { createHash, randomUUID } from 'node:crypto';
import type { RemoteBackupManifest } from '@lumi/contracts';
import { REMOTE_BACKUP_MANIFEST_VERSION } from '@lumi/contracts';

export type LogicalBackupPayload = {
  readonly exportedAt: string;
  readonly appTables: Readonly<Record<string, unknown>>;
  readonly identityTables: Readonly<Record<string, unknown>>;
  readonly attachmentRefs: readonly string[];
};

/**
 * Build a consistent logical export. Callers must dump via SQL tools / logical
 * snapshots — never by copying live PGDATA directories while Postgres is open.
 */
export function buildLogicalBackupPayload(input: {
  readonly appTables: Readonly<Record<string, unknown>>;
  readonly identityTables: Readonly<Record<string, unknown>>;
  readonly attachmentRefs?: readonly string[];
  readonly exportedAt: string;
}): LogicalBackupPayload {
  return {
    exportedAt: input.exportedAt,
    appTables: input.appTables,
    identityTables: input.identityTables,
    attachmentRefs: input.attachmentRefs ?? [],
  };
}

export function digestLogicalPayload(payload: LogicalBackupPayload): string {
  const canonical = JSON.stringify(payload);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export type BackupRepositoryPort = {
  readonly putEncryptedCopy: (input: {
    readonly backupId: string;
    readonly ciphertext: Uint8Array;
    readonly manifest: RemoteBackupManifest;
  }) => Promise<{ readonly stored: true; readonly verifiedAt: string }>;
  readonly listCompleted: () => Promise<
    readonly { readonly backupId: string; readonly completedAt: string; readonly familyId: string | null }[]
  >;
  readonly deleteBackup: (backupId: string) => Promise<void>;
  /** Cross-tenant downloads are refused even when the caller knows a backup id. */
  readonly readFamilyArchive: (input: {
    readonly backupId: string;
    readonly requestingFamilyId: string;
  }) => Promise<Uint8Array | null | { readonly denied: 'wrong_family' }>;
};

export function createMemoryBackupRepository(): BackupRepositoryPort & {
  readonly copies: Map<string, { manifest: RemoteBackupManifest; ciphertext: Uint8Array }>;
} {
  const copies = new Map<string, { manifest: RemoteBackupManifest; ciphertext: Uint8Array }>();
  return {
    copies,
    async putEncryptedCopy(input) {
      if (!input.manifest.completedAt) {
        throw new Error('manifest_incomplete');
      }
      copies.set(input.backupId, {
        manifest: input.manifest,
        ciphertext: input.ciphertext,
      });
      return { stored: true, verifiedAt: input.manifest.completedAt };
    },
    async listCompleted() {
      return [...copies.values()]
        .filter((row) => row.manifest.completedAt)
        .map((row) => ({
          backupId: row.manifest.backupId,
          completedAt: row.manifest.completedAt!,
          familyId: row.manifest.familyId,
        }));
    },
    async deleteBackup(backupId) {
      copies.delete(backupId);
    },
    async readFamilyArchive(input) {
      const row = copies.get(input.backupId);
      if (!row) return null;
      if (row.manifest.familyId && row.manifest.familyId !== input.requestingFamilyId) {
        return { denied: 'wrong_family' };
      }
      return row.ciphertext;
    },
  };
}

export function sealLogicalBackup(input: {
  readonly payload: LogicalBackupPayload;
  readonly scope: RemoteBackupManifest['scope'];
  readonly familyId: string | null;
  readonly provider: RemoteBackupManifest['provider'];
  readonly archiveKey: RemoteBackupManifest['archiveKey'];
  readonly objectStoreEncryption?: RemoteBackupManifest['objectStoreEncryption'];
  readonly contentVersions?: RemoteBackupManifest['contentVersions'];
  readonly now: string;
}): { readonly manifest: RemoteBackupManifest; readonly ciphertext: Uint8Array } {
  const digestSha256 = digestLogicalPayload(input.payload);
  const backupId = randomUUID();
  const manifest: RemoteBackupManifest = {
    schemaVersion: REMOTE_BACKUP_MANIFEST_VERSION,
    backupId,
    createdAt: input.now,
    completedAt: input.now,
    scope: input.scope,
    familyId: input.familyId,
    topology: {
      appDb: true,
      identityDb: true,
      attachmentsIncluded: input.payload.attachmentRefs.length > 0,
      livePgDataCopied: false,
    },
    digestSha256,
    provider: input.provider,
    archiveKey: input.archiveKey,
    objectStoreEncryption: input.objectStoreEncryption ?? {
      kind: 'none',
      keyArnOrId: null,
      replacesArchiveKey: false,
    },
    contentVersions: input.contentVersions ?? {},
  };
  // Placeholder ciphertext: production path encrypts via restic before upload.
  const ciphertext = new TextEncoder().encode(
    JSON.stringify({ digestSha256, payload: input.payload }),
  );
  return { manifest, ciphertext };
}
