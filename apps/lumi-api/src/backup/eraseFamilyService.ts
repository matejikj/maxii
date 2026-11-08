import type { AppUserId, FamilyId, FamilyErasureReceipt } from '@lumi/contracts';
import type { MemoryFamilyStore } from '../identity/store.ts';
import {
  createMemoryErasureRegistry,
  nextEraseGeneration,
  type ErasureRegistryPort,
} from './erasureRegistry.ts';

/**
 * Persist the minimal erasure ledger outside the restored DB, then soft-erase.
 * If the registry write fails, the live family directory stays untouched.
 */
export async function eraseFamilyWithDurableRegistry(input: {
  readonly store: MemoryFamilyStore;
  readonly registry: ErasureRegistryPort;
  readonly actorId: AppUserId;
  readonly familyId: FamilyId;
  readonly now: string;
  readonly opaqueEntityIds?: readonly string[];
}): Promise<FamilyErasureReceipt> {
  const current = await input.registry.load();
  const eraseGeneration = nextEraseGeneration(current, input.familyId);
  try {
    await input.registry.append({
      familyId: input.familyId,
      erasedAt: input.now,
      eraseGeneration,
      opaqueEntityIds: input.opaqueEntityIds ?? [],
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'registry_write_failed';
    throw Object.assign(new Error(reason), {
      code: 'registry_unavailable',
      reason,
      liveDataMutated: false,
    });
  }
  return input.store.eraseFamily(input.actorId, input.familyId, input.now, {
    eraseGeneration,
    registryPersisted: true,
  });
}

export function defaultErasureRegistry(): ErasureRegistryPort {
  return createMemoryErasureRegistry();
}
