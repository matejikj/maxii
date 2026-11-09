import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  asAttachmentId,
  asRenditionId,
  type PhotoAttachment,
} from '../../src/domain/attachments/types.ts';
import { createFamilyPhotoTransferSessionBinding } from '../../src/application/bindFamilyPhotoTransferSession.ts';
import {
  createFamilyPhotoTransferLoop,
  runFamilyPhotoTransferTickWithStore,
} from '../../src/application/familyPhotoTransferLoop.ts';
import { createMemoryAttachmentRepository } from '../../src/infrastructure/attachments/memoryAttachmentRepository.ts';
import { createMemoryPrivateAttachmentStore } from '../../src/infrastructure/attachments/memoryPrivateAttachmentStore.ts';
import { createSyntheticPhotoProcessor } from '../../src/infrastructure/attachments/syntheticPhotoProcessor.ts';
import type { AttachmentServices } from '../../src/domain/attachments/ports.ts';
import type { ChildId, EntityId } from '../../src/domain/ids.ts';
import { randomBytes } from '@noble/hashes/utils.js';

function createLoopAttachmentServices(): AttachmentServices {
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

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function sampleAttachment(bytes: Uint8Array): PhotoAttachment {
  const attachmentId = asAttachmentId('att_loop_1');
  const blobKey = `att/${attachmentId}/display.jpe.sealed`;
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
    renditions: [
      {
        renditionId: asRenditionId('rend_display'),
        attachmentId,
        role: 'display',
        mime: 'image/jpeg',
        width: 8,
        height: 8,
        byteLength: bytes.byteLength,
        sha256: sha256Hex(bytes),
        normalizationVersion: 'test-v1',
        blobKey,
        availability: 'durable',
      },
    ],
  };
}

test('photo transfer loop stays cold without sync session and never opens the API', async () => {
  const attachments = createLoopAttachmentServices();
  const binding = createFamilyPhotoTransferSessionBinding({
    boundary: {
      apiBaseUrl: null,
      syncConfigured: false,
    },
  });
  const loop = createFamilyPhotoTransferLoop({
    runtime: binding.runtime,
    attachments,
    setIntervalFn: (() => 1) as unknown as typeof setInterval,
    clearIntervalFn: () => undefined,
  });

  const bytes = new Uint8Array([1, 2, 3, 4]);
  const attachment = sampleAttachment(bytes);
  await attachments.blobs.writeDurable({
    blobKey: attachment.renditions[0]!.blobKey,
    bytes,
    aad: attachment.renditions[0]!.blobKey,
  });
  await attachments.repository.save(attachment);
  binding.runtime.enqueueLocalUploads([attachment]);

  const result = await loop.runOnce();
  assert.equal(result.personalCold, true);
  assert.equal(result.started, 0);
  assert.equal(binding.runtime.getJobs().length, 0);
});

test('photo transfer tick uploads sealed local bytes when family session is active', async () => {
  const attachments = createLoopAttachmentServices();
  const calls: string[] = [];
  const binding = createFamilyPhotoTransferSessionBinding({
    boundary: {
      apiBaseUrl: 'https://api.example.test',
      syncConfigured: true,
    },
    fetchImpl: async (url, init) => {
      const path = String(url);
      calls.push(`${init?.method ?? 'GET'} ${path}`);
      if (path.endsWith('/attachments/intents') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            intentId: 'intent_1',
            objectKey: 'obj_1',
            expiresAt: '2099-01-01T00:00:00.000Z',
            reservedBytes: 4,
          }),
          { status: 200 },
        );
      }
      if (path.includes('/attachments/intents/intent_1') && init?.method === 'PUT') {
        return new Response(null, { status: 200 });
      }
      if (path.endsWith('/finalize') && init?.method === 'POST') {
        return new Response(JSON.stringify({ activated: true }), { status: 200 });
      }
      return new Response('missing', { status: 404 });
    },
  });

  binding.bindAuthSession({
    appUserId: 'user_1',
    accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
    transport: 'bearer',
    accessToken: 'tok',
    csrfToken: null,
  });
  binding.bindActiveFamily('fam_1');

  const bytes = new Uint8Array([9, 8, 7, 6]);
  const attachment = sampleAttachment(bytes);
  await attachments.blobs.writeDurable({
    blobKey: attachment.renditions[0]!.blobKey,
    bytes,
    aad: attachment.renditions[0]!.blobKey,
  });
  await attachments.repository.save(attachment);
  binding.runtime.enqueueLocalUploads([attachment]);
  assert.equal(binding.runtime.getJobs().length, 1);

  const result = await runFamilyPhotoTransferTickWithStore({
    runtime: binding.runtime,
    attachments,
  });
  assert.equal(result.personalCold, false);
  assert.equal(result.started, 1);
  assert.equal(result.succeeded, 1);
  assert.equal(binding.runtime.getJobs()[0]?.state, 'succeeded');
  assert.ok(calls.some((item) => item.startsWith('POST ') && item.includes('/intents')));
  assert.ok(calls.some((item) => item.startsWith('PUT ')));
  assert.ok(calls.some((item) => item.includes('/finalize')));
});

test('transfer loop start schedules ticks and stop clears the timer', async () => {
  const attachments = createLoopAttachmentServices();
  const binding = createFamilyPhotoTransferSessionBinding({
    boundary: { apiBaseUrl: null, syncConfigured: false },
  });
  let scheduled = 0;
  let cleared = 0;
  const loop = createFamilyPhotoTransferLoop({
    runtime: binding.runtime,
    attachments,
    setIntervalFn: ((fn: () => void, _ms: number) => {
      scheduled += 1;
      fn();
      return 42 as unknown as ReturnType<typeof setInterval>;
    }) as typeof setInterval,
    clearIntervalFn: (() => {
      cleared += 1;
    }) as typeof clearInterval,
  });

  loop.start(1_000);
  assert.equal(loop.isRunning(), true);
  assert.equal(scheduled, 1);
  // Second start is idempotent.
  loop.start(1_000);
  assert.equal(scheduled, 1);
  loop.stop();
  assert.equal(loop.isRunning(), false);
  assert.equal(cleared, 1);
});
