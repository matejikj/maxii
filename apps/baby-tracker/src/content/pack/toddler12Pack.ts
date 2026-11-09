import {
  TODDLER_1_2_PUBLISHED_CONTENT_VERSION,
  TODDLER_1_2_PUBLISHED_REVISIONS,
} from '../catalog/toddler12Published';
import { RECOMMENDATION_RULES_VERSION } from '../../domain/recommendation/types';
import { buildContentPackManifest } from './buildManifest';
import { utf8Bytes } from './canonicalize';
import { listInstalledArtCapabilities } from './capabilities';
import { EMBEDDED_COLLECTION_VERSION } from './embeddedBase';
import type { ContentPackFileBytes, ContentPackManifest } from './types';

export const TODDLER_1_2_PACK_ID = 'lumi.toddler-1-2.content' as const;

/** Deterministic payload for the signed toddler 1–2 content pack. */
export function buildToddler12Files(): ContentPackFileBytes[] {
  const catalogPayload = {
    contentVersion: TODDLER_1_2_PUBLISHED_CONTENT_VERSION,
    revisions: TODDLER_1_2_PUBLISHED_REVISIONS,
  };
  return [
    {
      logicalId: 'catalog/toddler-1-2.json',
      bytes: utf8Bytes(`${JSON.stringify(catalogPayload)}\n`),
    },
  ];
}

export function buildToddler12Manifest(
  files: ContentPackFileBytes[],
  createdAt: string,
): { manifest: ContentPackManifest; files: ContentPackFileBytes[] } {
  return buildContentPackManifest({
    packId: TODDLER_1_2_PACK_ID,
    kind: 'content',
    generation: 1,
    catalogVersion: TODDLER_1_2_PUBLISHED_CONTENT_VERSION,
    collectionVersion: EMBEDDED_COLLECTION_VERSION,
    rulesVersion: RECOMMENDATION_RULES_VERSION,
    ageMonths: { fromInclusive: 12, toInclusive: 23 },
    activityRevisionIds: TODDLER_1_2_PUBLISHED_REVISIONS.map((item) => item.revisionId),
    capabilities: listInstalledArtCapabilities(),
    files,
    createdAt,
  });
}
