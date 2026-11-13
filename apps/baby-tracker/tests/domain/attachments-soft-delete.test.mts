import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from '@noble/hashes/utils.js';
import {
  ATTACHMENT_TRASH_RETENTION_MS,
  asAttachmentId,
  asRenditionId,
  type AttachmentServices,
  type PhotoAttachment,
} from '../../src/domain/attachments/index.ts';
import type { ChildId, EntityId } from '../../src/domain/ids.ts';
import {
  cancelTransferJobsForAttachment,
  purgeExpiredPhotoPayloads,
  restorePhotoAttachment,
  softDeletePhotoAttachment,
} from '../../src/application/softDeletePhotoAttachment.ts';
import { createFamilyPhotoTransferRuntime } from '../../src/application/familyPhotoTransferRuntime.ts';
import { createMemoryAttachmentRepository } from '../../src/infrastructure/attachments/memoryAttachmentRepository.ts';
import { createMemoryPrivateAttachmentStore } from '../../src/infrastructure/attachments/memoryPrivateAttachmentStore.ts';
import { createSyntheticPhotoProcessor } from '../../src/infrastructure/attachments/syntheticPhotoProcessor.ts';

function services(): AttachmentServices {
  const key = randomBytes(32);
  return {
    picker: {
      async pickPhotos() {
        return { status: 'cancelled' };
      },
    },
    processor: createSyntheticPhotoProcessor(),
    blobs: createMemoryPrivateAttachmentStore({ key }),
    repository: createMemoryAttachmentRepository(),
  };
}

function row(): PhotoAttachment {
  const attachmentId = asAttachmentId('att_soft');
  return {
    attachmentId,
    childId: 'child_1' as ChildId,
    eventId: 'event_1' as EntityId,
    hostEventType: 'note',
    orderIndex: 0,
    caption: null,
    recordedBy: null,
    createdAtMs: 1,
    deletedAtMs: null,
    retainUntilMs: null,
    offlinePinned: false,
    localOrigin: 'imported',
    renditions: [
      {
        renditionId: asRenditionId('rend_d'),
        attachmentId,
        role: 'display',
        mime: 'image/jpeg',
        width: 8,
        height: 8,
        byteLength: 12,
        sha256: 'a'.repeat(64),
        normalizationVersion: 'v1',
        blobKey: 'att/att_soft/display.jpe.sealed',
        availability: 'durable',
      },
      {
        renditionId: asRenditionId('rend_t'),
        attachmentId,
        role: 'thumbnail',
        mime: 'image/jpeg',
        width: 4,
        height: 4,
        byteLength: 4,
        sha256: 'b'.repeat(64),
        normalizationVersion: 'v1',
        blobKey: 'att/att_soft/thumb.jpe.sealed',
        availability: 'durable',
      },
    ],
  };
}

test('soft-delete keeps sealed bytes and cancels open transfer jobs', async () => {
  const attachments = services();
  const photo = row();
  for (const rendition of photo.renditions) {
    await attachments.blobs.writeDurable({
      blobKey: rendition.blobKey,
      bytes: new Uint8Array(rendition.byteLength).fill(1),
      aad: rendition.blobKey,
    });
  }
  await attachments.repository.save(photo);

  const transfer = createFamilyPhotoTransferRuntime({ createJobId: (seed) => seed });
  transfer.setSession({
    familySyncConfigured: true,
    activeFamilyId: 'fam_1',
    appUserId: 'user_1',
  });
  transfer.enqueueLocalUploads([photo]);
  assert.ok(transfer.getJobs().length > 0);

  const deleted = await softDeletePhotoAttachment({
    attachmentId: photo.attachmentId,
    attachments,
    nowMs: 1_000,
    transferJobs: transfer.getJobs(),
    replaceTransferJobs: (next) => transfer.replaceJobs(next),
  });
  assert.ok(deleted);
  assert.equal(deleted!.attachment.deletedAtMs, 1_000);
  assert.equal(deleted!.attachment.retainUntilMs, 1_000 + ATTACHMENT_TRASH_RETENTION_MS);
  assert.equal(deleted!.metadataOutbox.commandType, 'attachment.tombstone');
  assert.equal(await attachments.blobs.hasDurable(photo.renditions[0]!.blobKey), true);
  assert.equal(
    (await attachments.repository.listAll()).some((row) => row.attachmentId === photo.attachmentId),
    false,
  );
  assert.equal((await attachments.repository.listSoftDeleted()).length, 1);
  assert.ok(deleted!.cancelledJobIds.length > 0);
  assert.equal(
    transfer.getJobs().every((job) => job.state === 'cancelled' || job.state === 'succeeded'),
    true,
  );
});

test('restore works inside trash window and fails after retention', async () => {
  const attachments = services();
  const photo = row();
  await attachments.repository.save(photo);
  await softDeletePhotoAttachment({
    attachmentId: photo.attachmentId,
    attachments,
    nowMs: 5_000,
  });

  const restored = await restorePhotoAttachment({
    attachmentId: photo.attachmentId,
    attachments,
    nowMs: 5_000 + 1_000,
  });
  assert.equal(restored.ok, true);
  if (!restored.ok) return;
  assert.equal(restored.attachment.deletedAtMs, null);
  assert.equal((await attachments.repository.listAll()).length, 1);

  await softDeletePhotoAttachment({
    attachmentId: photo.attachmentId,
    attachments,
    nowMs: 10_000,
  });
  const expired = await restorePhotoAttachment({
    attachmentId: photo.attachmentId,
    attachments,
    nowMs: 10_000 + ATTACHMENT_TRASH_RETENTION_MS,
  });
  assert.equal(expired.ok, false);
  if (!expired.ok) assert.equal(expired.reason, 'retention_expired');
});

test('purge after retention removes sealed bytes but keeps metadata tombstone', async () => {
  const attachments = services();
  const photo = row();
  for (const rendition of photo.renditions) {
    await attachments.blobs.writeDurable({
      blobKey: rendition.blobKey,
      bytes: new Uint8Array(rendition.byteLength).fill(2),
      aad: rendition.blobKey,
    });
  }
  await attachments.repository.save(photo);
  const deletedAtMs = 20_000;
  await softDeletePhotoAttachment({
    attachmentId: photo.attachmentId,
    attachments,
    nowMs: deletedAtMs,
  });

  const tooEarly = await purgeExpiredPhotoPayloads({
    attachments,
    nowMs: deletedAtMs + ATTACHMENT_TRASH_RETENTION_MS - 1,
  });
  assert.equal(tooEarly.purgedAttachmentIds.length, 0);
  assert.equal(await attachments.blobs.hasDurable(photo.renditions[0]!.blobKey), true);

  const purged = await purgeExpiredPhotoPayloads({
    attachments,
    nowMs: deletedAtMs + ATTACHMENT_TRASH_RETENTION_MS + 1,
  });
  assert.deepEqual(purged.purgedAttachmentIds, [photo.attachmentId]);
  assert.equal(await attachments.blobs.hasDurable(photo.renditions[0]!.blobKey), false);
  const tombstone = await attachments.repository.getById(photo.attachmentId);
  assert.ok(tombstone?.deletedAtMs != null);
  assert.equal(
    tombstone?.renditions.every((row) => row.availability === 'missing'),
    true,
  );
});

test('cancelTransferJobsForAttachment leaves succeeded jobs alone', () => {
  const result = cancelTransferJobsForAttachment(
    [
      {
        jobId: 'q1',
        familyId: 'f1',
        attachmentId: 'att_soft',
        renditionId: 'r1',
        role: 'display',
        kind: 'upload',
        sha256: 'a'.repeat(64),
        byteLength: 1,
        state: 'queued',
        attemptCount: 0,
        lastErrorCode: null,
      },
      {
        jobId: 's1',
        familyId: 'f1',
        attachmentId: 'att_soft',
        renditionId: 'r2',
        role: 'thumbnail',
        kind: 'upload',
        sha256: 'b'.repeat(64),
        byteLength: 1,
        state: 'succeeded',
        attemptCount: 1,
        lastErrorCode: null,
      },
    ],
    'att_soft',
  );
  assert.deepEqual(result.cancelledJobIds, ['q1']);
  assert.equal(result.jobs[0]?.state, 'cancelled');
  assert.equal(result.jobs[1]?.state, 'succeeded');
});
