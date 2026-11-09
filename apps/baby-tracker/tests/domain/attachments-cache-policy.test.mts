import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifyPhotoExportCompleteness,
  decideSoleOwnCopyRelease,
  planRecoverableCacheEviction,
} from '../../src/domain/index.ts';

test('LRU eviction never lists own, pending, or pinned copies', () => {
  const plan = planRecoverableCacheEviction({
    budgetBytes: 100,
    copies: [
      { blobKey: 'own_1', kind: 'own', byteLength: 500, lastAccessMs: 1 },
      { blobKey: 'pending_1', kind: 'pending', byteLength: 500, lastAccessMs: 2 },
      { blobKey: 'pinned_1', kind: 'pinned', byteLength: 500, lastAccessMs: 3 },
      { blobKey: 'cache_old', kind: 'cache', byteLength: 80, lastAccessMs: 10 },
      { blobKey: 'cache_new', kind: 'cache', byteLength: 80, lastAccessMs: 20 },
    ],
  });
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.deepEqual(plan.evictBlobKeys, ['cache_old']);
  assert.equal(plan.remainingCacheBytes, 80);
  assert.equal(plan.evictBlobKeys.includes('own_1'), false);
  assert.equal(plan.evictBlobKeys.includes('pending_1'), false);
  assert.equal(plan.evictBlobKeys.includes('pinned_1'), false);
});

test('sole own copy release requires remote proof plus backup or full archive', () => {
  assert.equal(
    decideSoleOwnCopyRelease({
      isSoleOwnCopy: true,
      remoteCopyVerified: true,
      independentBackupConfirmed: false,
      completePortableArchiveVerified: false,
      userConfirmedOfflineLoss: true,
    }).allow,
    false,
  );
  assert.equal(
    decideSoleOwnCopyRelease({
      isSoleOwnCopy: true,
      remoteCopyVerified: true,
      independentBackupConfirmed: true,
      completePortableArchiveVerified: false,
      userConfirmedOfflineLoss: true,
    }).allow,
    true,
  );
});

test('partial photo export is labeled incomplete and never full_photo_backup', () => {
  const partial = classifyPhotoExportCompleteness({
    expectedAttachmentIds: ['a', 'b', 'c'],
    includedAttachmentIds: ['a', 'c'],
  });
  assert.equal(partial.complete, false);
  if (partial.complete) return;
  assert.equal(partial.label, 'incomplete_photo_export');
  assert.deepEqual(partial.missingAttachmentIds, ['b']);

  const full = classifyPhotoExportCompleteness({
    expectedAttachmentIds: ['a', 'b'],
    includedAttachmentIds: ['b', 'a'],
  });
  assert.equal(full.complete, true);
  if (!full.complete) return;
  assert.equal(full.label, 'full_photo_backup');
});
