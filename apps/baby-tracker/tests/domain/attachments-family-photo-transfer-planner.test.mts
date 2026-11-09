import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ATTACHMENT_LIMITS,
  asAttachmentId,
  asChildId,
  asEntityId,
  asRenditionId,
  buildAttachmentMetadataOutboxPayload,
  cancelTransferJob,
  isolateTransfersOnSessionChange,
  labelForAttachmentTransfer,
  planDownloadJobsForRemoteMetadata,
  planUploadJobsForLocalAttachments,
  selectTransferJobsToStart,
  shouldEnqueueFamilyPhotoTransfers,
  type FamilyPhotoBlobTransferJob,
  type PhotoAttachment,
} from '../../src/domain/index.ts';

function durableAttachment(id: string): PhotoAttachment {
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
    localOrigin: 'imported',
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
        blobKey: `blob_${id}_d`,
        availability: 'durable',
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
        availability: 'durable',
      },
    ],
  };
}

test('personal mode never enqueues family photo transfers', () => {
  assert.equal(
    shouldEnqueueFamilyPhotoTransfers({
      familySyncConfigured: false,
      activeFamilyId: null,
      appUserId: null,
    }),
    false,
  );
  const jobs = planUploadJobsForLocalAttachments({
    session: {
      familySyncConfigured: false,
      activeFamilyId: null,
      appUserId: null,
    },
    attachments: [durableAttachment('a1')],
    existingJobs: [],
    createJobId: (seed) => seed,
  });
  assert.equal(jobs.length, 0);
});

test('metadata outbox payload never includes JPEG bytes', () => {
  const built = buildAttachmentMetadataOutboxPayload({
    attachment: durableAttachment('a1'),
  });
  assert.equal(built.commandType, 'attachment.upsert');
  assert.equal(built.payload.renditions.length, 2);
  assert.equal('bytes' in built.payload, false);
  for (const row of built.payload.renditions) {
    assert.equal('bytes' in row, false);
    assert.equal(row.sha256.length, 64);
  }
});

test('transfer queue starts at most two jobs and holds quota-blocked uploads', () => {
  const session = {
    familySyncConfigured: true,
    activeFamilyId: 'fam_1',
    appUserId: 'user_1',
  };
  const created = planUploadJobsForLocalAttachments({
    session,
    attachments: [durableAttachment('a1'), durableAttachment('a2'), durableAttachment('a3')],
    existingJobs: [],
    createJobId: (seed) => seed,
  });
  assert.equal(created.length, 6);

  const planned = selectTransferJobsToStart({
    jobs: created,
    quotaBlockedAttachmentIds: new Set(['a2']),
    maxConcurrent: ATTACHMENT_LIMITS.maxConcurrentTransfers,
  });
  assert.equal(planned.startJobIds.length, 2);
  assert.ok(planned.holdAsQuotaWaitingIds.length >= 1);
  assert.equal(
    planned.startJobIds.every((id) => !id.includes('a2')),
    true,
  );
});

test('remote metadata without local bytes creates missing placeholders and downloads', () => {
  const session = {
    familySyncConfigured: true,
    activeFamilyId: 'fam_1',
    appUserId: 'user_1',
  };
  const remote = durableAttachment('remote_1');
  const planned = planDownloadJobsForRemoteMetadata({
    session,
    remoteAttachments: [remote],
    localAttachments: [],
    existingJobs: [],
    createJobId: (seed) => seed,
  });
  assert.equal(planned.placeholders.length, 1);
  assert.equal(
    planned.placeholders[0]!.renditions.every((row) => row.availability === 'missing'),
    true,
  );
  assert.equal(planned.jobs.length, 2);
  assert.equal(
    labelForAttachmentTransfer({
      session,
      attachment: planned.placeholders[0]!,
      jobs: planned.jobs,
      remoteActivated: true,
    }),
    'missing_download',
  );
});

test('session change isolates open transfers without claiming local durable loss', () => {
  const open: FamilyPhotoBlobTransferJob = {
    jobId: 'up_1',
    familyId: 'fam_old',
    attachmentId: 'a1',
    renditionId: 'r1',
    role: 'display',
    kind: 'upload',
    sha256: 'a'.repeat(64),
    byteLength: 10,
    state: 'in_flight',
    attemptCount: 1,
    lastErrorCode: null,
  };
  const isolated = isolateTransfersOnSessionChange({
    jobs: [open],
    previousFamilyId: 'fam_old',
    nextSession: {
      familySyncConfigured: false,
      activeFamilyId: null,
      appUserId: null,
    },
  });
  assert.equal(isolated.preservedLocalDurable, true);
  assert.equal(isolated.jobs[0]!.state, 'isolated');

  const cancelled = cancelTransferJob(isolated.jobs, 'up_1');
  assert.equal(cancelled[0]!.state, 'isolated');
  const cancelledOpen = cancelTransferJob([open], 'up_1');
  assert.equal(cancelledOpen[0]!.state, 'cancelled');
});
