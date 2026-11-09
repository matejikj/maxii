import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from '@noble/hashes/utils.js';
import {
  asAttachmentId,
  asRenditionId,
  type AttachmentServices,
  type PhotoAttachment,
} from '../../src/domain/attachments/index.ts';
import type { ChildId, EntityId } from '../../src/domain/ids.ts';
import { createEmptySyncState } from '../../src/domain/sync/transport.ts';
import { createFamilyPhotoTransferRuntime } from '../../src/application/familyPhotoTransferRuntime.ts';
import {
  applyRemoteAttachmentMetadata,
  attachmentEntriesFromSyncInbox,
} from '../../src/application/applyRemoteAttachmentMetadata.ts';
import { runFamilySyncTickWithAttachments } from '../../src/application/runFamilySyncTickWithAttachments.ts';
import { createMemoryAttachmentRepository } from '../../src/infrastructure/attachments/memoryAttachmentRepository.ts';
import { createMemoryPrivateAttachmentStore } from '../../src/infrastructure/attachments/memoryPrivateAttachmentStore.ts';
import { createSyntheticPhotoProcessor } from '../../src/infrastructure/attachments/syntheticPhotoProcessor.ts';

function services(): AttachmentServices {
  const key = randomBytes(32);
  return {
    picker: { async pickPhotos() { return { status: 'cancelled' }; } },
    processor: createSyntheticPhotoProcessor(),
    blobs: createMemoryPrivateAttachmentStore({ key }),
    repository: createMemoryAttachmentRepository(),
  };
}

function remotePayload(id: string): Record<string, unknown> {
  return {
    attachmentId: id,
    childId: 'child_1',
    eventId: 'event_1',
    hostEventType: 'note',
    orderIndex: 0,
    caption: null,
    deletedAt: null,
    eraseGeneration: null,
    renditions: [
      {
        renditionId: 'rend_display',
        role: 'display',
        mime: 'image/jpeg',
        width: 10,
        height: 10,
        byteLength: 12,
        sha256: 'a'.repeat(64),
        normalizationVersion: 'v1',
      },
      {
        renditionId: 'rend_thumb',
        role: 'thumbnail',
        mime: 'image/jpeg',
        width: 4,
        height: 4,
        byteLength: 4,
        sha256: 'b'.repeat(64),
        normalizationVersion: 'v1',
      },
    ],
  };
}

test('sync inbox mapper keeps only attachment upsert/tombstone kinds', () => {
  const mapped = attachmentEntriesFromSyncInbox([
    { kind: 'care.record', payload: { x: 1 } },
    { kind: 'attachment.upsert', payload: remotePayload('a1') },
    { kind: 'attachment.tombstone', payload: remotePayload('a2') },
  ]);
  assert.equal(mapped.length, 2);
  assert.equal(mapped[0]?.kind, 'attachment.upsert');
  assert.equal(mapped[1]?.kind, 'attachment.tombstone');
});

test('remote metadata upsert saves missing placeholders and queues downloads', async () => {
  const attachments = services();
  const transfer = createFamilyPhotoTransferRuntime();
  transfer.setSession({
    familySyncConfigured: true,
    activeFamilyId: 'fam_1',
    appUserId: 'user_1',
  });

  const result = await applyRemoteAttachmentMetadata({
    entries: [{ kind: 'attachment.upsert', payload: remotePayload('att_remote') }],
    attachments,
    transfer,
    nowMs: 1_000,
  });

  assert.equal(result.personalCold, false);
  assert.equal(result.appliedUpserts, 1);
  assert.equal(result.downloadJobsQueued, 2);
  assert.equal(result.placeholdersSaved, 1);

  const saved = await attachments.repository.getById(asAttachmentId('att_remote'));
  assert.ok(saved);
  assert.equal(saved!.renditions.every((row) => row.availability === 'missing'), true);
  assert.equal(transfer.getJobs().length, 2);
  assert.equal(transfer.getJobs().every((job) => job.kind === 'download'), true);
  assert.equal(
    transfer.labelFor({ attachment: saved!, remoteActivated: true }),
    'missing_download',
  );
});

test('personal cold session does not apply remote attachment metadata', async () => {
  const attachments = services();
  const transfer = createFamilyPhotoTransferRuntime();
  const result = await applyRemoteAttachmentMetadata({
    entries: [{ kind: 'attachment.upsert', payload: remotePayload('att_cold') }],
    attachments,
    transfer,
    nowMs: 1_000,
  });
  assert.equal(result.personalCold, true);
  assert.equal(result.appliedUpserts, 0);
  assert.equal(await attachments.repository.getById(asAttachmentId('att_cold')), null);
  assert.equal(transfer.getJobs().length, 0);
});

test('tombstone soft-deletes and cancels open download jobs; erase blocks resurrection', async () => {
  const attachments = services();
  const transfer = createFamilyPhotoTransferRuntime({
    createJobId: (seed) => seed,
  });
  transfer.setSession({
    familySyncConfigured: true,
    activeFamilyId: 'fam_1',
    appUserId: 'user_1',
  });

  await applyRemoteAttachmentMetadata({
    entries: [{ kind: 'attachment.upsert', payload: remotePayload('att_del') }],
    attachments,
    transfer,
    nowMs: 1_000,
  });
  assert.equal(transfer.getJobs().length, 2);

  const tombstoned = await applyRemoteAttachmentMetadata({
    entries: [
      {
        kind: 'attachment.tombstone',
        payload: {
          ...remotePayload('att_del'),
          deletedAt: '2026-11-09T12:00:00.000Z',
          eraseGeneration: 2,
        },
      },
    ],
    attachments,
    transfer,
    nowMs: 2_000,
  });
  assert.equal(tombstoned.appliedTombstones, 1);
  const deleted = await attachments.repository.getById(asAttachmentId('att_del'));
  assert.ok(deleted?.deletedAtMs != null);
  assert.equal(
    transfer.getJobs().every((job) => job.state === 'cancelled' || job.state === 'isolated'),
    true,
  );

  const blocked = await applyRemoteAttachmentMetadata({
    entries: [{ kind: 'attachment.upsert', payload: remotePayload('att_del') }],
    attachments,
    transfer,
    nowMs: 3_000,
    erasedAttachmentIds: new Set(['att_del']),
  });
  assert.equal(blocked.appliedUpserts, 0);
  const after = await attachments.repository.getById(asAttachmentId('att_del'));
  assert.ok(after?.deletedAtMs != null);
});

test('family sync tick applies fresh attachment inbox entries into download jobs', async () => {
  const attachments = services();
  const transfer = createFamilyPhotoTransferRuntime({
    createJobId: (seed) => seed,
  });
  transfer.setSession({
    familySyncConfigured: true,
    activeFamilyId: 'fam_1',
    appUserId: 'user_1',
  });

  let kicked = 0;
  const result = await runFamilySyncTickWithAttachments({
    state: createEmptySyncState(),
    familyId: 'fam_1',
    attemptId: 'attempt_1',
    nowIso: '2026-11-09T12:00:00.000Z',
    nowMs: 1_000,
    attachments,
    transfer,
    afterDownloadsQueued: () => {
      kicked += 1;
    },
    transport: {
      push: async () => ({ receipts: [], epoch: 1 }),
      pull: async () => ({
        entries: [
          {
            changelogSeq: 1,
            operationId: 'op_care',
            revisionId: 'rev_care',
            entityId: 'care_1',
            kind: 'care.record',
            payloadHash: 'c'.repeat(64),
            payload: { note: 'text only' },
          },
          {
            changelogSeq: 2,
            operationId: 'op_att',
            revisionId: 'rev_att',
            entityId: 'att_inbox',
            kind: 'attachment.upsert',
            payloadHash: 'd'.repeat(64),
            payload: remotePayload('att_inbox'),
          },
        ],
        nextCursor: 'cursor-2',
        epoch: 1,
        resyncRequired: false,
      }),
    },
  });

  assert.equal(result.sync.pulled, 2);
  assert.equal(result.attachments.appliedUpserts, 1);
  assert.equal(result.attachments.downloadJobsQueued, 2);
  assert.equal(kicked, 1);
  const saved = await attachments.repository.getById(asAttachmentId('att_inbox'));
  assert.equal(saved?.renditions[0]?.availability, 'missing');
});

test('local durable bytes are kept when remote metadata arrives again', async () => {
  const attachments = services();
  const transfer = createFamilyPhotoTransferRuntime();
  transfer.setSession({
    familySyncConfigured: true,
    activeFamilyId: 'fam_1',
    appUserId: 'user_1',
  });

  const local: PhotoAttachment = {
    attachmentId: asAttachmentId('att_keep'),
    childId: 'child_1' as ChildId,
    eventId: 'event_1' as EntityId,
    hostEventType: 'note',
    orderIndex: 0,
    caption: 'mine',
    recordedBy: null,
    createdAtMs: 1,
    deletedAtMs: null,
    retainUntilMs: null,
    offlinePinned: false,
    renditions: [
      {
        renditionId: asRenditionId('rend_display'),
        attachmentId: asAttachmentId('att_keep'),
        role: 'display',
        mime: 'image/jpeg',
        width: 10,
        height: 10,
        byteLength: 12,
        sha256: 'a'.repeat(64),
        normalizationVersion: 'v1',
        blobKey: 'att/att_keep/display.jpe.sealed',
        availability: 'durable',
      },
      {
        renditionId: asRenditionId('rend_thumb'),
        attachmentId: asAttachmentId('att_keep'),
        role: 'thumbnail',
        mime: 'image/jpeg',
        width: 4,
        height: 4,
        byteLength: 4,
        sha256: 'b'.repeat(64),
        normalizationVersion: 'v1',
        blobKey: 'att/att_keep/thumb.jpe.sealed',
        availability: 'durable',
      },
    ],
  };
  await attachments.repository.save(local);

  const result = await applyRemoteAttachmentMetadata({
    entries: [{ kind: 'attachment.upsert', payload: remotePayload('att_keep') }],
    attachments,
    transfer,
    nowMs: 5_000,
  });
  assert.equal(result.downloadJobsQueued, 0);
  const saved = await attachments.repository.getById(asAttachmentId('att_keep'));
  assert.equal(saved?.renditions[0]?.availability, 'durable');
  assert.equal(saved?.renditions[0]?.blobKey, 'att/att_keep/display.jpe.sealed');
});
