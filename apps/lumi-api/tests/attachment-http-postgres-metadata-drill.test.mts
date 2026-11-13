import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LOCAL_HTTP_POSTGRES_METADATA_DRILL_DEFAULTS,
  runAttachmentHttpPostgresMetadataDrill,
} from '../src/attachments/attachmentHttpPostgresMetadataDrill.ts';
import { createFamilyAttachmentService, sha256Hex } from '../src/attachments/attachmentService.ts';
import { createMemoryAttachmentObjectStore } from '../src/attachments/objectStore.ts';
import { createFamilyAttachmentQuotaLedger } from '../src/attachments/quotaLedger.ts';
import type { AttachmentMetadataStorePort } from '../src/attachments/postgresAttachmentMetadataStore.ts';
import type { AppUserId, FamilyId } from '@lumi/contracts';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

test('HTTP Postgres metadata drill script and migration exist', () => {
  assert.equal(
    existsSync(join(packageRoot, 'deploy/attachment-http-postgres-metadata-drill.sh')),
    true,
  );
  assert.equal(existsSync(join(packageRoot, 'migrations/006_family_attachments.sql')), true);
});

test('finalize persists locators through optional metadata port without Postgres', async () => {
  const rows = new Map<string, { objectKey: string; sha256: string; byteLength: number }>();
  const erasures = new Map<string, number>();
  const metadata: AttachmentMetadataStorePort = {
    async activateObject(input) {
      rows.set(`${input.familyId}:${input.attachmentId}:${input.role}`, {
        objectKey: input.objectKey,
        sha256: input.sha256,
        byteLength: input.byteLength,
      });
    },
    async getObject(input) {
      const row = rows.get(`${input.familyId}:${input.attachmentId}:${input.role}`);
      if (!row) return null;
      return {
        familyId: input.familyId,
        attachmentId: input.attachmentId,
        role: input.role,
        objectKey: row.objectKey,
        byteLength: row.byteLength,
        sha256: row.sha256,
      };
    },
    async tombstone(input) {
      for (const role of ['display', 'thumbnail'] as const) {
        rows.delete(`${input.familyId}:${input.attachmentId}:${role}`);
      }
      erasures.set(`${input.familyId}:${input.attachmentId}`, input.eraseGeneration);
      return { removedObjects: 1 };
    },
    async getAttachment(input) {
      const erase = erasures.get(`${input.familyId}:${input.attachmentId}`);
      if (
        erase == null &&
        ![...rows.keys()].some((key) => key.startsWith(`${input.familyId}:${input.attachmentId}:`))
      ) {
        return null;
      }
      return {
        familyId: input.familyId,
        attachmentId: input.attachmentId,
        childId: 'child',
        eventId: 'event',
        createdBy: input.appUserId,
        eraseGeneration: erase ?? null,
        erasedAtMs: erase == null ? null : 1,
      };
    },
  };

  const objects = createMemoryAttachmentObjectStore();
  const quota = createFamilyAttachmentQuotaLedger({
    budgetBytes: 10_000,
    pendingReservationBudgetBytes: 10_000,
  });
  const service = createFamilyAttachmentService({ objects, quota, metadata });
  const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9, 7]);
  const digest = sha256Hex(bytes);
  const created = await service.createIntent({
    familyId: '11111111-1111-4111-8111-111111111111',
    appUserId: '22222222-2222-4222-8222-222222222222',
    membership: { active: true, role: 'caregiver' },
    attachmentId: '33333333-3333-4333-8333-333333333333',
    childId: 'child_1',
    eventId: 'note_1',
    role: 'display',
    expectedBytes: bytes.byteLength,
    expectedSha256: digest,
    nowMs: 1_000,
    idempotencyKey: 'meta-wire-1',
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  await service.uploadBytes({
    intentId: created.response.intentId,
    appUserId: '22222222-2222-4222-8222-222222222222',
    membership: { active: true, role: 'caregiver' },
    bytes,
    nowMs: 1_100,
  });
  const finalized = await service.finalize({
    intentId: created.response.intentId,
    appUserId: '22222222-2222-4222-8222-222222222222' as AppUserId,
    membership: { active: true, role: 'caregiver' },
    sha256: digest,
    byteLength: bytes.byteLength,
    nowMs: 1_200,
  });
  assert.equal(finalized.ok, true);
  assert.equal(
    rows.has('11111111-1111-4111-8111-111111111111:33333333-3333-4333-8333-333333333333:display'),
    true,
  );

  const erased = await service.tombstone({
    familyId: '11111111-1111-4111-8111-111111111111',
    attachmentId: '33333333-3333-4333-8333-333333333333',
    membership: { active: true, role: 'admin' },
    eraseGeneration: 1,
    appUserId: '22222222-2222-4222-8222-222222222222',
    nowMs: 1_300,
  });
  assert.equal(erased.ok, true);
  assert.equal(
    erasures.get('11111111-1111-4111-8111-111111111111:33333333-3333-4333-8333-333333333333'),
    1,
  );

  const blocked = await service.createIntent({
    familyId: '11111111-1111-4111-8111-111111111111' as FamilyId,
    appUserId: '22222222-2222-4222-8222-222222222222' as AppUserId,
    membership: { active: true, role: 'caregiver' },
    attachmentId: '33333333-3333-4333-8333-333333333333',
    childId: 'child_1',
    eventId: 'note_1',
    role: 'display',
    expectedBytes: bytes.byteLength,
    expectedSha256: digest,
    nowMs: 1_400,
    idempotencyKey: 'meta-wire-retry',
  });
  assert.equal(blocked.ok, false);
});

test('live HTTP path with Postgres metadata when Compose is healthy (otherwise skip)', async (t) => {
  const force = process.env.LUMI_FORCE_ATTACHMENT_HTTP_PG_META_DRILL === '1';
  const healthy = (await postgresHealthy()) && (await s3Healthy());
  if (!force && !healthy) {
    t.skip('Compose Postgres/S3Mock not reachable; run npm run attachment:http-pg-meta-drill');
    return;
  }
  const result = await runAttachmentHttpPostgresMetadataDrill({
    ...LOCAL_HTTP_POSTGRES_METADATA_DRILL_DEFAULTS,
  });
  assert.equal(result.ok, true, result.cases.map((row) => `${row.name}:${row.detail}`).join('; '));
  assert.equal(result.personalColdUnaffected, true);
  assert.equal(result.cloudflareR2Ready, false);
  assert.ok(
    result.cases.some((row) => row.name === 'read_after_api_reboot_via_postgres' && row.ok),
  );
});

async function postgresHealthy(): Promise<boolean> {
  try {
    const pg = await import('pg');
    const client = new pg.default.Client({
      connectionString: LOCAL_HTTP_POSTGRES_METADATA_DRILL_DEFAULTS.adminDatabaseUrl,
      connectionTimeoutMillis: 1_500,
    });
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

async function s3Healthy(): Promise<boolean> {
  try {
    const response = await fetch(LOCAL_HTTP_POSTGRES_METADATA_DRILL_DEFAULTS.endpoint + '/', {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}
