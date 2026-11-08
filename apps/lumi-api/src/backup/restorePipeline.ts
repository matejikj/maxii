import type { ErasureRegistryDocument, RecoveryPreviewResponse } from '@lumi/contracts';
import { LUMI_API_PROTOCOL_VERSION } from '@lumi/contracts';
import { applyErasureRegistryToFamilies } from './erasureRegistry.ts';
import type { LogicalBackupPayload } from './logicalExport.ts';

export type RestoredHostState = {
  readonly families: readonly { familyId: string; erasedAt: string | null }[];
  readonly apiOpen: boolean;
  readonly registryAppliedAt: string | null;
};

/**
 * Ops restore: load the independent erasure registry first, apply it to the
 * restored directory, then open API traffic. Never open on a raw dump alone.
 */
export function restoreOpsHostWithErasureGate(input: {
  readonly restoredFamilies: readonly { familyId: string; erasedAt: string | null }[];
  readonly registry: ErasureRegistryDocument;
  readonly now: string;
}): RestoredHostState {
  const families = applyErasureRegistryToFamilies(
    input.restoredFamilies,
    input.registry,
    input.now,
  );
  return {
    families,
    apiOpen: true,
    registryAppliedAt: input.now,
  };
}

export function buildRecoveryPreview(input: {
  readonly familyId: string;
  readonly backupId: string;
  readonly archivePayload: LogicalBackupPayload;
  readonly registry: ErasureRegistryDocument;
}): RecoveryPreviewResponse {
  const entityKeys = Object.keys(input.archivePayload.appTables);
  const erasureHits = input.registry.entries.filter(
    (entry) => entry.familyId === input.familyId,
  ).length;
  return {
    protocolVersion: LUMI_API_PROTOCOL_VERSION,
    familyId: input.familyId,
    backupId: input.backupId,
    wouldRestoreEntityCount: entityKeys.length,
    wouldReapplyErasureCount: erasureHits,
    activatesOnPreview: false,
    blocksLiveRewrite: true,
  };
}

/**
 * Failed upload / failed restore must leave the live directory untouched.
 */
export function keepLiveStateOnBackupFailure<T>(live: T, _error: unknown): T {
  return live;
}
