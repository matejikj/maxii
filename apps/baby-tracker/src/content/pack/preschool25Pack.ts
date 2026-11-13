import {
  PRESCHOOL_2_5_PUBLISHED_CONTENT_VERSION,
  PRESCHOOL_2_5_PUBLISHED_REVISIONS,
} from '../catalog/preschool25Published';
import { RECOMMENDATION_RULES_VERSION } from '../../domain/recommendation/types';
import { buildContentPackManifest } from './buildManifest';
import { utf8Bytes } from './canonicalize';
import { listBasePackArtCapabilities } from './capabilities';
import { EMBEDDED_COLLECTION_VERSION } from './embeddedBase';
import type { ContentPackFileBytes, ContentPackManifest } from './types';

export const PRESCHOOL_2_5_PACK_ID = 'lumi.preschool-2-5.content' as const;

/** Deterministic payload for the signed preschool 2–5 content pack. */
export function buildPreschool25Files(): ContentPackFileBytes[] {
  const catalogPayload = {
    contentVersion: PRESCHOOL_2_5_PUBLISHED_CONTENT_VERSION,
    revisions: PRESCHOOL_2_5_PUBLISHED_REVISIONS,
  };
  return [
    {
      logicalId: 'catalog/preschool-2-5.json',
      bytes: utf8Bytes(`${JSON.stringify(catalogPayload)}\n`),
    },
  ];
}

export function buildPreschool25Manifest(
  files: ContentPackFileBytes[],
  createdAt: string,
): { manifest: ContentPackManifest; files: ContentPackFileBytes[] } {
  return buildContentPackManifest({
    packId: PRESCHOOL_2_5_PACK_ID,
    kind: 'content',
    generation: 1,
    catalogVersion: PRESCHOOL_2_5_PUBLISHED_CONTENT_VERSION,
    collectionVersion: EMBEDDED_COLLECTION_VERSION,
    rulesVersion: RECOMMENDATION_RULES_VERSION,
    ageMonths: { fromInclusive: 24, toInclusive: 59 },
    activityRevisionIds: PRESCHOOL_2_5_PUBLISHED_REVISIONS.map((item) => item.revisionId),
    capabilities: listBasePackArtCapabilities(),
    files,
    createdAt,
  });
}
