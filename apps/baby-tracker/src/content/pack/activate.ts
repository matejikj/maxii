import type {
  ContentPackFileBytes,
  ContentPackManifest,
  ContentPackSignature,
  PackStoreRecord,
} from './types';
import { verifyContentPack, type VerifyPackOptions } from './verify';

export type PackActivationJournal = {
  readonly packId: string;
  readonly generation: number;
  readonly phase: 'staging' | 'verified' | 'committed' | 'rejected';
  readonly updatedAtMs: number;
  readonly reason: string | null;
};

export type MemoryPackStore = {
  readonly records: Map<string, PackStoreRecord>;
  readonly assets: Map<string, Map<string, Uint8Array>>;
  /** Mutable commit marker — survives mid-activation process death. */
  journal: PackActivationJournal | null;
  readonly highestGeneration: Map<string, number>;
  readonly revokedActivityIds: Set<string>;
};

export function createMemoryPackStore(): MemoryPackStore {
  return {
    records: new Map(),
    assets: new Map(),
    journal: null,
    highestGeneration: new Map(),
    revokedActivityIds: new Set(),
  };
}

export type ActivatePackInput = {
  readonly manifestRaw: unknown;
  readonly signatureRaw: unknown;
  readonly files: readonly ContentPackFileBytes[];
  readonly nowMs: number;
  readonly verifyOptions?: VerifyPackOptions;
};

/**
 * Stage → verify → atomic activate. Kill mid-way leaves journal markers so a
 * restart can finish commit or roll back to the previous active pack.
 */
export function activateContentPack(
  store: MemoryPackStore,
  input: ActivatePackInput,
):
  | { ok: true; record: PackStoreRecord; previous: PackStoreRecord | null }
  | { ok: false; code: string; message: string; store: MemoryPackStore } {
  const verifyOptions: VerifyPackOptions = {
    ...(input.verifyOptions ?? {}),
    highestAcceptedGenerationByPackId: store.highestGeneration,
    knownRevokedActivityIds: store.revokedActivityIds,
  };
  const verified = verifyContentPack(
    input.manifestRaw,
    input.signatureRaw,
    input.files,
    verifyOptions,
  );
  if (!verified.ok) {
    store.journal = {
      packId: 'unknown',
      generation: 0,
      phase: 'rejected',
      updatedAtMs: input.nowMs,
      reason: verified.message,
    };
    return { ok: false, code: verified.code, message: verified.message, store };
  }

  const { manifest, signature } = verified;
  const previous = [...store.records.values()].find(
    (item) => item.packId === manifest.packId && item.state === 'active',
  ) ?? null;

  store.journal = {
    packId: manifest.packId,
    generation: manifest.generation,
    phase: 'staging',
    updatedAtMs: input.nowMs,
    reason: null,
  };

  const stagedAssets = new Map<string, Uint8Array>();
  for (const file of input.files) {
    stagedAssets.set(file.logicalId, file.bytes);
  }
  store.assets.set(`${manifest.packId}@staging`, stagedAssets);

  store.journal = {
    ...store.journal,
    phase: 'verified',
    updatedAtMs: input.nowMs,
  };

  if (previous) {
    store.records.set(previousKey(previous), {
      ...previous,
      state: 'previous',
    });
  }

  const record: PackStoreRecord = {
    packId: manifest.packId,
    generation: manifest.generation,
    state: 'active',
    manifest,
    signature,
    keyId: signature.keyId,
    activatedAtMs: input.nowMs,
    rejectReason: null,
  };
  store.records.set(activeKey(manifest.packId), record);
  store.assets.set(activeAssetKey(manifest.packId), stagedAssets);
  store.assets.delete(`${manifest.packId}@staging`);
  store.highestGeneration.set(
    manifest.packId,
    Math.max(store.highestGeneration.get(manifest.packId) ?? 0, manifest.generation),
  );
  store.journal = {
    packId: manifest.packId,
    generation: manifest.generation,
    phase: 'committed',
    updatedAtMs: input.nowMs,
    reason: null,
  };
  return { ok: true, record, previous };
}

/**
 * Recover after process death. A verified-but-uncommitted journal finishes the
 * swap; a bare staging journal is discarded so the last active pack remains.
 */
export function recoverPackStore(store: MemoryPackStore, nowMs: number): MemoryPackStore {
  const journal = store.journal;
  if (!journal) return store;
  if (journal.phase === 'staging' || journal.phase === 'rejected') {
    store.assets.delete(`${journal.packId}@staging`);
    store.journal = null;
    return store;
  }
  if (journal.phase === 'verified') {
    const staged = store.assets.get(`${journal.packId}@staging`);
    const pending = [...store.records.values()].find(
      (item) =>
        item.packId === journal.packId &&
        item.generation === journal.generation &&
        item.state === 'verified',
    );
    if (staged && pending) {
      const previous = [...store.records.values()].find(
        (item) => item.packId === journal.packId && item.state === 'active',
      );
      if (previous) {
        store.records.set(previousKey(previous), { ...previous, state: 'previous' });
      }
      store.records.set(activeKey(journal.packId), {
        ...pending,
        state: 'active',
        activatedAtMs: nowMs,
      });
      store.assets.set(activeAssetKey(journal.packId), staged);
      store.assets.delete(`${journal.packId}@staging`);
      store.highestGeneration.set(
        journal.packId,
        Math.max(store.highestGeneration.get(journal.packId) ?? 0, journal.generation),
      );
    } else {
      store.assets.delete(`${journal.packId}@staging`);
    }
    store.journal = {
      packId: journal.packId,
      generation: journal.generation,
      phase: 'committed',
      updatedAtMs: nowMs,
      reason: null,
    };
  }
  return store;
}

export function getActivePack(
  store: MemoryPackStore,
  packId: string,
): PackStoreRecord | null {
  return store.records.get(activeKey(packId)) ?? null;
}

export function markActivityRevoked(store: MemoryPackStore, activityId: string): void {
  store.revokedActivityIds.add(activityId);
}

function activeKey(packId: string): string {
  return `${packId}:active`;
}

function previousKey(record: PackStoreRecord): string {
  return `${record.packId}:previous:${record.generation}`;
}

function activeAssetKey(packId: string): string {
  return `${packId}@active`;
}

export function buildRollbackManifest(
  current: ContentPackManifest,
  earlier: ContentPackManifest,
  nextGeneration: number,
  createdAt: string,
): ContentPackManifest {
  // Controlled rollback is a newly signed higher generation that points at
  // earlier compatible data — never a lowered protective counter.
  return {
    ...earlier,
    generation: nextGeneration,
    createdAt,
    catalogVersion: earlier.catalogVersion,
    activityRevisionIds: earlier.activityRevisionIds,
    files: earlier.files,
    totalBytes: earlier.totalBytes,
    packId: current.packId,
    kind: current.kind,
  };
}

export type { ContentPackManifest, ContentPackSignature };
