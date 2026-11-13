import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  LOCAL_HTTP_S3_ATTACHMENT_DRILL_DEFAULTS,
  runAttachmentHttpS3CompatibleDrill,
} from '../src/attachments/attachmentHttpS3CompatibleDrill.ts';
import { resolveAttachmentObjectStore } from '../src/attachments/resolveAttachmentObjectStore.ts';
import { loadApiConfig } from '../src/config/env.ts';

test('HTTP drill defaults stay off personal cold boots', () => {
  const resolved = resolveAttachmentObjectStore(
    loadApiConfig({
      LUMI_TEST_HS256_SECRET: 'unit-test-hs256',
    } as NodeJS.ProcessEnv),
  );
  assert.equal(resolved.provider, 'memory');
  assert.equal(LOCAL_HTTP_S3_ATTACHMENT_DRILL_DEFAULTS.endpoint, 'http://127.0.0.1:9090');
});

test('deploy HTTP S3 drill script is present', () => {
  const deploy = join(process.cwd(), 'deploy');
  assert.equal(existsSync(join(deploy, 'attachment-http-s3-drill.sh')), true);
  assert.equal(existsSync(join(deploy, 'attachment-s3-compatible-drill.sh')), true);
});

test('live HTTP attachment path against S3Mock when healthy (otherwise skip)', async (t) => {
  const force = process.env.LUMI_FORCE_S3_DRILL === '1';
  const healthy = await s3CompatibleHealthy();
  if (!force && !healthy) {
    t.skip('local S3 endpoint not reachable; run npm run attachment:http-s3-drill');
    return;
  }
  const result = await runAttachmentHttpS3CompatibleDrill({
    ...LOCAL_HTTP_S3_ATTACHMENT_DRILL_DEFAULTS,
  });
  assert.equal(result.ok, true, result.cases.map((row) => `${row.name}:${row.detail}`).join('; '));
  assert.equal(result.provider, 'r2');
});

async function s3CompatibleHealthy(): Promise<boolean> {
  try {
    const response = await fetch(LOCAL_HTTP_S3_ATTACHMENT_DRILL_DEFAULTS.endpoint + '/', {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}
