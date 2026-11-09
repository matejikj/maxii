import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asAttachmentId,
  asChildId,
  asEntityId,
  asRenditionId,
  detectFamilyPhotoCountConflict,
  presentFamilyPhotoTransferLabel,
  type PhotoAttachment,
} from '../../src/domain/index.ts';

function attachment(id: string): PhotoAttachment {
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
        renditionId: asRenditionId(`ren_${id}`),
        attachmentId: asAttachmentId(id),
        role: 'display',
        mime: 'image/jpeg',
        width: 10,
        height: 10,
        byteLength: 100,
        sha256: 'a'.repeat(64),
        normalizationVersion: 'lumi.photo-normalize.v1',
        blobKey: `blob_${id}`,
        availability: 'durable',
      },
    ],
  };
}

test('personal mode never claims family delivery for local photos', () => {
  assert.equal(
    presentFamilyPhotoTransferLabel({
      familySyncConfigured: false,
      localDurable: true,
      remoteActivated: false,
      uploadPending: true,
      quotaBlocked: false,
      downloadMissing: false,
    }),
    'local_only',
  );
});

test('family transfer labels stay truthful for quota and remote readiness', () => {
  assert.equal(
    presentFamilyPhotoTransferLabel({
      familySyncConfigured: true,
      localDurable: true,
      remoteActivated: false,
      uploadPending: true,
      quotaBlocked: true,
      downloadMissing: false,
    }),
    'quota_waiting',
  );
  assert.equal(
    presentFamilyPhotoTransferLabel({
      familySyncConfigured: true,
      localDurable: true,
      remoteActivated: true,
      uploadPending: false,
      quotaBlocked: false,
      downloadMissing: false,
    }),
    'available_to_family',
  );
});

test('offline photo count conflicts keep both branches when over the event limit', () => {
  const local = [1, 2, 3, 4].map((n) => attachment(`l${n}`));
  const remote = [5, 6, 7].map((n) => attachment(`r${n}`));
  const conflict = detectFamilyPhotoCountConflict({
    localAttachments: local,
    remoteAttachments: remote,
  });
  assert.equal(conflict.conflict, true);
  if (!conflict.conflict) return;
  assert.equal(conflict.kind, 'over_max_photos');
  assert.equal(conflict.total, 7);
});
