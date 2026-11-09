import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from '@noble/hashes/utils.js';
import { asChildId, asEntityId } from '../../src/domain/ids.ts';
import {
  ATTACHMENT_LIMITS,
  assertRemainingPhotoSlots,
  buildMinimalJpeg,
  evaluatePhotoInput,
  jpegContainsAsciiCanary,
  localAvailabilityLabel,
  stripJpegMetadata,
} from '../../src/domain/attachments/index.ts';
import { attachPhotosToSavedEvent } from '../../src/application/attachPhotos.ts';
import {
  buildMediaArchiveBundle,
  createMemoryAttachmentRepository,
  createMemoryPrivateAttachmentStore,
  createSyntheticPhotoProcessor,
  openMediaArchiveBundle,
  serializeMediaArchiveBundle,
  parseMediaArchiveBundle,
} from '../../src/infrastructure/attachments/index.ts';

test('photo input rejects unsupported mime and oversize sources offline', () => {
  const unsupported = evaluatePhotoInput({
    sourceUri: 'file://x.svg',
    mime: 'image/svg+xml',
    byteLength: 100,
    width: 10,
    height: 10,
    fileName: 'x.svg',
  });
  assert.equal(unsupported.ok, false);
  if (!unsupported.ok) assert.equal(unsupported.code, 'photo_mime_unsupported');

  const oversize = evaluatePhotoInput({
    sourceUri: 'file://big.jpg',
    mime: 'image/jpeg',
    byteLength: ATTACHMENT_LIMITS.maxSourceBytes + 1,
    width: 100,
    height: 100,
    fileName: 'big.jpg',
  });
  assert.equal(oversize.ok, false);
});

test('JPEG metadata strip removes EXIF GPS canary', () => {
  const withGps = buildMinimalJpeg({ withExifGps: true, comment: 'keep-me' });
  assert.equal(jpegContainsAsciiCanary(withGps, 'GPS:CANARY'), true);
  const stripped = stripJpegMetadata(withGps);
  assert.equal(jpegContainsAsciiCanary(stripped, 'GPS:CANARY'), false);
  assert.equal(jpegContainsAsciiCanary(stripped, 'Exif'), false);
});

test('attachPhotos saves durable local copies and keeps host text independent', async () => {
  const key = randomBytes(32);
  const services = {
    picker: {
      async pickPhotos() {
        return { status: 'cancelled' as const };
      },
    },
    processor: createSyntheticPhotoProcessor(),
    blobs: createMemoryPrivateAttachmentStore({ key }),
    repository: createMemoryAttachmentRepository(),
  };
  const eventId = asEntityId('evt_note_1');
  const childId = asChildId('child_1');
  const result = await attachPhotosToSavedEvent(services, {
    childId,
    eventId,
    hostEventType: 'note',
    nowMs: 1_700_000_000_000,
    createId: (prefix) => `${prefix}_${Math.random().toString(16).slice(2)}`,
    candidates: [
      {
        sourceUri: 'file://one.jpg',
        mime: 'image/jpeg',
        byteLength: 1200,
        width: 1600,
        height: 1200,
        fileName: 'one.jpg',
      },
      {
        sourceUri: 'file://bad.svg',
        mime: 'image/svg+xml',
        byteLength: 40,
        width: 10,
        height: 10,
        fileName: 'bad.svg',
      },
    ],
  });
  assert.equal(result.attached.length, 1);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0]?.code, 'photo_mime_unsupported');
  const stored = await services.repository.listForEvent(eventId);
  assert.equal(stored.length, 1);
  const display = stored[0]!.renditions.find((item) => item.role === 'display')!;
  assert.equal(display.availability, 'durable');
  assert.equal(await services.blobs.hasDurable(display.blobKey), true);
  const bytes = await services.blobs.readDurable({ blobKey: display.blobKey, aad: display.blobKey });
  assert.equal(jpegContainsAsciiCanary(bytes, 'GPS:'), false);
  assert.equal(
    localAvailabilityLabel({ importState: 'linked', hasDurableDisplay: true }),
    'local',
  );
});

test('six-photo slot guard blocks a seventh candidate', () => {
  assert.throws(() => assertRemainingPhotoSlots(6, 1), /maximum of six/i);
  assert.throws(() => assertRemainingPhotoSlots(5, 2), /six photos/i);
  assert.doesNotThrow(() => assertRemainingPhotoSlots(5, 1));
});

test('media archive seals each rendition separately and restores digests', async () => {
  const key = randomBytes(32);
  const services = {
    picker: {
      async pickPhotos() {
        return { status: 'cancelled' as const };
      },
    },
    processor: createSyntheticPhotoProcessor(),
    blobs: createMemoryPrivateAttachmentStore({ key }),
    repository: createMemoryAttachmentRepository(),
  };
  const imported = await attachPhotosToSavedEvent(services, {
    childId: asChildId('child_1'),
    eventId: asEntityId('evt_1'),
    hostEventType: 'milestone',
    nowMs: 1_700_000_000_100,
    createId: (prefix) => `${prefix}_archive`,
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
  assert.equal(imported.attached.length, 1);
  const bundle = await buildMediaArchiveBundle({
    attachments: imported.attached,
    readBlob: (blobKey) => services.blobs.readDurable({ blobKey, aad: blobKey }),
    password: 'recovery-passphrase',
    createdAtMs: 1_700_000_000_200,
    argonParams: { t: 1, m: 8, p: 1, dkLen: 32 },
  });
  assert.ok(Object.keys(bundle.blobs).length >= 2);
  const serialized = serializeMediaArchiveBundle(bundle);
  assert.equal(serialized.includes('CANARY'), false);
  const opened = openMediaArchiveBundle(parseMediaArchiveBundle(serialized), 'recovery-passphrase');
  assert.equal(opened.manifest.attachments.length, 1);
  assert.equal(opened.manifest.attachments[0]?.renditions.length, 2);
});
