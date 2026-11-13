import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from '@noble/hashes/utils.js';
import {
  ATTACHMENT_LIMITS,
  decidePhotoImportSpaceGate,
  estimateFamilyPhotoCapacityModel,
  estimatePhotoImportReserveBytes,
  estimateWorstCasePhotoImportReserveBytes,
  presentPhotoCapacityModelSummary,
  type AttachmentServices,
  type PickedPhotoCandidate,
} from '../../src/domain/attachments/index.ts';
import type { ChildId, EntityId } from '../../src/domain/ids.ts';
import { attachPhotosToSavedEvent } from '../../src/application/attachPhotos.ts';
import { guardPhotoImportSpace } from '../../src/application/guardPhotoImportSpace.ts';
import { createFixedFreeSpaceProbe } from '../../src/infrastructure/attachments/fixedFreeSpaceProbe.ts';
import { createMemoryAttachmentRepository } from '../../src/infrastructure/attachments/memoryAttachmentRepository.ts';
import { createMemoryPrivateAttachmentStore } from '../../src/infrastructure/attachments/memoryPrivateAttachmentStore.ts';
import { createSyntheticPhotoProcessor } from '../../src/infrastructure/attachments/syntheticPhotoProcessor.ts';

function candidate(bytes: number): PickedPhotoCandidate {
  return {
    sourceUri: `memory://photo-${bytes}`,
    mime: 'image/jpeg',
    byteLength: bytes,
    width: 8,
    height: 8,
    fileName: null,
  };
}

function services(freeBytes: number | null): AttachmentServices {
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
    freeSpace: createFixedFreeSpaceProbe(freeBytes),
  };
}

test('import reserve covers source, both renditions and journal overhead', () => {
  const estimated = estimatePhotoImportReserveBytes({
    sourceByteLengths: [1_000_000, 2_000_000],
  });
  assert.equal(estimated.perPhotoReserveBytes.length, 2);
  assert.ok(estimated.reserveBytes > 1_000_000 + 2_000_000);
  assert.ok(
    estimated.perPhotoReserveBytes[0]! >=
      ATTACHMENT_LIMITS.displayMaxBytes + ATTACHMENT_LIMITS.thumbnailMaxBytes,
  );
  const worst = estimateWorstCasePhotoImportReserveBytes(2);
  assert.ok(worst >= estimated.reserveBytes);
});

test('space gate allows unknown free space and blocks known shortfalls', () => {
  const reserve = estimatePhotoImportReserveBytes({
    sourceByteLengths: [5_000_000],
  });
  assert.equal(
    decidePhotoImportSpaceGate({
      freeBytes: null,
      reserveBytes: reserve.reserveBytes,
      candidateCount: 1,
    }).allow,
    true,
  );
  const denied = decidePhotoImportSpaceGate({
    freeBytes: 1_000,
    reserveBytes: reserve.reserveBytes,
    candidateCount: 1,
    perPhotoReserveBytes: reserve.perPhotoReserveBytes,
    recoverableCacheBytes: 50_000,
  });
  assert.equal(denied.allow, false);
  if (denied.allow) return;
  assert.equal(denied.reason, 'insufficient_space');
  assert.ok(
    denied.suggest === 'clear_cache' ||
      denied.suggest === 'both' ||
      denied.suggest === 'smaller_selection',
  );
  assert.match(denied.message, /Deník/);
});

test('guardPhotoImportSpace and attachPhotos refuse when free space is too low', async () => {
  const attachments = services(500);
  const gate = await guardPhotoImportSpace({
    attachments,
    sourceByteLengths: [2_000_000],
  });
  assert.equal(gate.allow, false);

  const result = await attachPhotosToSavedEvent(attachments, {
    childId: 'child_1' as ChildId,
    eventId: 'event_1' as EntityId,
    hostEventType: 'note',
    candidates: [candidate(2_000_000)],
    nowMs: 1,
    createId: (prefix) => `${prefix}_${randomBytes(2).join('')}`,
  });
  assert.equal(result.attached.length, 0);
  assert.equal(result.failed[0]?.code, 'photo_insufficient_space');
  assert.equal((await attachments.repository.listAll()).length, 0);
});

test('capacity model covers 100 / 1000 / 10000 without inventing currency prices', () => {
  const model = estimateFamilyPhotoCapacityModel();
  assert.deepEqual(
    model.rows.map((row) => row.photoCount),
    [100, 1_000, 10_000],
  );
  assert.ok(model.rows[0]!.familyRemotePrimaryBytes > 0);
  assert.equal(model.rows[1]!.transferRequestEstimate, 2_000);
  assert.ok(model.assumptions.some((row) => row.includes('EUR') || row.includes('provider')));
  const summary = presentPhotoCapacityModelSummary(model);
  assert.match(summary, /100:/);
  assert.doesNotMatch(summary, /€|EUR|Kč/);
});
