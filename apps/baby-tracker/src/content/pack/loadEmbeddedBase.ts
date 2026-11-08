import {
  activateContentPack,
  createMemoryPackStore,
  type MemoryPackStore,
} from './activate';
import { evaluateContentReadiness } from './readiness';
import {
  EMBEDDED_FIRST_YEAR_BASE_MANIFEST,
  EMBEDDED_FIRST_YEAR_BASE_SIGNATURE,
} from './embeddedFirstYearBase';
import { buildFirstYearBaseFiles } from './firstYearBasePack';
import { EMBEDDED_BASE_PACK_ID } from './embeddedBase';
import type { ContentReadiness } from './types';

export type EmbeddedBaseActivation = {
  readonly store: MemoryPackStore;
  readonly readiness: ContentReadiness;
};

/**
 * Activate the signed install-local first-year pack. Payload bytes are rebuilt
 * from the published catalog and checked against the embedded signature.
 */
export function activateEmbeddedFirstYearBase(nowMs: number): EmbeddedBaseActivation {
  const store = createMemoryPackStore();
  const files = buildFirstYearBaseFiles();
  const result = activateContentPack(store, {
    manifestRaw: EMBEDDED_FIRST_YEAR_BASE_MANIFEST,
    signatureRaw: EMBEDDED_FIRST_YEAR_BASE_SIGNATURE,
    files,
    nowMs,
    verifyOptions: { allowDevelopmentKeys: false },
  });
  if (!result.ok) {
    throw new Error(`Embedded content pack rejected: ${result.code} — ${result.message}`);
  }
  const readiness = evaluateContentReadiness(store, {
    packId: EMBEDDED_BASE_PACK_ID,
    nowMs,
    publicCacheComplete: true,
    databaseAvailable: true,
    revalidate: false,
  });
  return { store, readiness };
}
