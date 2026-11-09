import { ATTACHMENT_LIMITS } from './limits';

/**
 * Conservative bytes reserved for one import before decode/write begins.
 * Covers the source staging copy, both sealed renditions, convert scratch and
 * journal slack. A free-space probe cannot prove the write will succeed.
 */
export function estimatePhotoImportReserveBytes(input: {
  readonly sourceByteLengths: readonly number[];
}): {
  readonly reserveBytes: number;
  readonly perPhotoReserveBytes: readonly number[];
} {
  const perPhotoReserveBytes = input.sourceByteLengths.map((sourceBytes) => {
    const cappedSource = Math.max(0, Math.min(sourceBytes, ATTACHMENT_LIMITS.maxSourceBytes));
    const sealed =
      ATTACHMENT_LIMITS.displayMaxBytes + ATTACHMENT_LIMITS.thumbnailMaxBytes;
    // Convert scratch needs room for decoded pixels roughly proportional to the
    // capped source; keep it bounded by the known source budget.
    const convertScratch = cappedSource;
    const raw = cappedSource + sealed + convertScratch;
    return Math.ceil(raw * ATTACHMENT_LIMITS.importJournalOverheadFactor);
  });
  const reserveBytes = perPhotoReserveBytes.reduce((sum, row) => sum + row, 0);
  return { reserveBytes, perPhotoReserveBytes };
}

/**
 * Worst-case reserve before the picker returns actual sizes — used to refuse
 * opening a multi-select when the device already cannot host even one photo.
 */
export function estimateWorstCasePhotoImportReserveBytes(candidateCount: number): number {
  const count = Math.max(0, Math.min(candidateCount, ATTACHMENT_LIMITS.maxPerEvent));
  const one = estimatePhotoImportReserveBytes({
    sourceByteLengths: [ATTACHMENT_LIMITS.maxSourceBytes],
  }).perPhotoReserveBytes[0]!;
  return one * count;
}

export type PhotoImportSpaceDecision =
  | {
      readonly allow: true;
      readonly freeBytes: number | null;
      readonly reserveBytes: number;
      readonly freeSpaceKnown: boolean;
    }
  | {
      readonly allow: false;
      readonly freeBytes: number;
      readonly reserveBytes: number;
      readonly freeSpaceKnown: true;
      readonly reason: 'insufficient_space';
      readonly suggest: 'smaller_selection' | 'clear_cache' | 'both';
      readonly maxFittingCandidates: number;
      readonly message: string;
    };

/**
 * Decide whether an import may start. Unknown free space does not hard-block
 * (write failures still fail closed later); known shortfalls never delete diary
 * text, drafts or recovery points — only suggest a smaller pick or cache clear.
 */
export function decidePhotoImportSpaceGate(input: {
  readonly freeBytes: number | null;
  readonly reserveBytes: number;
  readonly candidateCount: number;
  readonly perPhotoReserveBytes?: readonly number[];
  readonly recoverableCacheBytes?: number;
}): PhotoImportSpaceDecision {
  const reserveBytes = Math.max(0, input.reserveBytes);
  if (input.freeBytes == null) {
    return {
      allow: true,
      freeBytes: null,
      reserveBytes,
      freeSpaceKnown: false,
    };
  }
  if (input.freeBytes >= reserveBytes) {
    return {
      allow: true,
      freeBytes: input.freeBytes,
      reserveBytes,
      freeSpaceKnown: true,
    };
  }

  let maxFittingCandidates = 0;
  const perPhoto = input.perPhotoReserveBytes ?? [];
  if (perPhoto.length > 0) {
    let used = 0;
    for (const row of perPhoto) {
      if (used + row > input.freeBytes) break;
      used += row;
      maxFittingCandidates += 1;
    }
  } else if (input.candidateCount > 0) {
    const each = Math.ceil(reserveBytes / input.candidateCount);
    maxFittingCandidates = each > 0 ? Math.floor(input.freeBytes / each) : 0;
  }

  const cacheBytes = input.recoverableCacheBytes ?? 0;
  const suggest =
    maxFittingCandidates > 0 && cacheBytes > 0
      ? 'both'
      : maxFittingCandidates > 0
        ? 'smaller_selection'
        : cacheBytes > 0
          ? 'clear_cache'
          : 'smaller_selection';

  const message =
    suggest === 'clear_cache'
      ? 'Na zařízení není dost místa pro další fotky. Vyčistěte obnovitelnou cache nebo zvolte méně fotek. Deník a textové záznamy nemažeme.'
      : suggest === 'both'
        ? `Na zařízení zbývá málo místa. Vejde se nejvýše ${maxFittingCandidates} fotek z tohoto výběru, nebo nejdřív vyčistěte obnovitelnou cache. Deník nemažeme.`
        : maxFittingCandidates > 0
          ? `Na zařízení zbývá málo místa. Vejde se nejvýše ${maxFittingCandidates} fotek z tohoto výběru. Deník a koncepty zůstávají.`
          : 'Na zařízení není dost místa pro další fotky. Zvolte menší výběr. Deník, koncepty ani body obnovy nemažeme.';

  return {
    allow: false,
    freeBytes: input.freeBytes,
    reserveBytes,
    freeSpaceKnown: true,
    reason: 'insufficient_space',
    suggest,
    maxFittingCandidates,
    message,
  };
}
