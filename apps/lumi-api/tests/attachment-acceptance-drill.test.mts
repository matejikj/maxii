import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import {
  LOCAL_ATTACHMENT_ACCEPTANCE_DRILL_DEFAULTS,
  runAttachmentAcceptanceDrill,
} from '../src/attachments/attachmentAcceptanceDrill.ts';
import { createFamilyAttachmentService, sha256Hex } from '../src/attachments/attachmentService.ts';
import { createMemoryAttachmentObjectStore } from '../src/attachments/objectStore.ts';
import { createFamilyAttachmentQuotaLedger } from '../src/attachments/quotaLedger.ts';
import { createPostgresFamilyAttachmentQuotaLedger } from '../src/attachments/postgresQuotaLedger.ts';
import { createMemoryJobQueue } from '../src/ops/jobQueue.ts';
import { runWorkerLoop } from '../src/ops/workerLoop.ts';
import { MemorySyncStore } from '../src/sync/syncStore.ts';
import type { AppDbPool } from '../src/db/pool.ts';
import type { AppUserId, FamilyId } from '@lumi/contracts';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

test('acceptance drill script, migration 007, and npm script exist', () => {
  assert.equal(existsSync(join(packageRoot, 'deploy/attachment-acceptance-drill.sh')), true);
  assert.equal(existsSync(join(packageRoot, 'migrations/007_family_attachment_quota.sql')), true);
  const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  assert.ok(pkg.scripts['attachment:acceptance-drill']);
  const compose = readFileSync(
    join(packageRoot, 'deploy/attachment-compose-stack-drill.sh'),
    'utf8',
  );
  assert.match(compose, /family_attachment_quota/);
  const migration = readFileSync(
    join(packageRoot, 'migrations/007_family_attachment_quota.sql'),
    'utf8',
  );
  assert.doesNotMatch(migration, /enable row level security/i);
});

/** Minimal pg pool double that models row locks per family via a queue. */
function fakeQuotaPool(): { pool: AppDbPool; queries: string[] } {
  const rows = new Map<string, { used: number; reserved: number }>();
  const queries: string[] = [];
  const tails = new Map<string, Promise<void>>();
  const pool = {
    async connect() {
      let family = '';
      let release: (() => void) | null = null;
      return {
        async query(sql: string, params: unknown[] = []) {
          queries.push(sql.replace(/\s+/g, ' ').trim());
          if (/^begin|^commit|^rollback/i.test(sql.trim())) {
            if (/^(commit|rollback)/i.test(sql.trim())) release?.();
            return { rows: [] };
          }
          if (/insert into family_attachment_quota/.test(sql)) {
            rows.set(String(params[0]), rows.get(String(params[0])) ?? { used: 0, reserved: 0 });
            return { rows: [] };
          }
          if (/for update/.test(sql)) {
            family = String(params[0]);
            const previous = tails.get(family) ?? Promise.resolve();
            let done!: () => void;
            const gate = new Promise<void>((resolve) => {
              done = resolve;
            });
            tails.set(
              family,
              previous.then(() => gate),
            );
            release = done;
            await previous;
            const row = rows.get(family)!;
            return {
              rows: [{ used_bytes: String(row.used), reserved_bytes: String(row.reserved) }],
            };
          }
          if (/^update family_attachment_quota/.test(sql.trim())) {
            rows.set(String(params[0]), { used: Number(params[1]), reserved: Number(params[2]) });
            return { rows: [] };
          }
          throw new Error(`unexpected sql: ${sql}`);
        },
        release() {
          release?.();
        },
      };
    },
    async query(_sql: string, params: unknown[] = []) {
      const row = rows.get(String(params[0]));
      return {
        rows: row ? [{ used_bytes: String(row.used), reserved_bytes: String(row.reserved) }] : [],
      };
    },
  } as unknown as AppDbPool;
  return { pool, queries };
}

test('postgres quota ledger serializes parallel reserves with FOR UPDATE', async () => {
  const { pool, queries } = fakeQuotaPool();
  const ledger = createPostgresFamilyAttachmentQuotaLedger(pool, {
    budgetBytes: 1_000,
    pendingReservationBudgetBytes: 20,
  });
  const familyId = randomUUID();
  const results = await Promise.all(Array.from({ length: 6 }, () => ledger.reserve(familyId, 8)));
  assert.equal(results.filter((row) => row.ok).length, 2);
  assert.equal(
    results.filter((row) => !row.ok && row.reason === 'pending_budget_exceeded').length,
    4,
  );
  assert.equal((await ledger.view(familyId)).reservedBytes, 16);
  assert.ok(queries.some((sql) => /for update/i.test(sql)));

  await ledger.commitReservation(familyId, 8);
  let view = await ledger.view(familyId);
  assert.equal(view.usedBytes, 8);
  assert.equal(view.reservedBytes, 8);
  await ledger.releaseReservation(familyId, 8);
  await ledger.releaseUsed(familyId, 8);
  view = await ledger.view(familyId);
  assert.equal(view.usedBytes, 0);
  assert.equal(view.reservedBytes, 0);
});

test('finalize fires onRenditionActivated and expired-intent GC releases reservation', async () => {
  const events: { attachmentId: string; sha256: string; role: string }[] = [];
  const quota = createFamilyAttachmentQuotaLedger({
    budgetBytes: 10_000,
    pendingReservationBudgetBytes: 10_000,
  });
  const service = createFamilyAttachmentService({
    objects: createMemoryAttachmentObjectStore(),
    quota,
    onRenditionActivated: (event) => {
      events.push({ attachmentId: event.attachmentId, sha256: event.sha256, role: event.role });
    },
  });
  const familyId = '11111111-1111-4111-8111-111111111111';
  const appUserId = '22222222-2222-4222-8222-222222222222';
  const membership = { active: true, role: 'caregiver' } as const;
  const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9, 9]);
  const digest = sha256Hex(bytes);
  const make = (attachmentId: string, key: string, nowMs: number) =>
    service.createIntent({
      familyId,
      appUserId,
      membership,
      attachmentId,
      childId: 'child_1',
      eventId: 'note_1',
      role: 'display',
      expectedBytes: bytes.byteLength,
      expectedSha256: digest,
      nowMs,
      idempotencyKey: key,
    });

  const live = await make('33333333-3333-4333-8333-333333333333', 'k1', 1_000);
  assert.equal(live.ok, true);
  if (!live.ok) return;
  await service.uploadBytes({
    intentId: live.response.intentId,
    appUserId,
    membership,
    bytes,
    nowMs: 1_100,
  });
  const done = await service.finalize({
    intentId: live.response.intentId,
    appUserId: appUserId as AppUserId,
    membership,
    sha256: digest,
    byteLength: bytes.byteLength,
    nowMs: 1_200,
  });
  assert.equal(done.ok, true);
  assert.deepEqual(events, [
    { attachmentId: '33333333-3333-4333-8333-333333333333', sha256: digest, role: 'display' },
  ]);

  const stale = await make('44444444-4444-4444-8444-444444444444', 'k2', 1_000);
  assert.equal(stale.ok, true);
  assert.equal(quota.view(familyId).reservedBytes, bytes.byteLength);
  assert.equal(await service.cleanupExpiredIntents(500), 0);
  assert.equal(await service.cleanupExpiredIntents(Date.now() + 2 * 24 * 60 * 60 * 1000), 1);
  assert.equal(quota.view(familyId).reservedBytes, 0);
  assert.equal(quota.view(familyId).usedBytes, bytes.byteLength);
});

test('sync store records attachment activation once and pull returns attachment.upsert', async () => {
  const sync = new MemorySyncStore();
  const familyId = randomUUID() as FamilyId;
  const appUserId = randomUUID() as AppUserId;
  const event = {
    familyId,
    attachmentId: randomUUID(),
    childId: 'child_1',
    eventId: 'note_1',
    role: 'display',
    byteLength: 5,
    sha256: 'a'.repeat(64),
    appUserId,
  };
  const first = await sync.recordAttachmentActivation(event);
  const again = await sync.recordAttachmentActivation(event);
  assert.equal(first.duplicate, false);
  assert.equal(again.duplicate, true);
  assert.equal(again.changelogSeq, first.changelogSeq);
  const pulled = sync.pull({
    familyId,
    appUserId,
    memberships: [{ appUserId, familyId, role: 'admin', status: 'active' }],
    cursor: null,
  });
  assert.equal(pulled.entries.length, 1);
  assert.equal(pulled.entries[0]!.kind, 'attachment.upsert');
  assert.equal(pulled.entries[0]!.entityId, event.attachmentId);
  assert.equal(JSON.stringify(pulled.entries[0]!.payload).includes('fam/'), false);
});

test('worker loop acknowledges attachment.intent.expire jobs', async () => {
  const queue = createMemoryJobQueue();
  await queue.enqueue('attachment.intent.expire');
  const controller = new AbortController();
  const running = runWorkerLoop({ workerId: 'gc-1', queue, pollMs: 5, signal: controller.signal });
  await new Promise((resolve) => setTimeout(resolve, 40));
  controller.abort();
  const result = await running;
  assert.equal(result.processed, 1);
  assert.equal(await queue.pendingCount(), 0);
});

test('live acceptance drill on Compose PG + S3Mock when healthy (otherwise skip)', async (t) => {
  const force = process.env.LUMI_FORCE_ATTACHMENT_ACCEPTANCE_DRILL === '1';
  const healthy = (await postgresHealthy()) && (await s3Healthy());
  if (!force && !healthy) {
    t.skip('Compose Postgres/S3Mock not reachable; run npm run attachment:acceptance-drill');
    return;
  }
  const result = await runAttachmentAcceptanceDrill({
    ...LOCAL_ATTACHMENT_ACCEPTANCE_DRILL_DEFAULTS,
  });
  assert.equal(
    result.ok,
    true,
    result.cases.map((row) => `${row.name}:${row.ok}:${row.detail}`).join('; '),
  );
  assert.equal(result.softwareReady, true);
  assert.equal(result.liveReady, false);
  assert.equal(result.cloudflareR2Ready, false);
  for (const name of [
    'personal_cold_memory_default',
    'concurrent_quota_http',
    'expired_intent_gc',
    'revoke_before_finalize',
    'cross_family_idor_denied',
    'finalize_emits_sync_attachment_upsert',
  ]) {
    assert.ok(
      result.cases.some((row) => row.name === name && row.ok),
      name,
    );
  }
});

async function postgresHealthy(): Promise<boolean> {
  try {
    const pg = await import('pg');
    const client = new pg.default.Client({
      connectionString: LOCAL_ATTACHMENT_ACCEPTANCE_DRILL_DEFAULTS.adminDatabaseUrl,
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
    const response = await fetch(LOCAL_ATTACHMENT_ACCEPTANCE_DRILL_DEFAULTS.endpoint + '/');
    return response.ok;
  } catch {
    return false;
  }
}
