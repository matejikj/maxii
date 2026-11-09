/**
 * First-release local photo budgets. These are product decisions for diary
 * copies — not printer archives and not cloud provider quotas.
 */
export const ATTACHMENT_LIMITS = {
  maxPerEvent: 6,
  maxSourceBytes: 30 * 1024 * 1024,
  maxSourceMegapixels: 64,
  maxSourceEdgePx: 16_384,
  displayMaxEdgePx: 2_048,
  displayMaxBytes: 3 * 1024 * 1024,
  thumbnailMaxEdgePx: 480,
  thumbnailMaxBytes: 160 * 1024,
  captionMaxChars: 160,
  recoverableCacheBudgetBytes: 256 * 1024 * 1024,
  /**
   * Recent thumbnail prefetch sits inside the recoverable cache budget and is
   * never a promise that the whole album is offline.
   */
  thumbnailPrefetchBudgetBytes: 64 * 1024 * 1024,
  thumbnailPrefetchWindowDays: 30,
  /** At most two photo transfers share the network path with care sync. */
  maxConcurrentTransfers: 2,
  /** Default family remote budget — enforced on the API, mirrored for UI copy. */
  familyRemoteBudgetBytes: 1 * 1024 * 1024 * 1024,
  familyPendingReservationBudgetBytes: 64 * 1024 * 1024,
  /**
   * Extra headroom beyond source + display + thumb for AEAD wrap, staging and
   * journal — free disk is never a success guarantee by itself.
   */
  importJournalOverheadFactor: 1.25,
  normalizationVersion: 'lumi.photo-normalize.v1',
} as const;

export const ATTACHMENT_SUPPORTED_INPUT_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AttachmentSupportedInputMime =
  (typeof ATTACHMENT_SUPPORTED_INPUT_MIME)[number];

/** HEIC/HEIF stays platform-gated; unknown codecs are rejected offline. */
export const ATTACHMENT_CONDITIONAL_INPUT_MIME = [
  'image/heic',
  'image/heif',
] as const;
