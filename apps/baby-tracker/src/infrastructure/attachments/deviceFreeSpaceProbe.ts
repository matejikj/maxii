import { Platform } from 'react-native';
import type { DeviceFreeSpaceProbe } from '../../domain/attachments';

export { createFixedFreeSpaceProbe } from './fixedFreeSpaceProbe';

/**
 * Platform free-space probe. Native uses Expo FileSystem; web uses the Storage
 * API estimate when available. Unknown results return null so imports are not
 * blocked on a false certainty.
 */
export function createDeviceFreeSpaceProbe(): DeviceFreeSpaceProbe {
  return {
    async probeFreeBytes() {
      if (Platform.OS === 'web') {
        try {
          const storage = (
            globalThis as {
              navigator?: {
                storage?: { estimate?: () => Promise<{ quota?: number; usage?: number }> };
              };
            }
          ).navigator?.storage;
          if (!storage?.estimate) return null;
          const estimate = await storage.estimate();
          if (
            typeof estimate.quota !== 'number' ||
            typeof estimate.usage !== 'number' ||
            !Number.isFinite(estimate.quota) ||
            !Number.isFinite(estimate.usage)
          ) {
            return null;
          }
          return Math.max(0, Math.floor(estimate.quota - estimate.usage));
        } catch {
          return null;
        }
      }
      try {
        const FileSystem = await import('expo-file-system/legacy');
        const free =
          typeof FileSystem.getFreeDiskStorageAsync === 'function'
            ? await FileSystem.getFreeDiskStorageAsync()
            : null;
        if (typeof free !== 'number' || !Number.isFinite(free) || free < 0) return null;
        return Math.floor(free);
      } catch {
        return null;
      }
    },
  };
}
