/** Project budgets for signed content packs — not APK/IPA or diary backup size. */
export const CONTENT_PACK_LIMITS = Object.freeze({
  maxManifestBytes: 256 * 1024,
  maxSignatureBytes: 4 * 1024,
  maxFiles: 1024,
  maxFileBytes: 8 * 1024 * 1024,
  maxPackBytes: 64 * 1024 * 1024,
  maxJsonDepth: 16,
  maxGenericStringBytes: 32 * 1024,
  maxPackIdLength: 64,
  maxLogicalIdLength: 128,
});

export const CONTENT_PACK_FORMAT = 'lumi.content-pack.v1' as const;
export const CONTENT_PACK_SIGNATURE_FORMAT = 'lumi.content-pack-signature.v1' as const;
export const CONTENT_READER_VERSION = 'lumi.content-reader.v1' as const;
export const CONTENT_PACK_SIGNATURE_ALGORITHM = 'Ed25519' as const;

export const CONTENT_PACK_KINDS = ['base', 'content', 'art'] as const;
export type ContentPackKind = (typeof CONTENT_PACK_KINDS)[number];

export const CONTENT_FILE_KINDS = ['json', 'png', 'webp', 'font'] as const;
export type ContentFileKind = (typeof CONTENT_FILE_KINDS)[number];

export const ALLOWED_CONTENT_MIME = Object.freeze({
  json: 'application/json',
  png: 'image/png',
  webp: 'image/webp',
  font: 'font/ttf',
} as const);
