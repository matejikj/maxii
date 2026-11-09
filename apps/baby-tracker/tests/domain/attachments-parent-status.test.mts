import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asAttachmentId,
  asChildId,
  asEntityId,
  asRenditionId,
  presentPhotoParentStatus,
  type PhotoAttachment,
} from '../../src/domain/index.ts';
import { createFamilyPhotoTransferRuntime } from '../../src/application/familyPhotoTransferRuntime.ts';
import {
  assessMediaArchiveCompleteness,
  buildMediaArchiveBundle,
} from '../../src/infrastructure/attachments/mediaArchive.ts';
import { createMemoryAttachmentRepository } from '../../src/infrastructure/attachments/memoryAttachmentRepository.ts';
import { createMemoryPrivateAttachmentStore } from '../../src/infrastructure/attachments/memoryPrivateAttachmentStore.ts';
import { createSyntheticPhotoProcessor } from '../../src/infrastructure/attachments/syntheticPhotoProcessor.ts';
import { attachPhotosToSavedEvent } from '../../src/application/attachPhotos.ts';
import { randomBytes } from '@noble/hashes/utils.js';
import type { AttachmentServices } from '../../src/domain/attachments';

function testAttachmentServices(): AttachmentServices {
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

test('parent photo status keeps personal wording and family transfer labels', () => {
  assert.equal(
    presentPhotoParentStatus({ localLabel: 'local', transferLabel: null }),
    'Fotka uložená v zařízení',
  );
  assert.equal(
    presentPhotoParentStatus({ localLabel: 'local', transferLabel: 'waiting_to_send' }),
    'Čeká na odeslání',
  );
  assert.equal(
    presentPhotoParentStatus({ localLabel: 'missing', transferLabel: 'missing_download' }),
    'Fotka není stažená',
  );
  assert.equal(
    presentPhotoParentStatus({ localLabel: 'local', transferLabel: 'available_to_family' }),
    'Dostupná i ostatním',
  );
});

test('photo transfer runtime stays cold in personal mode and enqueues only with family session', () => {
  const runtime = createFamilyPhotoTransferRuntime();
  const attachment: PhotoAttachment = {
    attachmentId: asAttachmentId('a1'),
    childId: asChildId('c1'),
    eventId: asEntityId('e1'),
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
        renditionId: asRenditionId('r1'),
        attachmentId: asAttachmentId('a1'),
        role: 'display',
        mime: 'image/jpeg',
        width: 10,
        height: 10,
        byteLength: 12,
        sha256: 'a'.repeat(64),
        normalizationVersion: 'lumi.photo-normalize.v1',
        blobKey: 'blob',
        availability: 'durable',
      },
    ],
  };
  runtime.enqueueLocalUploads([attachment]);
  assert.equal(runtime.getJobs().length, 0);
  assert.equal(
    runtime.labelFor({ attachment }),
    'local_only',
  );

  runtime.setSession({
    familySyncConfigured: true,
    activeFamilyId: 'fam_1',
    appUserId: 'user_1',
  });
  runtime.enqueueLocalUploads([attachment]);
  assert.equal(runtime.getJobs().length, 1);
  assert.equal(runtime.labelFor({ attachment }), 'waiting_to_send');
});

test('media archive refuses unlabeled incomplete exports and marks completeness', async () => {
  const services = testAttachmentServices();
  const imported = await attachPhotosToSavedEvent(services, {
    childId: asChildId('child_a'),
    eventId: asEntityId('note_1'),
    hostEventType: 'note',
    nowMs: 1,
    createId: (prefix) => `${prefix}_1`,
    candidates: [
      {
        sourceUri: 'file://a.jpg',
        mime: 'image/jpeg',
        byteLength: 900,
        width: 800,
        height: 600,
        fileName: 'a.jpg',
      },
    ],
  });
  const missingSibling: PhotoAttachment = {
    ...imported.attached[0]!,
    attachmentId: asAttachmentId('missing_a'),
    renditions: imported.attached[0]!.renditions.map((row) => ({
      ...row,
      availability: 'missing',
      blobKey: 'missing:key',
    })),
  };

  assert.equal(
    assessMediaArchiveCompleteness([imported.attached[0]!, missingSibling]).complete,
    false,
  );

  await assert.rejects(
    () =>
      buildMediaArchiveBundle({
        attachments: [imported.attached[0]!, missingSibling],
        readBlob: (blobKey) => services.blobs.readDurable({ blobKey, aad: blobKey }),
        password: 'recovery-passphrase',
        createdAtMs: 1,
        argonParams: { t: 1, m: 8, p: 1, dkLen: 32 },
      }),
    /incomplete_photo_export/,
  );

  const partial = await buildMediaArchiveBundle({
    attachments: [imported.attached[0]!, missingSibling],
    readBlob: (blobKey) => services.blobs.readDurable({ blobKey, aad: blobKey }),
    password: 'recovery-passphrase',
    createdAtMs: 1,
    argonParams: { t: 1, m: 8, p: 1, dkLen: 32 },
    allowIncomplete: true,
  });
  assert.equal(partial.completeness.complete, false);
  assert.equal(partial.completeness.label, 'incomplete_photo_export');

  const full = await buildMediaArchiveBundle({
    attachments: imported.attached,
    readBlob: (blobKey) => services.blobs.readDurable({ blobKey, aad: blobKey }),
    password: 'recovery-passphrase',
    createdAtMs: 1,
    argonParams: { t: 1, m: 8, p: 1, dkLen: 32 },
  });
  assert.equal(full.completeness.complete, true);
  assert.equal(full.completeness.label, 'full_photo_backup');
});
