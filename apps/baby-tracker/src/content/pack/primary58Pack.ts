import {
  PRIMARY_5_8_PUBLISHED_CONTENT_VERSION,
  PRIMARY_5_8_PUBLISHED_REVISIONS,
} from '../catalog/primary58Published';
import { RECOMMENDATION_RULES_VERSION } from '../../domain/recommendation/types';
import { buildContentPackManifest } from './buildManifest';
import { utf8Bytes } from './canonicalize';
import { listBasePackArtCapabilities } from './capabilities';
import { EMBEDDED_COLLECTION_VERSION } from './embeddedBase';
import type { ContentPackFileBytes, ContentPackManifest } from './types';

export const PRIMARY_5_8_PACK_ID = 'lumi.primary-5-8.content' as const;

/** Deterministic payload for the signed primary 5–8 content pack. */
export function buildPrimary58Files(): ContentPackFileBytes[] {
  const catalogPayload = {
    contentVersion: PRIMARY_5_8_PUBLISHED_CONTENT_VERSION,
    revisions: PRIMARY_5_8_PUBLISHED_REVISIONS,
  };
  return [
    {
      logicalId: 'catalog/primary-5-8.json',
      bytes: utf8Bytes(`${JSON.stringify(catalogPayload)}\n`),
    },
  ];
}

export function buildPrimary58Manifest(
  files: ContentPackFileBytes[],
  createdAt: string,
): { manifest: ContentPackManifest; files: ContentPackFileBytes[] } {
  return buildContentPackManifest({
    packId: PRIMARY_5_8_PACK_ID,
    kind: 'content',
    generation: 1,
    catalogVersion: PRIMARY_5_8_PUBLISHED_CONTENT_VERSION,
    collectionVersion: EMBEDDED_COLLECTION_VERSION,
    rulesVersion: RECOMMENDATION_RULES_VERSION,
    ageMonths: { fromInclusive: 60, toInclusive: 95 },
    activityRevisionIds: PRIMARY_5_8_PUBLISHED_REVISIONS.map((item) => item.revisionId),
    capabilities: listBasePackArtCapabilities(),
    files,
    createdAt,
  });
}
