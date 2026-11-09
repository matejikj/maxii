import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ATTACHMENT_TRASH_RETENTION_MS,
  attachmentTrashRetainUntilMs,
  filterRestoredAttachmentsAgainstErasure,
  planAttachmentPayloadPurge,
} from '../../src/domain/index.ts';

test('attachment payload purge waits for trash retention and pins', () => {
  const deletedAtMs = 1_000;
  const retainUntilMs = attachmentTrashRetainUntilMs(deletedAtMs);
  assert.equal(retainUntilMs, deletedAtMs + ATTACHMENT_TRASH_RETENTION_MS);

  assert.equal(
    planAttachmentPayloadPurge({
      attachmentId: 'a1',
      deletedAtMs,
      retainUntilMs,
      referencedByCheckpoint: false,
      referencedByConflict: false,
      hasActiveTransferJob: false,
      localCopyKinds: ['own'],
      nowMs: retainUntilMs - 1,
    }).purge,
    false,
  );

  assert.deepEqual(
    planAttachmentPayloadPurge({
      attachmentId: 'a1',
      deletedAtMs,
      retainUntilMs,
      referencedByCheckpoint: true,
      referencedByConflict: false,
      hasActiveTransferJob: false,
      localCopyKinds: ['own', 'cache'],
      nowMs: retainUntilMs + 1,
    }),
    { purge: false, reason: 'checkpoint_pin' },
  );

  assert.deepEqual(
    planAttachmentPayloadPurge({
      attachmentId: 'a1',
      deletedAtMs,
      retainUntilMs,
      referencedByCheckpoint: false,
      referencedByConflict: false,
      hasActiveTransferJob: true,
      localCopyKinds: ['pending'],
      nowMs: retainUntilMs + 1,
    }),
    { purge: false, reason: 'active_job' },
  );

  assert.deepEqual(
    planAttachmentPayloadPurge({
      attachmentId: 'a1',
      deletedAtMs,
      retainUntilMs,
      referencedByCheckpoint: false,
      referencedByConflict: false,
      hasActiveTransferJob: false,
      localCopyKinds: ['own', 'cache'],
      nowMs: retainUntilMs + 1,
    }),
    {
      purge: true,
      retainMetadataTombstone: true,
      purgeBlobKeys: 'all_local_copies',
    },
  );
});

test('restored dumps hide attachments already covered by a newer erasure', () => {
  const result = filterRestoredAttachmentsAgainstErasure({
    restoredAttachmentIds: ['alive', 'gone', 'also_alive'],
    erasureByAttachmentId: new Map([['gone', { eraseGeneration: 2 }]]),
  });
  assert.deepEqual(result.visibleAttachmentIds, ['alive', 'also_alive']);
  assert.deepEqual(result.blockedByErasureIds, ['gone']);
});
