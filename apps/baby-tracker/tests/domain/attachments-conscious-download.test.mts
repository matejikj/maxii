import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from '@noble/hashes/utils.js';
import {
  ATTACHMENT_LIMITS,
  asAttachmentId,
  asChildId,
  asEntityId,
  asRenditionId,
  attachmentNeedsConsciousDisplayDownload,
  planConsciousDisplayDownload,
  type PhotoAttachment,
} from '../../src/domain/index.ts';
import { createFamilyPhotoTransferRuntime } from '../../src/application/familyPhotoTransferRuntime.ts';
import { requestAttachmentDisplayDownload } from '../../src/application/requestAttachmentDisplayDownload.ts';
import { createMemoryAttachmentRepository } from '../../src/infrastructure/attachments/memoryAttachmentRepository.ts';
import { createMemoryPrivateAttachmentStore } from '../../src/infrastructure/attachments/memoryPrivateAttachmentStore.ts';
import { createSyntheticPhotoProcessor } from '../../src/infrastructure/attachments/syntheticPhotoProcessor.ts';

function missingDisplayAttachment(id: string): PhotoAttachment {
  return {
    attachmentId: asAttachmentId(id),
    childId: asChildId('child_a'),
    eventId: asEntityId('note_1'),
    hostEventType: 'note',
    orderIndex: 0,
    caption: null,
    recordedBy: null,
    createdAtMs: 1,
    deletedAtMs: null,
    retainUntilMs: null,
    offlinePinned: false,
    localOrigin: 'downloaded',
    renditions: [
      {
        renditionId: asRenditionId(`ren_${id}_d`),
        attachmentId: asAttachmentId(id),
        role: 'display',
        mime: 'image/jpeg',
        width: 100,
        height: 80,
        byteLength: 1200,
        sha256: 'a'.repeat(64),
        normalizationVersion: ATTACHMENT_LIMITS.normalizationVersion,
        blobKey: `missing:ren_${id}_d`,
        availability: 'missing',
      },
      {
        renditionId: asRenditionId(`ren_${id}_t`),
        attachmentId: asAttachmentId(id),
        role: 'thumbnail',
        mime: 'image/jpeg',
        width: 40,
        height: 32,
        byteLength: 200,
        sha256: 'b'.repeat(64),
        normalizationVersion: ATTACHMENT_LIMITS.normalizationVersion,
        blobKey: `blob_${id}_t`,
        availability: 'cache',
      },
    ],
  };
}

const familySession = {
  familySyncConfigured: true,
  activeFamilyId: 'fam_1',
  appUserId: 'user_1',
} as const;

test('conscious download needs display when only the full copy is missing', () => {
  const attachment = missingDisplayAttachment('open_1');
  assert.equal(attachmentNeedsConsciousDisplayDownload(attachment), true);
  const planned = planConsciousDisplayDownload({
    session: familySession,
    attachment,
    existingJobs: [],
    createJobId: (seed) => seed,
  });
  assert.equal(planned.outcome, 'queued');
  assert.equal(planned.jobs.length, 1);
  assert.equal(planned.jobs[0]?.role, 'display');
  assert.equal(
    planned.jobs.every((job) => job.role !== 'thumbnail'),
    true,
  );
});

test('personal cold never queues a conscious display download', () => {
  const attachment = missingDisplayAttachment('cold_1');
  const planned = planConsciousDisplayDownload({
    session: {
      familySyncConfigured: false,
      activeFamilyId: null,
      appUserId: null,
    },
    attachment,
    existingJobs: [],
    createJobId: (seed) => seed,
  });
  assert.equal(planned.outcome, 'personal_cold');
  assert.equal(planned.jobs.length, 0);
});

test('requestAttachmentDisplayDownload queues one display job via transfer runtime', async () => {
  const key = randomBytes(32);
  const attachments = {
    picker: {
      async pickPhotos() {
        return { status: 'cancelled' as const };
      },
    },
    processor: createSyntheticPhotoProcessor(),
    blobs: createMemoryPrivateAttachmentStore({ key }),
    repository: createMemoryAttachmentRepository(),
  };
  const transfer = createFamilyPhotoTransferRuntime({ createJobId: (seed) => seed });
  transfer.setSession(familySession);
  const row = missingDisplayAttachment('req_1');
  await attachments.repository.save(row);

  const result = await requestAttachmentDisplayDownload({
    attachmentId: row.attachmentId,
    attachments,
    transfer,
  });
  assert.equal(result.ok, true);
  assert.equal(result.outcome, 'queued');
  assert.equal(result.downloadJobsQueued, 1);
  assert.equal(transfer.getJobs().length, 1);
  assert.equal(transfer.getJobs()[0]?.role, 'display');
  assert.equal(transfer.getJobs()[0]?.attachmentId, 'req_1');
});

test('second conscious request does not duplicate the display job', async () => {
  const key = randomBytes(32);
  const attachments = {
    picker: {
      async pickPhotos() {
        return { status: 'cancelled' as const };
      },
    },
    processor: createSyntheticPhotoProcessor(),
    blobs: createMemoryPrivateAttachmentStore({ key }),
    repository: createMemoryAttachmentRepository(),
  };
  const transfer = createFamilyPhotoTransferRuntime({ createJobId: (seed) => seed });
  transfer.setSession(familySession);
  const row = missingDisplayAttachment('req_2');
  await attachments.repository.save(row);

  await requestAttachmentDisplayDownload({
    attachmentId: row.attachmentId,
    attachments,
    transfer,
  });
  const again = await requestAttachmentDisplayDownload({
    attachmentId: row.attachmentId,
    attachments,
    transfer,
  });
  assert.equal(again.ok, true);
  assert.equal(again.outcome, 'already_queued');
  assert.equal(transfer.getJobs().length, 1);
});
