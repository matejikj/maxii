import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createS3CompatibleClient } from '../src/attachments/s3CompatibleClient.ts';
import {
  LOCAL_S3_COMPATIBLE_ATTACHMENT_DRILL_DEFAULTS,
  runAttachmentS3CompatibleDrill,
} from '../src/attachments/attachmentS3CompatibleDrill.ts';
import { resolveAttachmentObjectStore } from '../src/attachments/resolveAttachmentObjectStore.ts';
import { loadApiConfig } from '../src/config/env.ts';

test('ensureBucket signs CreateBucket for path-style endpoints', async () => {
  let seenMethod = '';
  let seenUrl = '';
  const client = createS3CompatibleClient({
    config: {
      endpoint: 'http://127.0.0.1:9090',
      region: 'us-east-1',
      bucket: 'lumi-family-photos',
      accessKeyId: 'test',
      secretAccessKey: 'test',
      forcePathStyle: true,
    },
    now: () => new Date('2026-11-10T09:00:00.000Z'),
    fetchImpl: async (url, init) => {
      seenMethod = init.method;
      seenUrl = url;
      assert.match(init.headers.authorization ?? '', /AWS4-HMAC-SHA256/);
      return {
        status: 200,
        headers: { get: () => null },
        arrayBuffer: async () => new ArrayBuffer(0),
      };
    },
  });
  assert.equal(await client.ensureBucket(), true);
  assert.equal(seenMethod, 'PUT');
  assert.equal(seenUrl, 'http://127.0.0.1:9090/lumi-family-photos');
});

test('default API config keeps memory object store without MinIO/R2 env', () => {
  const resolved = resolveAttachmentObjectStore(
    loadApiConfig({
      LUMI_TEST_HS256_SECRET: 'unit-test-hs256',
    } as NodeJS.ProcessEnv),
  );
  assert.equal(resolved.provider, 'memory');
});

test('deploy s3-compatible drill script is present next to locator drill', () => {
  const deploy = join(process.cwd(), 'deploy');
  assert.equal(existsSync(join(deploy, 'attachment-s3-compatible-drill.sh')), true);
  assert.equal(existsSync(join(deploy, 'attachment-locator-migration-drill.sh')), true);
  assert.equal(LOCAL_S3_COMPATIBLE_ATTACHMENT_DRILL_DEFAULTS.bucket, 'lumi-family-photos');
  assert.equal(LOCAL_S3_COMPATIBLE_ATTACHMENT_DRILL_DEFAULTS.endpoint, 'http://127.0.0.1:9090');
});

test('live S3Mock drill when endpoint is healthy (otherwise skip)', async (t) => {
  const force = process.env.LUMI_FORCE_S3_DRILL === '1';
  const healthy = await s3CompatibleHealthy();
  if (!force && !healthy) {
    t.skip('local S3 endpoint not reachable; run npm run attachment:s3-drill');
    return;
  }
  const result = await runAttachmentS3CompatibleDrill({
    ...LOCAL_S3_COMPATIBLE_ATTACHMENT_DRILL_DEFAULTS,
  });
  assert.equal(result.ok, true, result.cases.map((row) => `${row.name}:${row.detail}`).join('; '));
});

async function s3CompatibleHealthy(): Promise<boolean> {
  try {
    const response = await fetch(LOCAL_S3_COMPATIBLE_ATTACHMENT_DRILL_DEFAULTS.endpoint + '/', {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}
