import type { MemoryPackStore } from './activate';
import { getActivePack } from './activate';
import type { ContentReadiness } from './types';

export type ReadinessProbe = {
  readonly packId: string;
  readonly nowMs: number;
  /** Public shell/assets cache finished for this origin. */
  readonly publicCacheComplete: boolean;
  /** Local diary database opened successfully. */
  readonly databaseAvailable: boolean;
  /** True when a previous ready claim may have been evicted by the origin. */
  readonly revalidate: boolean;
};

/**
 * Offline readiness is re-checked on start. A prior “ready” is not a guarantee
 * against cache eviction; diary DB and public pack cache are separate.
 */
export function evaluateContentReadiness(
  store: MemoryPackStore,
  probe: ReadinessProbe,
): ContentReadiness {
  const active = getActivePack(store, probe.packId);
  if (!probe.databaseAvailable) {
    return {
      status: 'unavailable',
      reason: 'Local diary storage is unavailable.',
      activePackId: active?.packId ?? null,
      activeGeneration: active?.generation ?? null,
      catalogVersion: active?.manifest.catalogVersion ?? null,
      collectionVersion: active?.manifest.collectionVersion ?? null,
      checkedAtMs: probe.nowMs,
    };
  }
  if (!active) {
    return {
      status: 'unavailable',
      reason: 'No verified content pack is active.',
      activePackId: null,
      activeGeneration: null,
      catalogVersion: null,
      collectionVersion: null,
      checkedAtMs: probe.nowMs,
    };
  }
  if (!probe.publicCacheComplete) {
    return {
      status: probe.revalidate ? 'limited' : 'preparing',
      reason: probe.revalidate
        ? 'Public asset cache needs revalidation after a restart.'
        : 'Public asset cache is still preparing.',
      activePackId: active.packId,
      activeGeneration: active.generation,
      catalogVersion: active.manifest.catalogVersion,
      collectionVersion: active.manifest.collectionVersion,
      checkedAtMs: probe.nowMs,
    };
  }
  return {
    status: 'ready',
    reason: 'Verified content pack and local storage are available offline.',
    activePackId: active.packId,
    activeGeneration: active.generation,
    catalogVersion: active.manifest.catalogVersion,
    collectionVersion: active.manifest.collectionVersion,
    checkedAtMs: probe.nowMs,
  };
}
