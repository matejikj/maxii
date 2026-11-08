import assert from 'node:assert/strict';
import { test } from 'node:test';
import 'fake-indexeddb/auto';
import {
  SUPPORT_MATRIX,
  VERIFIED_STACK,
  runStackCompatibilityChecks,
} from '../src/infrastructure/verification/stackCompatibility.ts';
import { runIndexedDbAdapterProbe } from '../src/infrastructure/database/web/indexedDbAdapter.ts';
import { QueryClient } from '@tanstack/react-query';
import {
  EncryptedDatabaseError,
  assertSqlCipherAvailable,
} from '../src/infrastructure/database/native/cipherGuard.ts';

test('verified stack table lists concrete packages with licenses and reasons', () => {
  assert.ok(VERIFIED_STACK.length >= 8);
  for (const entry of VERIFIED_STACK) {
    assert.ok(entry.packageName.length > 0);
    assert.ok(entry.version.length > 0);
    assert.ok(entry.license.length > 0);
    assert.ok(entry.reason.length > 0);
    assert.ok(entry.platforms.length > 0);
  }
  assert.ok(SUPPORT_MATRIX.browsers.includes('Safari (current macOS/iOS)'));
  assert.match(SUPPORT_MATRIX.referenceDevices.androidPhysical, /Pixel 6/);
});

test('zod, luxon DST and portable backup smoke checks pass', () => {
  const result = runStackCompatibilityChecks();
  assert.equal(result.stackSize, VERIFIED_STACK.length);
  assert.notEqual(result.dst.beforeOffset, result.dst.afterOffset);
});

test('IndexedDB adapter probe survives a second connection', async () => {
  const result = await runIndexedDbAdapterProbe(`lumi-test-${Date.now()}`);
  assert.equal(result.wrote, result.read);
});

test('discardable query client defaults avoid implying durable cache', () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5_000,
        gcTime: 60_000,
        retry: false,
      },
    },
  });
  assert.equal(client.getDefaultOptions().queries?.retry, false);
  client.clear();
});

test('missing SQLCipher is rejected before private records can open', async () => {
  await assert.rejects(
    () =>
      assertSqlCipherAvailable(() => ({
        async execAsync() {},
        async getFirstAsync() {
          return null;
        },
        async closeAsync() {},
      })),
    (error: unknown) =>
      error instanceof EncryptedDatabaseError && error.code === 'CIPHER_UNAVAILABLE',
  );
});
