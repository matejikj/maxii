import { FIRST_YEAR_PUBLISHED_CONTENT_VERSION } from '../catalog/firstYearPublished';
import { RECOMMENDATION_RULES_VERSION } from '../../domain/recommendation/types';
import { CONTENT_READER_VERSION } from './limits';
import { listBasePackArtCapabilities } from './capabilities';

export const EMBEDDED_BASE_PACK_ID = 'lumi.first-year.base' as const;
/** Must match packages/lumi-forest CHARACTER_COLLECTION_VERSION. */
export const EMBEDDED_COLLECTION_VERSION = 'lumi.characters.collection.v1' as const;

/** Metadata for the install-local first-year base pack (generation 1). */
export function describeEmbeddedBasePack(): {
  packId: typeof EMBEDDED_BASE_PACK_ID;
  generation: number;
  readerVersion: string;
  catalogVersion: string;
  collectionVersion: string;
  rulesVersion: string;
  capabilities: readonly string[];
} {
  return {
    packId: EMBEDDED_BASE_PACK_ID,
    generation: 1,
    readerVersion: CONTENT_READER_VERSION,
    catalogVersion: FIRST_YEAR_PUBLISHED_CONTENT_VERSION,
    collectionVersion: EMBEDDED_COLLECTION_VERSION,
    rulesVersion: RECOMMENDATION_RULES_VERSION,
    capabilities: listBasePackArtCapabilities(),
  };
}
