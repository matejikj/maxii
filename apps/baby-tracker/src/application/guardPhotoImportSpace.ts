import {
  buildPhotoStorageInventory,
  decidePhotoImportSpaceGate,
  estimatePhotoImportReserveBytes,
  estimateWorstCasePhotoImportReserveBytes,
  type AttachmentServices,
  type PhotoImportSpaceDecision,
} from '../domain/attachments';

/**
 * Probe device free space and decide whether a photo import may start.
 * Personal mode works without this probe; when absent we treat space as unknown.
 */
export async function guardPhotoImportSpace(input: {
  readonly attachments: AttachmentServices;
  readonly sourceByteLengths?: readonly number[];
  readonly candidateCount?: number;
}): Promise<PhotoImportSpaceDecision> {
  const freeBytes = input.attachments.freeSpace
    ? await input.attachments.freeSpace.probeFreeBytes()
    : null;

  let reserveBytes: number;
  let perPhotoReserveBytes: readonly number[] | undefined;
  let candidateCount: number;

  if (input.sourceByteLengths && input.sourceByteLengths.length > 0) {
    const estimated = estimatePhotoImportReserveBytes({
      sourceByteLengths: input.sourceByteLengths,
    });
    reserveBytes = estimated.reserveBytes;
    perPhotoReserveBytes = estimated.perPhotoReserveBytes;
    candidateCount = input.sourceByteLengths.length;
  } else {
    candidateCount = Math.max(1, input.candidateCount ?? 1);
    reserveBytes = estimateWorstCasePhotoImportReserveBytes(candidateCount);
  }

  let recoverableCacheBytes = 0;
  try {
    const rows = await input.attachments.repository.listAll();
    recoverableCacheBytes = buildPhotoStorageInventory({ attachments: rows }).cacheBytes;
  } catch {
    recoverableCacheBytes = 0;
  }

  return decidePhotoImportSpaceGate({
    freeBytes,
    reserveBytes,
    candidateCount,
    perPhotoReserveBytes,
    recoverableCacheBytes,
  });
}
