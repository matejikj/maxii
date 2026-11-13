import type { ErasureRegistryDocument, ErasureRegistryEntry } from '@lumi/contracts';
import { ERASURE_REGISTRY_VERSION } from '@lumi/contracts';

/**
 * Durable erasure ledger kept outside the database that ops restore rewrites.
 * Server erasure must not confirm until this write succeeds.
 */
export type ErasureRegistryPort = {
  readonly append: (entry: ErasureRegistryEntry) => Promise<void>;
  readonly load: () => Promise<ErasureRegistryDocument>;
  readonly replace: (doc: ErasureRegistryDocument) => Promise<void>;
};

export function createMemoryErasureRegistry(
  seed: ErasureRegistryDocument | null = null,
): ErasureRegistryPort & { readonly snapshots: ErasureRegistryDocument[] } {
  const snapshots: ErasureRegistryDocument[] = [];
  let current: ErasureRegistryDocument = seed ?? {
    schemaVersion: ERASURE_REGISTRY_VERSION,
    updatedAt: new Date(0).toISOString(),
    entries: [],
  };

  return {
    snapshots,
    async append(entry) {
      const next: ErasureRegistryDocument = {
        schemaVersion: ERASURE_REGISTRY_VERSION,
        updatedAt: entry.erasedAt,
        entries: [...current.entries.filter((row) => row.familyId !== entry.familyId), entry],
      };
      current = next;
      snapshots.push(next);
    },
    async load() {
      return current;
    },
    async replace(doc) {
      if (doc.schemaVersion !== ERASURE_REGISTRY_VERSION) {
        throw new Error('unsupported_erasure_registry_schema');
      }
      current = doc;
      snapshots.push(doc);
    },
  };
}

/**
 * Apply later erasures onto a restored family directory before opening traffic.
 * A dump taken before erasure must not resurrect the family once the registry
 * is current.
 */
export function applyErasureRegistryToFamilies<
  T extends { familyId: string; erasedAt: string | null },
>(families: readonly T[], registry: ErasureRegistryDocument, now: string): readonly T[] {
  const byId = new Map(registry.entries.map((entry) => [entry.familyId, entry]));
  return families.map((family) => {
    const hit = byId.get(family.familyId);
    if (!hit) return family;
    if (family.erasedAt) return family;
    return { ...family, erasedAt: hit.erasedAt || now };
  });
}

export function nextEraseGeneration(registry: ErasureRegistryDocument, familyId: string): number {
  const existing = registry.entries.find((entry) => entry.familyId === familyId);
  return (existing?.eraseGeneration ?? 0) + 1;
}
