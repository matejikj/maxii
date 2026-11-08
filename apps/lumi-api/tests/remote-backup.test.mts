import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  LUMI_API_PROTOCOL_VERSION,
  type AppUserId,
  type FamilyId,
} from '@lumi/contracts';
import { loadApiConfig } from '../src/config/env.ts';
import { createFamilyApi } from '../src/http/createServer.ts';
import {
  createMemoryBackupRepository,
  sealLogicalBackup,
  buildLogicalBackupPayload,
} from '../src/backup/logicalExport.ts';
import { createMemoryErasureRegistry } from '../src/backup/erasureRegistry.ts';
import { restoreOpsHostWithErasureGate, keepLiveStateOnBackupFailure } from '../src/backup/restorePipeline.ts';
import { runDailyBackupJob, runRetentionPruneJob } from '../src/backup/jobs.ts';
import { eraseFamilyWithDurableRegistry } from '../src/backup/eraseFamilyService.ts';
import { MemoryFamilyStore } from '../src/identity/store.ts';
import { createMemoryJobQueue } from '../src/ops/jobQueue.ts';

async function boot() {
  const config = loadApiConfig({
    LUMI_TEST_HS256_SECRET: 'unit-test-hs256',
    LUMI_OIDC_ISSUER: 'http://test.invalid/realms/lumi',
  } as NodeJS.ProcessEnv);
  return createFamilyApi(config);
}

async function createFamilyWithAdmin(
  app: Awaited<ReturnType<typeof createFamilyApi>>['app'],
  tokens: Awaited<ReturnType<typeof createFamilyApi>>['tokens'],
) {
  const adminId = randomUUID() as AppUserId;
  const token = await tokens.mintTestToken({
    subject: `admin-${adminId}`,
    appUserId: adminId,
  });
  const created = await app.inject({
    method: 'POST',
    url: '/v1/families',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: `fam-${adminId}`,
      displayName: 'Backup family',
    },
  });
  assert.equal(created.statusCode, 201);
  return {
    token,
    adminId,
    familyId: created.json().familyId as FamilyId,
    membershipId: created.json().membershipId as string,
  };
}

test('daily backup job stores a verified copy without mutating live tables on failure', async () => {
  const repository = createMemoryBackupRepository();
  const live = { care: 1 };
  const ok = await runDailyBackupJob({
    repository,
    appTables: live,
    identityTables: { users: 1 },
    now: '2026-11-09T01:00:00.000Z',
    provider: {
      kind: 'memory_fixture',
      regionOrJurisdiction: 'eu',
      bucketRef: 'fixture',
      repositoryPath: 'mem',
    },
    archiveKey: {
      kind: 'restic_password',
      keyId: 'vault://test',
      recoverableOffHost: true,
    },
  });
  assert.equal(ok.ok, true);
  if (!ok.ok || ok.kind !== 'backup.daily') return;
  assert.ok(repository.copies.has(ok.backupId));

  const failingBase = createMemoryBackupRepository();
  const failing: typeof failingBase = {
    ...failingBase,
    async putEncryptedCopy() {
      throw new Error('upload_failed');
    },
  };
  const failed = await runDailyBackupJob({
    repository: failing,
    appTables: live,
    identityTables: {},
    now: '2026-11-09T01:01:00.000Z',
    provider: {
      kind: 'memory_fixture',
      regionOrJurisdiction: 'eu',
      bucketRef: 'fixture',
      repositoryPath: 'mem',
    },
    archiveKey: {
      kind: 'restic_password',
      keyId: 'vault://test',
      recoverableOffHost: true,
    },
  });
  assert.equal(failed.ok, false);
  if (failed.ok) return;
  assert.equal(failed.liveDataMutated, false);
  assert.deepEqual(keepLiveStateOnBackupFailure(live, new Error('x')), live);
});

test('erased family stays erased after ops restore when registry is applied first', async () => {
  const registry = createMemoryErasureRegistry();
  await registry.append({
    familyId: 'fam-erased',
    erasedAt: '2026-11-08T00:00:00.000Z',
    eraseGeneration: 1,
    opaqueEntityIds: [],
  });
  const restored = restoreOpsHostWithErasureGate({
    restoredFamilies: [
      { familyId: 'fam-erased', erasedAt: null },
      { familyId: 'fam-live', erasedAt: null },
    ],
    registry: await registry.load(),
    now: '2026-11-09T02:00:00.000Z',
  });
  assert.equal(restored.families.find((f) => f.familyId === 'fam-erased')?.erasedAt, '2026-11-08T00:00:00.000Z');
  assert.equal(restored.families.find((f) => f.familyId === 'fam-live')?.erasedAt, null);
  assert.equal(restored.apiOpen, true);
});

test('caregiver cannot download another family archive or erase without admin', async () => {
  const { app, tokens, backups } = await boot();
  const familyA = await createFamilyWithAdmin(app, tokens);
  const familyB = await createFamilyWithAdmin(app, tokens);

  const sealed = sealLogicalBackup({
    payload: buildLogicalBackupPayload({
      appTables: { note: 'private-a' },
      identityTables: {},
      exportedAt: '2026-11-09T00:00:00.000Z',
    }),
    scope: 'family_archive',
    familyId: familyA.familyId,
    provider: {
      kind: 'memory_fixture',
      regionOrJurisdiction: 'eu',
      bucketRef: 'fixture',
      repositoryPath: 'mem',
    },
    archiveKey: {
      kind: 'restic_password',
      keyId: 'vault://test',
      recoverableOffHost: true,
    },
    now: '2026-11-09T00:00:00.000Z',
  });
  await backups.putEncryptedCopy({
    backupId: sealed.manifest.backupId,
    ciphertext: sealed.ciphertext,
    manifest: sealed.manifest,
  });

  const denied = await app.inject({
    method: 'GET',
    url: `/v1/families/${familyB.familyId}/archives/${sealed.manifest.backupId}`,
    headers: { authorization: `Bearer ${familyB.token}` },
  });
  assert.equal(denied.statusCode, 403);

  const caregiverId = randomUUID() as AppUserId;
  const caregiverToken = await tokens.mintTestToken({
    subject: 'care-backup',
    appUserId: caregiverId,
  });
  // Caregiver without membership cannot preview recovery.
  const previewDenied = await app.inject({
    method: 'POST',
    url: `/v1/families/${familyA.familyId}/recovery/preview`,
    headers: { authorization: `Bearer ${caregiverToken}` },
    payload: { backupId: sealed.manifest.backupId },
  });
  assert.equal(previewDenied.statusCode, 403);

  const status = await app.inject({
    method: 'GET',
    url: `/v1/families/${familyA.familyId}/backup-status`,
    headers: { authorization: `Bearer ${familyA.token}` },
  });
  assert.equal(status.statusCode, 200);
  assert.equal(status.json().claimsOtherDevicesSynced, false);
  assert.equal(status.json().retentionDays, 30);

  await app.close();
});

test('server erasure requires durable registry write before soft-delete', async () => {
  const store = new MemoryFamilyStore();
  const adminId = randomUUID() as AppUserId;
  const now = '2026-11-09T03:00:00.000Z';
  store.ensureUser(adminId, now);
  const created = store.createFamily(
    adminId,
    {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: 'erase-1',
      displayName: 'To erase',
    },
    now,
  );
  const familyId = created.familyId as FamilyId;

  const failingBase = createMemoryErasureRegistry();
  const failingRegistry = {
    ...failingBase,
    async append() {
      throw new Error('off_host_unreachable');
    },
    load: failingBase.load,
    replace: failingBase.replace,
  };
  await assert.rejects(
    () =>
      eraseFamilyWithDurableRegistry({
        store,
        registry: failingRegistry,
        actorId: adminId,
        familyId,
        now,
      }),
    /off_host_unreachable/,
  );
  assert.equal(store.families.get(familyId)?.erasedAt, null);

  const registry = createMemoryErasureRegistry();
  const erased = await eraseFamilyWithDurableRegistry({
    store,
    registry,
    actorId: adminId,
    familyId,
    now,
  });
  assert.equal(erased.erased, true);
  assert.equal(erased.registryPersisted, true);
  assert.equal(store.families.get(familyId)?.erasedAt, now);
  assert.equal((await registry.load()).entries.length, 1);
});

test('retention prune enqueues and removes copies older than thirty days', async () => {
  const repository = createMemoryBackupRepository();
  const old = sealLogicalBackup({
    payload: buildLogicalBackupPayload({
      appTables: {},
      identityTables: {},
      exportedAt: '2026-09-01T00:00:00.000Z',
    }),
    scope: 'ops_host',
    familyId: null,
    provider: {
      kind: 'memory_fixture',
      regionOrJurisdiction: 'eu',
      bucketRef: 'fixture',
      repositoryPath: 'mem',
    },
    archiveKey: {
      kind: 'restic_password',
      keyId: 'vault://test',
      recoverableOffHost: true,
    },
    now: '2026-09-01T00:00:00.000Z',
  });
  const recent = sealLogicalBackup({
    payload: buildLogicalBackupPayload({
      appTables: {},
      identityTables: {},
      exportedAt: '2026-11-01T00:00:00.000Z',
    }),
    scope: 'ops_host',
    familyId: null,
    provider: {
      kind: 'memory_fixture',
      regionOrJurisdiction: 'eu',
      bucketRef: 'fixture',
      repositoryPath: 'mem',
    },
    archiveKey: {
      kind: 'restic_password',
      keyId: 'vault://test',
      recoverableOffHost: true,
    },
    now: '2026-11-01T00:00:00.000Z',
  });
  await repository.putEncryptedCopy({
    backupId: old.manifest.backupId,
    ciphertext: old.ciphertext,
    manifest: old.manifest,
  });
  await repository.putEncryptedCopy({
    backupId: recent.manifest.backupId,
    ciphertext: recent.ciphertext,
    manifest: recent.manifest,
  });

  const queue = createMemoryJobQueue();
  await queue.enqueue('backup.retention.prune');
  const result = await runRetentionPruneJob({
    repository,
    nowMs: Date.parse('2026-11-09T00:00:00.000Z'),
  });
  assert.equal(result.ok, true);
  if (!result.ok || result.kind !== 'backup.retention.prune') return;
  assert.deepEqual(result.deletedBackupIds, [old.manifest.backupId]);
  assert.equal(repository.copies.has(old.manifest.backupId), false);
  assert.equal(repository.copies.has(recent.manifest.backupId), true);
});
