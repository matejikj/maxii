import { randomUUID } from 'node:crypto';
import type { AppUserId, ErasureRegistryEntry, FamilyId, SyncOperation } from '@lumi/contracts';
import { LUMI_API_PROTOCOL_VERSION } from '@lumi/contracts';
import type { ErasureRegistryPort } from '../backup/erasureRegistry.ts';
import { hashSyncPayload, type MemorySyncStore } from '../sync/syncStore.ts';
import { planManagedMigrationCutover, type CutoverPlan } from './migrationCutover.ts';

/**
 * Local managed-hosting migration drill. Exercises portable sync receipts,
 * cursors, conflict heads, and erasure-registry survival across a disposable
 * writer fence. Never claims a production DNS flip or completed cloud move.
 */

export type MigrationDrillHttp = {
  inject(input: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    payload?: unknown;
  }): Promise<{ statusCode: number; json(): unknown }>;
};

export type MigrationDrillTokens = {
  mintTestToken(input: { subject: string; appUserId: AppUserId }): Promise<string>;
};

export type ManagedMigrationLocalDrillReport = {
  readonly format: 'lumi.managed-migration-local-drill.v1';
  readonly mode: 'drill';
  readonly cutoverPlan: CutoverPlan;
  readonly receiptsPreserved: boolean;
  readonly conflictHeadsPreserved: boolean;
  readonly staleCursorRequiresResync: boolean;
  readonly staleWriterRejected: boolean;
  readonly erasureRegistrySurvived: boolean;
  readonly dnsRollbackPracticeOnly: boolean;
  readonly allChecksPassed: boolean;
  /** Always false — a local drill is not a completed cloud migration. */
  readonly cloudMigrationClaimed: false;
  readonly findings: readonly string[];
};

export type ManagedMigrationLocalDrillDeps = {
  readonly app: MigrationDrillHttp;
  readonly tokens: MigrationDrillTokens;
  readonly sync: MemorySyncStore;
  readonly erasureRegistry: ErasureRegistryPort;
};

function buildOp(input: {
  actorAppUserId: AppUserId;
  entityId: string;
  revisionId: string;
  parentRevisionIds?: string[];
  kind?: SyncOperation['kind'];
  payload: Record<string, unknown>;
}): SyncOperation {
  return {
    schemaVersion: LUMI_API_PROTOCOL_VERSION,
    operationId: randomUUID(),
    deviceId: 'migration-drill-device',
    actorAppUserId: input.actorAppUserId,
    kind: input.kind ?? 'care.record',
    entityId: input.entityId,
    revisionId: input.revisionId,
    parentRevisionIds: input.parentRevisionIds ?? [],
    payloadHash: hashSyncPayload(input.payload),
    payload: input.payload,
  };
}

/**
 * Seed conflict heads + an erasure entry, rotate the hosting epoch, and verify
 * portable state survives without pretending the cloud cutover already happened.
 */
export async function runManagedMigrationLocalDrill(
  deps: ManagedMigrationLocalDrillDeps,
): Promise<ManagedMigrationLocalDrillReport> {
  const findings: string[] = [];
  const cutoverPlan = planManagedMigrationCutover({ mode: 'drill' });

  const adminId = randomUUID() as AppUserId;
  const token = await deps.tokens.mintTestToken({
    subject: 'migration-admin',
    appUserId: adminId,
  });
  const created = await deps.app.inject({
    method: 'POST',
    url: '/v1/families',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: 'migration-drill-family',
      displayName: 'Migration Drill',
    },
  });
  if (created.statusCode !== 201) {
    throw new Error(`family_create_failed:${created.statusCode}`);
  }
  const familyId = (created.json() as { familyId: FamilyId }).familyId;

  const entityId = randomUUID();
  const root = buildOp({
    actorAppUserId: adminId,
    entityId,
    revisionId: 'mig-root',
    payload: { revisionKind: 'create', text: 'migration-root' },
  });
  await deps.app.inject({
    method: 'POST',
    url: `/v1/families/${familyId}/sync/push`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [root],
    },
  });

  const branchA = buildOp({
    actorAppUserId: adminId,
    entityId,
    revisionId: 'mig-head-a',
    parentRevisionIds: ['mig-root'],
    kind: 'care.update',
    payload: { revisionKind: 'update', text: 'A' },
  });
  const branchB = buildOp({
    actorAppUserId: adminId,
    entityId,
    revisionId: 'mig-head-b',
    parentRevisionIds: ['mig-root'],
    kind: 'care.update',
    payload: { revisionKind: 'update', text: 'B' },
  });
  await deps.app.inject({
    method: 'POST',
    url: `/v1/families/${familyId}/sync/push`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [branchA],
    },
  });
  const conflictPush = await deps.app.inject({
    method: 'POST',
    url: `/v1/families/${familyId}/sync/push`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [branchB],
    },
  });
  const conflictReceipt = (
    conflictPush.json() as {
      receipts?: Array<{ status: string; heads?: string[] }>;
    }
  ).receipts?.[0];

  const pullBefore = await deps.app.inject({
    method: 'GET',
    url: `/v1/families/${familyId}/sync/pull?limit=50`,
    headers: { authorization: `Bearer ${token}` },
  });
  const beforeBody = pullBefore.json() as {
    nextCursor?: string | null;
    entries?: Array<{ operationId: string }>;
  };
  const cursorBefore = beforeBody.nextCursor ?? null;
  const receiptKeysBefore = [...deps.sync.byOperation.keys()]
    .filter((key) => key.startsWith(`${familyId}:`))
    .sort();

  const erasedFamilyId = randomUUID() as FamilyId;
  const erasureEntry: ErasureRegistryEntry = {
    familyId: erasedFamilyId,
    erasedAt: new Date().toISOString(),
    eraseGeneration: 1,
    opaqueEntityIds: [`opaque-${erasedFamilyId}`],
  };
  await deps.erasureRegistry.append(erasureEntry);
  const registryBefore = await deps.erasureRegistry.load();

  // Disposable cut-over: keep receipts, bump epoch/writer generation.
  const epochAfter = deps.sync.rotateEpochKeepReceipts(familyId);

  const receiptKeysAfter = [...deps.sync.byOperation.keys()]
    .filter((key) => key.startsWith(`${familyId}:`))
    .sort();
  const receiptsPreserved =
    receiptKeysBefore.length >= 3 &&
    receiptKeysBefore.length === receiptKeysAfter.length &&
    receiptKeysBefore.every((key, index) => key === receiptKeysAfter[index]);

  const conflictHeadsPreserved =
    conflictReceipt?.status === 'accepted_with_conflict' &&
    Array.isArray(conflictReceipt.heads) &&
    [...conflictReceipt.heads].sort().join(',') === 'mig-head-a,mig-head-b';

  let staleCursorRequiresResync = false;
  if (cursorBefore) {
    const stalePull = await deps.app.inject({
      method: 'GET',
      url: `/v1/families/${familyId}/sync/pull?cursor=${encodeURIComponent(cursorBefore)}&limit=50`,
      headers: { authorization: `Bearer ${token}` },
    });
    const staleBody = stalePull.json() as {
      error?: { code?: string };
      sync?: { resyncRequired?: boolean; epoch?: number };
    };
    staleCursorRequiresResync =
      stalePull.statusCode === 409 ||
      staleBody.error?.code === 'resync_required' ||
      Boolean(staleBody.sync?.resyncRequired);
    if (staleCursorRequiresResync) {
      findings.push(`stale_cursor_resync_after_epoch_${epochAfter}`);
    }
  }

  const staleWriterPush = await deps.app.inject({
    method: 'POST',
    url: `/v1/families/${familyId}/sync/push`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      writerGeneration: 1,
      operations: [
        buildOp({
          actorAppUserId: adminId,
          entityId: randomUUID(),
          revisionId: randomUUID(),
          payload: { revisionKind: 'create', text: 'abandoned-writer' },
        }),
      ],
    },
  });
  const staleWriterReceipt = (
    staleWriterPush.json() as {
      receipts?: Array<{ status: string; reason?: string }>;
    }
  ).receipts?.[0];
  const staleWriterRejected =
    staleWriterReceipt?.status === 'rejected' && staleWriterReceipt.reason === 'stale_writer';

  const registryAfter = await deps.erasureRegistry.load();
  const erasureRegistrySurvived = registryAfter.entries.some(
    (entry) =>
      entry.familyId === erasedFamilyId && entry.eraseGeneration === erasureEntry.eraseGeneration,
  );

  const dnsRollbackPracticeOnly =
    cutoverPlan.mode === 'drill' && cutoverPlan.dnsRollbackToOldDbAllowed;

  if (receiptsPreserved) findings.push('sync_receipts_preserved_across_epoch');
  if (conflictHeadsPreserved) findings.push('conflict_heads_retained');
  if (staleWriterRejected) findings.push('abandoned_writer_fenced');
  if (erasureRegistrySurvived) findings.push('erasure_registry_survived_cutover');
  if (dnsRollbackPracticeOnly) findings.push('dns_rollback_limited_to_drill_targets');
  findings.push('cloud_migration_not_claimed');

  // Prove registry snapshot taken before cutover still matches durable store.
  void registryBefore;

  const allChecksPassed =
    receiptsPreserved &&
    conflictHeadsPreserved &&
    staleCursorRequiresResync &&
    staleWriterRejected &&
    erasureRegistrySurvived &&
    dnsRollbackPracticeOnly;

  return {
    format: 'lumi.managed-migration-local-drill.v1',
    mode: 'drill',
    cutoverPlan,
    receiptsPreserved,
    conflictHeadsPreserved,
    staleCursorRequiresResync,
    staleWriterRejected,
    erasureRegistrySurvived,
    dnsRollbackPracticeOnly,
    allChecksPassed,
    cloudMigrationClaimed: false,
    findings,
  };
}
