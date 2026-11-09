import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from '@noble/hashes/utils.js';
import {
  asAttachmentId,
  asRenditionId,
  classifyLocalPhotoCopyKind,
  planOfflinePinChange,
  presentOfflinePinReadiness,
  summarizeProtectedOfflineBytes,
  withOfflinePinDefault,
  type AttachmentServices,
  type PhotoAttachment,
} from '../../src/domain/attachments/index.ts';
import type { ChildId, EntityId } from '../../src/domain/ids.ts';
import { createFamilyPhotoTransferRuntime } from '../../src/application/familyPhotoTransferRuntime.ts';
import { setAttachmentOfflinePin } from '../../src/application/keepAttachmentOffline.ts';
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

function attachment(input?: {
  availability?: 'durable' | 'cache' | 'missing';
  offlinePinned?: boolean;
}): PhotoAttachment {
  const attachmentId = asAttachmentId('att_pin');
  const availability = input?.availability ?? 'missing';
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
    offlinePinned: input?.offlinePinned === true,
    localOrigin: 'imported',
    renditions: [
      {
        renditionId: asRenditionId('rend_display'),
        attachmentId,
        role: 'display',
        mime: 'image/jpeg',
        width: 8,
        height: 8,
        byteLength: 10,
        sha256: 'a'.repeat(64),
        normalizationVersion: 'v1',
        blobKey:
          availability === 'missing'
            ? 'missing:rend_display'
            : 'att/att_pin/display.jpe.sealed',
        availability,
      },
      {
        renditionId: asRenditionId('rend_thumb'),
        attachmentId,
        role: 'thumbnail',
        mime: 'image/jpeg',
        width: 4,
        height: 4,
        byteLength: 4,
        sha256: 'b'.repeat(64),
        normalizationVersion: 'v1',
        blobKey:
          availability === 'missing'
            ? 'missing:rend_thumb'
            : 'att/att_pin/thumb.jpe.sealed',
        availability,
      },
    ],
  };
}

test('pin readiness requires durable display bytes, not just the toggle', () => {
  assert.equal(
    presentOfflinePinReadiness({
      offlinePinned: true,
      hasDurableDisplay: false,
      downloadInFlightOrQueued: true,
    }).kind,
    'pending',
  );
  assert.equal(
    presentOfflinePinReadiness({
      offlinePinned: true,
      hasDurableDisplay: true,
      downloadInFlightOrQueued: false,
    }).kind,
    'ready',
  );
  assert.equal(
    presentOfflinePinReadiness({
      offlinePinned: false,
      hasDurableDisplay: true,
      downloadInFlightOrQueued: false,
    }).kind,
    'unpinned',
  );
});

test('pinning promotes cache copies to durable and requests missing downloads', () => {
  const cached = attachment({ availability: 'cache' });
  const promoted = planOfflinePinChange({
    attachment: cached,
    pinned: true,
    existingJobs: [],
  });
  assert.equal(promoted.attachment.offlinePinned, true);
  assert.equal(promoted.needsDisplayDownload, false);
  assert.equal(
    promoted.attachment.renditions.every((row) => row.availability === 'durable'),
    true,
  );
  assert.equal(promoted.readiness.kind, 'ready');

  const missing = planOfflinePinChange({
    attachment: attachment({ availability: 'missing' }),
    pinned: true,
    existingJobs: [],
  });
  assert.equal(missing.needsDisplayDownload, true);
  assert.equal(missing.needsThumbnailDownload, true);
  assert.equal(missing.readiness.kind, 'pending');
});

test('pinned copies stay outside LRU cache budget classification', () => {
  assert.equal(
    classifyLocalPhotoCopyKind({
      offlinePinned: true,
      ownImport: false,
      uploadPending: false,
      availability: 'durable',
    }),
    'pinned',
  );
  assert.equal(
    classifyLocalPhotoCopyKind({
      offlinePinned: false,
      ownImport: false,
      uploadPending: false,
      availability: 'durable',
    }),
    'cache',
  );
  const summary = summarizeProtectedOfflineBytes([
    { blobKey: 'p', kind: 'pinned', byteLength: 40, lastAccessMs: 1 },
    { blobKey: 'c', kind: 'cache', byteLength: 10, lastAccessMs: 2 },
  ]);
  assert.equal(summary.protectedBytes, 40);
  assert.equal(summary.cacheBytes, 10);
});

test('setAttachmentOfflinePin queues downloads when family transfer is active', async () => {
  const attachments = services();
  const transfer = createFamilyPhotoTransferRuntime({ createJobId: (seed) => seed });
  transfer.setSession({
    familySyncConfigured: true,
    activeFamilyId: 'fam_1',
    appUserId: 'user_1',
  });
  const row = attachment({ availability: 'missing' });
  await attachments.repository.save(row);

  const pinned = await setAttachmentOfflinePin({
    attachmentId: row.attachmentId,
    pinned: true,
    attachments,
    transfer,
  });
  assert.ok(pinned);
  assert.equal(pinned!.attachment.offlinePinned, true);
  assert.equal(pinned!.downloadJobsQueued, 2);
  assert.equal(pinned!.readiness.kind, 'pending');
  assert.equal(transfer.getJobs().length, 2);

  const unpinned = await setAttachmentOfflinePin({
    attachmentId: row.attachmentId,
    pinned: false,
    attachments,
    transfer,
  });
  assert.ok(unpinned);
  assert.equal(unpinned!.attachment.offlinePinned, false);
  // Unpin clears intent only — download jobs may still exist until cancel/cleanup.
  const saved = await attachments.repository.getById(row.attachmentId);
  assert.equal(saved?.offlinePinned, false);
});

test('legacy rows without offlinePinned normalize to unpinned', () => {
  const legacy = withOfflinePinDefault({
    attachmentId: asAttachmentId('legacy'),
    childId: 'child_1' as ChildId,
    eventId: 'event_1' as EntityId,
    hostEventType: 'note',
    orderIndex: 0,
    caption: null,
    recordedBy: null,
    createdAtMs: 1,
    deletedAtMs: null,
    retainUntilMs: null,
    renditions: [],
  });
  assert.equal(legacy.offlinePinned, false);
  assert.equal(legacy.localOrigin, 'imported');
});
