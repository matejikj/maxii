import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createS3CompatibleClient } from '../src/attachments/s3CompatibleClient.ts';
import { createR2AttachmentObjectStore } from '../src/attachments/r2AttachmentObjectStore.ts';
import { resolveAttachmentObjectStore } from '../src/attachments/resolveAttachmentObjectStore.ts';
import { loadApiConfig } from '../src/config/env.ts';

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

test('S3-compatible client signs PutObject and R2 store activates without publishing staging', async () => {
  const bucket = new Map<string, Uint8Array>();
  const client = createS3CompatibleClient({
    config: {
      endpoint: 'https://example.r2.cloudflarestorage.com',
      region: 'auto',
      bucket: 'lumi-family-photos',
      accessKeyId: 'AKIA_TEST',
      secretAccessKey: 'secret_test',
      forcePathStyle: true,
    },
    now: () => new Date('2026-11-09T12:00:00.000Z'),
    fetchImpl: async (url, init) => {
      const path = new URL(url).pathname;
      assert.match(init.headers.authorization ?? '', /AWS4-HMAC-SHA256/);
      assert.equal(init.headers['x-amz-content-sha256']?.length, 64);
      const empty = async (): Promise<ArrayBuffer> => new ArrayBuffer(0);
      if (init.method === 'PUT' && init.body) {
        bucket.set(path, Uint8Array.from(init.body));
        return {
          status: 200,
          headers: { get: () => null },
          arrayBuffer: empty,
        };
      }
      if (init.method === 'GET') {
        const found = bucket.get(path);
        if (!found) {
          return {
            status: 404,
            headers: { get: () => null },
            arrayBuffer: empty,
          };
        }
        const copy = found.slice();
        return {
          status: 200,
          headers: { get: () => null },
          async arrayBuffer(): Promise<ArrayBuffer> {
            const out = new ArrayBuffer(copy.byteLength);
            new Uint8Array(out).set(copy);
            return out;
          },
        };
      }
      if (init.method === 'DELETE') {
        bucket.delete(path);
        return {
          status: 204,
          headers: { get: () => null },
          arrayBuffer: empty,
        };
      }
      return {
        status: 500,
        headers: { get: () => null },
        arrayBuffer: empty,
      };
    },
  });

  const store = createR2AttachmentObjectStore({ client });
  const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9, 42]);
  const digest = sha256(bytes);
  const objectKey = 'fam/f1/att/a1/display/intent1';

  const staged = await store.putStaging({
    objectKey,
    familyId: 'f1',
    attachmentId: 'a1',
    role: 'display',
    bytes,
    expectedSha256: digest,
  });
  assert.equal(staged.ok, true);
  assert.equal(await store.readActivated(objectKey), null);

  const activated = await store.activate(objectKey);
  assert.equal(activated, true);
  const read = await store.readActivated(objectKey);
  assert.ok(read);
  assert.equal(read?.sha256, digest);
  assert.equal(read?.activated, true);

  const removed = await store.tombstoneByAttachment({ familyId: 'f1', attachmentId: 'a1' });
  assert.equal(removed, 1);
  assert.equal(await store.readActivated(objectKey), null);
});

test('attachment object store stays memory unless R2 env is fully configured', () => {
  const memory = resolveAttachmentObjectStore(
    loadApiConfig({
      LUMI_TEST_HS256_SECRET: 'unit-test-hs256',
    } as NodeJS.ProcessEnv),
  );
  assert.equal(memory.provider, 'memory');

  const incomplete = resolveAttachmentObjectStore(
    loadApiConfig({
      LUMI_TEST_HS256_SECRET: 'unit-test-hs256',
      LUMI_ATTACHMENT_STORE: 'r2',
      LUMI_R2_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
      // bucket/keys intentionally missing
    } as NodeJS.ProcessEnv),
  );
  assert.equal(incomplete.provider, 'memory');

  const r2 = resolveAttachmentObjectStore(
    loadApiConfig({
      LUMI_TEST_HS256_SECRET: 'unit-test-hs256',
      LUMI_ATTACHMENT_STORE: 'r2',
      LUMI_R2_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
      LUMI_R2_BUCKET: 'lumi-family-photos',
      LUMI_R2_ACCESS_KEY_ID: 'AKIA',
      LUMI_R2_SECRET_ACCESS_KEY: 'secret',
    } as NodeJS.ProcessEnv),
  );
  assert.equal(r2.provider, 'r2');
});
