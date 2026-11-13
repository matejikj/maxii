import { ATTACHMENT_LIMITS } from './limits';

export type PhotoCapacityCountRow = {
  readonly photoCount: number;
  /** Average display + thumbnail sealed size for planning. */
  readonly avgPrimaryObjectBytes: number;
  /** Worst-case display + thumbnail sealed size. */
  readonly maxPrimaryObjectBytes: number;
  /** Upper bound if every photo stays as a durable own local copy. */
  readonly localDurableOwnBytes: number;
  /** Recoverable download cache budget (not album completeness). */
  readonly recoverableCacheBudgetBytes: number;
  /** Thumbnail prefetch slice inside the cache budget. */
  readonly thumbnailPrefetchBudgetBytes: number;
  /** Family remote primary objects (display+thumb), excluding ops backups. */
  readonly familyRemotePrimaryBytes: number;
  /** Soft-deleted trash still counting toward remote/local until purge. */
  readonly trashReserveBytes: number;
  /** Independent full photographic backup size (separate from primary bucket). */
  readonly independentBackupBytes: number;
  /** Two rendition transfers per photo (display + thumbnail). */
  readonly transferRequestEstimate: number;
};

export type PhotoCapacityModel = {
  readonly rows: readonly PhotoCapacityCountRow[];
  readonly assumptions: readonly string[];
};

/**
 * Byte/request planning model for 100 / 1 000 / 10 000 stored photos.
 * Currency prices stay out of this function — live R2/Supabase rates must be
 * attached by ops at deploy time, never invented from PostgreSQL row size.
 */
export function estimateFamilyPhotoCapacityModel(input?: {
  readonly photoCounts?: readonly number[];
  readonly avgDisplayBytes?: number;
  readonly avgThumbnailBytes?: number;
  /** Share of photos assumed soft-deleted but still retained in trash. */
  readonly trashShare?: number;
}): PhotoCapacityModel {
  const counts = input?.photoCounts ?? ([100, 1_000, 10_000] as const);
  const avgDisplay = input?.avgDisplayBytes ?? Math.floor(ATTACHMENT_LIMITS.displayMaxBytes * 0.45);
  const avgThumb =
    input?.avgThumbnailBytes ?? Math.floor(ATTACHMENT_LIMITS.thumbnailMaxBytes * 0.7);
  const avgPrimary = avgDisplay + avgThumb;
  const maxPrimary = ATTACHMENT_LIMITS.displayMaxBytes + ATTACHMENT_LIMITS.thumbnailMaxBytes;
  const trashShare = Math.min(1, Math.max(0, input?.trashShare ?? 0.02));

  const rows: PhotoCapacityCountRow[] = counts.map((photoCount) => {
    const familyRemotePrimaryBytes = photoCount * avgPrimary;
    const trashReserveBytes = Math.ceil(familyRemotePrimaryBytes * trashShare);
    return {
      photoCount,
      avgPrimaryObjectBytes: avgPrimary,
      maxPrimaryObjectBytes: maxPrimary,
      localDurableOwnBytes: photoCount * avgPrimary,
      recoverableCacheBudgetBytes: ATTACHMENT_LIMITS.recoverableCacheBudgetBytes,
      thumbnailPrefetchBudgetBytes: ATTACHMENT_LIMITS.thumbnailPrefetchBudgetBytes,
      familyRemotePrimaryBytes,
      trashReserveBytes,
      // Full independent backup mirrors primary payloads; ops rotation is separate.
      independentBackupBytes: familyRemotePrimaryBytes + trashReserveBytes,
      transferRequestEstimate: photoCount * 2,
    };
  });

  return {
    rows,
    assumptions: [
      'Average sizes are planning defaults under product display/thumbnail caps, not measured device samples.',
      'Local durable own bytes assume every photo stays pinned/own on one device — real devices keep less via cache policy.',
      'Recoverable cache and thumbnail prefetch budgets are fixed device targets, not per-album guarantees.',
      'Family remote primary excludes independent backup buckets and VPS staging.',
      'Request estimates count one display and one thumbnail transfer per photo; retries are extra.',
      'Do not derive cloud EUR cost from PostgreSQL DB size; attach live provider rates in ops.',
    ],
  };
}

export function presentPhotoCapacityModelSummary(model: PhotoCapacityModel): string {
  return model.rows
    .map(
      (row) =>
        `${row.photoCount}: avg ${formatMiB(row.avgPrimaryObjectBytes)}/photo · remote ${formatMiB(row.familyRemotePrimaryBytes)} · backup ${formatMiB(row.independentBackupBytes)} · transfers ${row.transferRequestEstimate}`,
    )
    .join('\n');
}

function formatMiB(bytes: number): string {
  const mib = bytes / (1024 * 1024);
  if (mib < 0.1) return `${Math.max(1, Math.round(bytes / 1024))} KiB`;
  return `${mib.toFixed(mib >= 10 ? 0 : 1)} MiB`;
}
