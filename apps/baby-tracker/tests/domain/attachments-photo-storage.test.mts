import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from '@noble/hashes/utils.js';
import {
  asAttachmentId,
  asRenditionId,
  buildPhotoStorageInventory,
  presentPhotoStorageSummary,
  withOfflinePinDefault,
  type AttachmentServices,
  type PhotoAttachment,
} from '../../src/domain/attachments/index.ts';
import type { ChildId, EntityId } from '../../src/domain/ids.ts';
import {
  clearRecoverablePhotoCache,
  loadPhotoStorageSnapshot,
  releaseDurableOwnPhotoCopy,
} from '../../src/application/managePhotoStorage.ts';
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

function row(input: {
  id: string;
  origin: 'imported' | 'downloaded';
  availability: 'durable' | 'cache' | 'missing';
  offlinePinned?: boolean;
  bytes?: number;
}): PhotoAttachment {
  const attachmentId = asAttachmentId(input.id);
  const availability = input.availability;
  const byteLength = input.bytes ?? 20;
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
    offlinePinned: input.offlinePinned === true,
    localOrigin: input.origin,
    renditions: [
      {
        renditionId: asRenditionId(`${input.id}_d`),
        attachmentId,
        role: 'display',
        mime: 'image/jpeg',
        width: 8,
        height: 8,
        byteLength,
        sha256: 'a'.repeat(64),
        normalizationVersion: 'v1',
        blobKey:
          availability === 'missing'
            ? `missing:${input.id}_d`
            : `att/${input.id}/display.jpe.sealed`,
        availability,
      },
      {
        renditionId: asRenditionId(`${input.id}_t`),
        attachmentId,
        role: 'thumbnail',
        mime: 'image/jpeg',
        width: 4,
        height: 4,
        byteLength: Math.max(1, Math.floor(byteLength / 4)),
        sha256: 'b'.repeat(64),
        normalizationVersion: 'v1',
        blobKey:
          availability === 'missing' ? `missing:${input.id}_t` : `att/${input.id}/thumb.jpe.sealed`,
        availability,
      },
    ],
  };
}

test('inventory separates protected own/pinned bytes from recoverable cache', () => {
  const inventory = buildPhotoStorageInventory({
    attachments: [
      row({ id: 'own', origin: 'imported', availability: 'durable', bytes: 100 }),
      row({
        id: 'pin',
        origin: 'downloaded',
        availability: 'durable',
        offlinePinned: true,
        bytes: 40,
      }),
      row({ id: 'cache', origin: 'downloaded', availability: 'cache', bytes: 25 }),
    ],
    nowMs: 10,
  });
  assert.equal(inventory.protectedBytes, 100 + 25 + 40 + 10);
  assert.equal(inventory.cacheBytes, 25 + 6);
  assert.equal(inventory.cacheCopyCount, 2);
  assert.equal(inventory.protectedCopyCount, 4);
  const labels = presentPhotoStorageSummary(inventory);
  assert.match(labels.protectedLabel, /Trvalé \/ připnuté/);
  assert.match(labels.cacheLabel, /Obnovitelná cache/);
});

test('clearRecoverablePhotoCache deletes only cache sealed bytes', async () => {
  const attachments = services();
  const own = row({ id: 'own', origin: 'imported', availability: 'durable', bytes: 30 });
  const pinned = row({
    id: 'pin',
    origin: 'downloaded',
    availability: 'durable',
    offlinePinned: true,
    bytes: 40,
  });
  const cached = row({ id: 'cache', origin: 'downloaded', availability: 'cache', bytes: 50 });

  for (const attachment of [own, pinned, cached]) {
    for (const rendition of attachment.renditions) {
      if (rendition.availability === 'missing') continue;
      await attachments.blobs.writeDurable({
        blobKey: rendition.blobKey,
        bytes: new Uint8Array(rendition.byteLength).fill(7),
        aad: rendition.blobKey,
      });
    }
    await attachments.repository.save(attachment);
  }

  const result = await clearRecoverablePhotoCache({ attachments, nowMs: 5 });
  assert.equal(result.clearedBlobCount, 2);
  assert.equal(result.inventory.cacheCopyCount, 0);
  assert.equal(await attachments.blobs.hasDurable(own.renditions[0]!.blobKey), true);
  assert.equal(await attachments.blobs.hasDurable(pinned.renditions[0]!.blobKey), true);
  assert.equal(await attachments.blobs.hasDurable(cached.renditions[0]!.blobKey), false);

  const afterCache = await attachments.repository.getById(cached.attachmentId);
  assert.equal(
    afterCache?.renditions.every((r) => r.availability === 'missing'),
    true,
  );
  const afterOwn = await attachments.repository.getById(own.attachmentId);
  assert.equal(
    afterOwn?.renditions.every((r) => r.availability === 'durable'),
    true,
  );
});

test('releaseDurableOwnPhotoCopy requires remote proof and backup confirmation', async () => {
  const attachments = services();
  const own = row({ id: 'sole', origin: 'imported', availability: 'durable', bytes: 16 });
  for (const rendition of own.renditions) {
    await attachments.blobs.writeDurable({
      blobKey: rendition.blobKey,
      bytes: new Uint8Array(rendition.byteLength).fill(3),
      aad: rendition.blobKey,
    });
  }
  await attachments.repository.save(own);

  const denied = await releaseDurableOwnPhotoCopy({
    attachmentId: own.attachmentId,
    attachments,
    remoteCopyVerified: false,
    independentBackupConfirmed: true,
    completePortableArchiveVerified: false,
    userConfirmedOfflineLoss: true,
  });
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.reason, 'remote_unverified');
  assert.equal(await attachments.blobs.hasDurable(own.renditions[0]!.blobKey), true);

  const allowed = await releaseDurableOwnPhotoCopy({
    attachmentId: own.attachmentId,
    attachments,
    remoteCopyVerified: true,
    independentBackupConfirmed: true,
    completePortableArchiveVerified: false,
    userConfirmedOfflineLoss: true,
  });
  assert.equal(allowed.ok, true);
  if (!allowed.ok) return;
  assert.equal(allowed.releasedBlobCount, 2);
  assert.equal(await attachments.blobs.hasDurable(own.renditions[0]!.blobKey), false);
  assert.equal(
    allowed.attachment.renditions.every((r) => r.availability === 'missing'),
    true,
  );
});

test('downloaded family rows cannot use the sole-own release path', async () => {
  const attachments = services();
  const downloaded = row({
    id: 'dl',
    origin: 'downloaded',
    availability: 'durable',
    bytes: 12,
  });
  await attachments.repository.save(downloaded);
  const result = await releaseDurableOwnPhotoCopy({
    attachmentId: downloaded.attachmentId,
    attachments,
    remoteCopyVerified: true,
    independentBackupConfirmed: true,
    completePortableArchiveVerified: false,
    userConfirmedOfflineLoss: true,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'not_own_import');
});

test('loadPhotoStorageSnapshot works with empty personal inventory', async () => {
  const attachments = services();
  const snapshot = await loadPhotoStorageSnapshot({ attachments });
  assert.equal(snapshot.inventory.cacheBytes, 0);
  assert.equal(snapshot.inventory.protectedBytes, 0);
});

test('legacy rows without localOrigin normalize to imported', () => {
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
  assert.equal(legacy.localOrigin, 'imported');
  assert.equal(legacy.offlinePinned, false);
});
