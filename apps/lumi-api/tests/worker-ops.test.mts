import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMemoryJobQueue } from '../src/ops/jobQueue.ts';
import { runWorkerLoop } from '../src/ops/workerLoop.ts';
import { createFixedWindowRateLimiter } from '../src/http/rateLimit.ts';
import { loadApiConfig } from '../src/config/env.ts';
import { createFamilyApi } from '../src/http/createServer.ts';

const here = dirname(fileURLToPath(import.meta.url));

test('two workers never complete the same leased job', async () => {
  let now = 1_000;
  const queue = createMemoryJobQueue(() => now);
  const jobId = await queue.enqueue('ops.noop', { n: 1 });

  const first = await queue.claim('worker-a', 5_000);
  const second = await queue.claim('worker-b', 5_000);
  assert.equal(first?.jobId, jobId);
  assert.equal(second, null);

  assert.equal(await queue.complete(jobId, 'worker-b'), false);
  assert.equal(await queue.complete(jobId, 'worker-a'), true);

  // Expired lease can be taken by the other worker.
  const job2 = await queue.enqueue('health.ping');
  const leased = await queue.claim('worker-a', 10);
  assert.equal(leased?.jobId, job2);
  now += 50;
  const stolen = await queue.claim('worker-b', 5_000);
  assert.equal(stolen?.jobId, job2);
  assert.equal(await queue.complete(job2, 'worker-a'), false);
  assert.equal(await queue.complete(job2, 'worker-b'), true);
});

test('worker loop processes jobs and stops on abort without losing control', async () => {
  const queue = createMemoryJobQueue();
  await queue.enqueue('ops.noop');
  await queue.enqueue('health.ping');
  const controller = new AbortController();
  const running = runWorkerLoop({
    workerId: 'loop-1',
    queue,
    leaseMs: 1_000,
    pollMs: 5,
    signal: controller.signal,
  });
  await new Promise((resolve) => setTimeout(resolve, 40));
  controller.abort();
  const result = await running;
  assert.ok(result.processed >= 1);
  assert.equal(result.stoppedReason, 'signal');
  assert.equal(await queue.pendingCount(), 0);
});

test('rate limiter rejects bursts with retry-after', async () => {
  let now = 0;
  const limiter = createFixedWindowRateLimiter({
    limit: 2,
    windowMs: 1_000,
    nowMs: () => now,
  });
  assert.equal(limiter.check('ip').allowed, true);
  assert.equal(limiter.check('ip').allowed, true);
  const blocked = limiter.check('ip');
  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) assert.ok(blocked.retryAfterSec >= 1);
  now = 1_001;
  assert.equal(limiter.check('ip').allowed, true);
});

test('API returns rate_limited without diary payloads', async () => {
  const config = loadApiConfig({
    LUMI_TEST_HS256_SECRET: 'unit-test-hs256',
    LUMI_OIDC_ISSUER: 'http://test.invalid/realms/lumi',
    LUMI_RATE_LIMIT_PER_WINDOW: '2',
    LUMI_RATE_LIMIT_WINDOW_MS: '60000',
  } as NodeJS.ProcessEnv);
  const { app } = await createFamilyApi(config);
  assert.equal((await app.inject({ method: 'GET', url: '/v1/auth/mode' })).statusCode, 200);
  assert.equal((await app.inject({ method: 'GET', url: '/v1/auth/mode' })).statusCode, 200);
  const limited = await app.inject({ method: 'GET', url: '/v1/auth/mode' });
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.json().error.code, 'rate_limited');
  assert.equal(limited.json().error.message.includes('diary'), false);
  await app.close();
});

test('operations owners handoff denies E2EE claims and names next gates', () => {
  const raw = readFileSync(join(here, '../deploy/operations-owners.json'), 'utf8');
  const owners = JSON.parse(raw) as {
    e2eeClaim: boolean;
    roles: Record<string, string>;
    handoff: Record<string, string[]>;
  };
  assert.equal(owners.e2eeClaim, false);
  assert.ok(owners.roles.composeOwner);
  const to31 = owners.handoff.toTask31 ?? [];
  const to392 = owners.handoff.toTask392 ?? [];
  assert.ok(to31.length > 0);
  assert.ok(to392.some((item) => /LUKS/i.test(item)));
});
