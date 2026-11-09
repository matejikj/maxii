import type { DeviceFreeSpaceProbe } from '../../domain/attachments';

/** Deterministic free-space probe for Node contract tests. */
export function createFixedFreeSpaceProbe(freeBytes: number | null): DeviceFreeSpaceProbe {
  return {
    async probeFreeBytes() {
      return freeBytes;
    },
  };
}
