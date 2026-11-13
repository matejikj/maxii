import type { LocalChildPrivateSyncState } from './childPrivateTransport.ts';
import { createEmptyChildPrivateSyncState } from './childPrivateTransport.ts';

/**
 * Durable holder for the owner-scoped child-private sync cursor/outbox.
 * Personal mode may persist rows without ever opening a network transport.
 */
export type ChildPrivateSyncStateStore = {
  load(): Promise<LocalChildPrivateSyncState>;
  save(state: LocalChildPrivateSyncState): Promise<void>;
};

/** In-memory durable store for tests and cold personal boots without sync env. */
export function createMemoryChildPrivateSyncStateStore(
  initial?: LocalChildPrivateSyncState,
): ChildPrivateSyncStateStore {
  let state: LocalChildPrivateSyncState = initial ?? createEmptyChildPrivateSyncState();
  return {
    async load() {
      return state;
    },
    async save(next) {
      // Replace the whole snapshot so crash-safe callers can treat save as commit.
      state = next;
    },
  };
}
