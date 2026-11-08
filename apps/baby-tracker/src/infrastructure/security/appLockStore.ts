import { bytesToHex, randomBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { AppError } from '../../domain/errors';

const PIN_MIN_LENGTH = 4;
const PIN_MAX_LENGTH = 8;

export type AppLockStatus = {
  enabled: boolean;
  /** True while the session still needs an unlock after background/cold start. */
  locked: boolean;
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
export function createMemoryAppLockStore(): AppLockStore & {
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
export async function createSecureStoreAppLockStore(): Promise<AppLockStore> {
  const SecureStore = await import('expo-secure-store');
  let sessionUnlocked = true;
  let cached: StoredLock | null | undefined;

  async function readLock(): Promise<StoredLock | null> {
    if (cached !== undefined) return cached;
    const raw = await SecureStore.getItemAsync(SECURE_LOCK_KEY);
    if (!raw) {
      cached = null;
      return null;
    }
    try {
      cached = JSON.parse(raw) as StoredLock;
      return cached;
    } catch {
      cached = null;
      return null;
    }
  }

  async function writeLock(lock: StoredLock | null): Promise<void> {
    cached = lock;
    if (lock == null) {
      await SecureStore.deleteItemAsync(SECURE_LOCK_KEY);
      return;
    }
    await SecureStore.setItemAsync(SECURE_LOCK_KEY, JSON.stringify(lock), {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  }

  return {
    async getStatus() {
      const lock = await readLock();
      return { enabled: lock != null, locked: lock != null && !sessionUnlocked };
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
      const lock = await readLock();
      if (lock != null) sessionUnlocked = false;
    },
    async clearForWipe() {
      await writeLock(null);
      sessionUnlocked = true;
    },
  };
}
