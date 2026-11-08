import { bytesToHex, randomBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { AppError } from '../../domain/errors';

const PIN_MIN_LENGTH = 4;
const PIN_MAX_LENGTH = 8;

export type AppLockProtection = 'secure_store' | 'origin_storage' | 'unavailable';

export type AppLockStatus = {
  enabled: boolean;
  /** True while the session still needs an unlock after background/cold start. */
  locked: boolean;
  /** Non-null when the durable lock store cannot be used safely. */
  fault: string | null;
  /** How the PIN material is protected on this platform. */
  protection: AppLockProtection;
};

export type AppLockStore = {
  getStatus(): Promise<AppLockStatus>;
  enableWithPin(pin: string): Promise<void>;
  disable(pin: string): Promise<void>;
  unlock(pin: string): Promise<boolean>;
  /** Call when the app returns from background so the gate covers the diary again. */
  lockOnBackground(): Promise<void>;
  /** Full wipe removes the PIN without requiring it (used after confirmed data wipe). */
  clearForWipe(): Promise<void>;
  /** Retry opening the durable store after a platform fault. */
  retryDurableStore?(): Promise<AppLockStatus>;
};

type StoredLock = {
  saltHex: string;
  pinHashHex: string;
};

/**
 * Optional UI gate. The diary encryption key stays in the platform vault; a
 * forgotten PIN never silently rotates that key — caregivers restore from a
 * portable backup if they lose the PIN and also lose device unlock.
 */
export function createMemoryAppLockStore(
  protection: AppLockProtection = 'unavailable',
): AppLockStore & {
  readonly store: { lock: StoredLock | null; sessionUnlocked: boolean };
} {
  const store: { lock: StoredLock | null; sessionUnlocked: boolean } = {
    lock: null,
    sessionUnlocked: true,
  };
  return {
    store,
    async getStatus() {
      return {
        enabled: store.lock != null,
        locked: store.lock != null && !store.sessionUnlocked,
        fault: null,
        protection,
      };
    },
    async enableWithPin(pin) {
      assertPin(pin);
      const salt = randomBytes(16);
      store.lock = {
        saltHex: bytesToHex(salt),
        pinHashHex: hashPin(pin, salt),
      };
      store.sessionUnlocked = true;
    },
    async disable(pin) {
      if (store.lock == null) return;
      if (!verifyPin(pin, store.lock)) {
        throw new AppError('VALIDATION', 'PIN se neshoduje', { details: { reason: 'pin_mismatch' } });
      }
      store.lock = null;
      store.sessionUnlocked = true;
    },
    async unlock(pin) {
      if (store.lock == null) {
        store.sessionUnlocked = true;
        return true;
      }
      const ok = verifyPin(pin, store.lock);
      store.sessionUnlocked = ok;
      return ok;
    },
    async lockOnBackground() {
      if (store.lock != null) store.sessionUnlocked = false;
    },
    async clearForWipe() {
      store.lock = null;
      store.sessionUnlocked = true;
    },
  };
}

/**
 * Keeps the diary behind a recovery screen when SecureStore fails. Never falls
 * through to an unlocked memory store that would bypass a previously set PIN.
 */
export function createFaultedAppLockStore(
  message: string,
  retry?: () => Promise<AppLockStore>,
): AppLockStore {
  let replacement: AppLockStore | null = null;
  const store: AppLockStore = {
    async getStatus() {
      if (replacement) return replacement.getStatus();
      return {
        enabled: true,
        locked: true,
        fault: message,
        protection: 'unavailable',
      };
    },
    async enableWithPin() {
      throw new AppError('STORAGE', message, { details: { reason: 'app_lock_fault' }, retryable: true });
    },
    async disable() {
      throw new AppError('STORAGE', message, { details: { reason: 'app_lock_fault' }, retryable: true });
    },
    async unlock() {
      return false;
    },
    async lockOnBackground() {
      // Stay locked while the durable store is unavailable.
    },
    async clearForWipe() {
      if (replacement) await replacement.clearForWipe();
    },
    async retryDurableStore() {
      if (!retry) {
        return store.getStatus();
      }
      replacement = await retry();
      return replacement.getStatus();
    },
  };
  return store;
}

function assertPin(pin: string): void {
  if (!/^\d+$/.test(pin) || pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) {
    throw new AppError('VALIDATION', 'PIN musí mít 4–8 číslic', {
      details: { reason: 'pin_format' },
    });
  }
}

function hashPin(pin: string, salt: Uint8Array): string {
  const material = new Uint8Array(salt.length + utf8ToBytes(pin).length);
  material.set(salt, 0);
  material.set(utf8ToBytes(pin), salt.length);
  return bytesToHex(sha256(material));
}

function verifyPin(pin: string, lock: StoredLock): boolean {
  try {
    assertPin(pin);
  } catch {
    return false;
  }
  const salt = hexToBytes(lock.saltHex);
  return hashPin(pin, salt) === lock.pinHashHex;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

const SECURE_LOCK_KEY = 'lumi.app-lock.v1';

/** SecureStore-backed lock; loaded only from native/web composition paths. */
export async function createSecureStoreAppLockStore(
  protection: AppLockProtection = 'secure_store',
): Promise<AppLockStore> {
  const SecureStore = await import('expo-secure-store');
  const available = await SecureStore.isAvailableAsync();
  if (!available) {
    throw new AppError('STORAGE', 'Úložiště zámku není na tomto zařízení dostupné', {
      details: { reason: 'secure_store_unavailable' },
      retryable: true,
    });
  }

  let sessionUnlocked = true;
  let cached: StoredLock | null | undefined;
  let fault: string | null = null;

  async function readLock(): Promise<StoredLock | null> {
    if (fault) {
      throw new AppError('STORAGE', fault, {
        details: { reason: 'app_lock_fault' },
        retryable: true,
      });
    }
    if (cached !== undefined) return cached;
    try {
      const raw = await SecureStore.getItemAsync(SECURE_LOCK_KEY);
      if (!raw) {
        cached = null;
        return null;
      }
      cached = JSON.parse(raw) as StoredLock;
      return cached;
    } catch (error) {
      fault =
        error instanceof Error
          ? error.message
          : 'Úložiště zámku nelze přečíst';
      throw new AppError('STORAGE', fault, {
        details: { reason: 'app_lock_read_failed' },
        retryable: true,
        cause: error,
      });
    }
  }

  async function writeLock(lock: StoredLock | null): Promise<void> {
    try {
      cached = lock;
      if (lock == null) {
        await SecureStore.deleteItemAsync(SECURE_LOCK_KEY);
        return;
      }
      await SecureStore.setItemAsync(SECURE_LOCK_KEY, JSON.stringify(lock), {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
      fault = null;
    } catch (error) {
      fault =
        error instanceof Error
          ? error.message
          : 'Úložiště zámku nelze zapsat';
      throw new AppError('STORAGE', fault, {
        details: { reason: 'app_lock_write_failed' },
        retryable: true,
        cause: error,
      });
    }
  }

  // Probe once so a dead SecureStore fails closed before caregivers rely on it.
  await readLock();

  const store: AppLockStore = {
    async getStatus() {
      if (fault) {
        return {
          enabled: true,
          locked: true,
          fault,
          protection: 'unavailable',
        };
      }
      try {
        const lock = await readLock();
        return {
          enabled: lock != null,
          locked: lock != null && !sessionUnlocked,
          fault: null,
          protection,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Úložiště zámku selhalo';
        return {
          enabled: true,
          locked: true,
          fault: message,
          protection: 'unavailable',
        };
      }
    },
    async enableWithPin(pin) {
      assertPin(pin);
      const salt = randomBytes(16);
      await writeLock({ saltHex: bytesToHex(salt), pinHashHex: hashPin(pin, salt) });
      sessionUnlocked = true;
    },
    async disable(pin) {
      const lock = await readLock();
      if (lock == null) return;
      if (!verifyPin(pin, lock)) {
        throw new AppError('VALIDATION', 'PIN se neshoduje', { details: { reason: 'pin_mismatch' } });
      }
      await writeLock(null);
      sessionUnlocked = true;
    },
    async unlock(pin) {
      if (fault) return false;
      const lock = await readLock();
      if (lock == null) {
        sessionUnlocked = true;
        return true;
      }
      const ok = verifyPin(pin, lock);
      sessionUnlocked = ok;
      return ok;
    },
    async lockOnBackground() {
      try {
        const lock = await readLock();
        if (lock != null) sessionUnlocked = false;
      } catch {
        sessionUnlocked = false;
      }
    },
    async clearForWipe() {
      await writeLock(null);
      sessionUnlocked = true;
      fault = null;
    },
    async retryDurableStore() {
      fault = null;
      cached = undefined;
      await readLock();
      return store.getStatus();
    },
  };
  return store;
}

/**
 * Opens the durable app-lock store. Never silently substitutes an unlocked
 * memory store after a SecureStore failure — that would bypass an existing PIN.
 */
export async function openPlatformAppLockStore(): Promise<AppLockStore> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Platform } = require('react-native') as { Platform: { OS: string } };
  const protection: AppLockProtection =
    Platform.OS === 'web' ? 'origin_storage' : 'secure_store';
  try {
    return await createSecureStoreAppLockStore(protection);
  } catch (error) {
    if (Platform.OS === 'web') {
      // Web without SecureStore keeps a same-origin session gate and says so.
      return createMemoryAppLockStore('origin_storage');
    }
    const message =
      error instanceof Error
        ? error.message
        : 'Úložiště zámku není dostupné';
    return createFaultedAppLockStore(message, () => createSecureStoreAppLockStore(protection));
  }
}
