import { sha256Hex } from './bytes';
import { ALLOWED_CONTENT_MIME, CONTENT_PACK_FORMAT, CONTENT_READER_VERSION } from './limits';
import type { ContentPackFileBytes, ContentPackFileEntry, ContentPackManifest } from './types';

export type BuildManifestInput = {
  readonly packId: string;
  readonly kind: ContentPackManifest['kind'];
  readonly generation: number;
  readonly catalogVersion: string;
  readonly collectionVersion: string;
  readonly rulesVersion: string;
  readonly ageMonths: ContentPackManifest['ageMonths'];
  readonly activityRevisionIds: readonly string[];
  readonly capabilities: readonly string[];
  readonly files: readonly ContentPackFileBytes[];
  readonly createdAt: string;
  readonly readerVersion?: string;
};

/** Assemble a manifest from logical files; digests and totalBytes are derived. */
export function buildContentPackManifest(input: BuildManifestInput): {
  manifest: ContentPackManifest;
  files: ContentPackFileBytes[];
} {
  const entries: ContentPackFileEntry[] = [];
  let totalBytes = 0;
  for (const file of input.files) {
    const kind = inferKind(file.logicalId);
    const byteLength = file.bytes.byteLength;
    totalBytes += byteLength;
    entries.push({
      logicalId: file.logicalId,
      kind,
      mime: ALLOWED_CONTENT_MIME[kind],
      byteLength,
      sha256: sha256Hex(file.bytes),
    });
  }
  return {
    manifest: {
      format: CONTENT_PACK_FORMAT,
      packId: input.packId,
      kind: input.kind,
      generation: input.generation,
      readerVersion: input.readerVersion ?? CONTENT_READER_VERSION,
      catalogVersion: input.catalogVersion,
      collectionVersion: input.collectionVersion,
      rulesVersion: input.rulesVersion,
      language: 'cs',
      ageMonths: input.ageMonths,
      activityRevisionIds: [...input.activityRevisionIds],
      capabilities: [...input.capabilities],
      files: entries,
      totalBytes,
      createdAt: input.createdAt,
    },
    files: [...input.files],
  };
}

function inferKind(logicalId: string): ContentPackFileEntry['kind'] {
  if (logicalId.endsWith('.png')) return 'png';
  if (logicalId.endsWith('.webp')) return 'webp';
  if (logicalId.endsWith('.ttf') || logicalId.endsWith('.otf')) return 'font';
  return 'json';
}
