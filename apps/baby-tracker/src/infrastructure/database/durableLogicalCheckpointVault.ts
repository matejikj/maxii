import { randomBytes } from '@noble/hashes/utils.js';
import { utf8ToBytes, bytesToUtf8 } from '../crypto/utf8Codec';
import {
  openLocalBlob,
  parseSealedLocalBlob,
  sealLocalBlob,
  serializeSealedLocalBlob,
} from '../crypto/localBlobSeal';
import { AppError } from '../../domain/errors';
import {
  createLogicalCheckpointVault,
  type LogicalCheckpointBackend,
  type LogicalCheckpointRecord,
  type LogicalCheckpointVault,
} from './logicalCheckpointVault';
import { WEB_STORAGE_LIMITS } from './web/webLimits';

const CHECKPOINT_KEY_ID = 'lumi.logical-checkpoint.key.v1';
const NATIVE_DIR = 'lumi-logical-checkpoints';

export type CheckpointKeyVault = {
  getOrCreateKey(): Promise<Uint8Array>;
  clearKey(): Promise<void>;
};

export type CheckpointTextFileStore = {
  listIds(): Promise<string[]>;
  readText(id: string): Promise<string | null>;
  writeText(id: string, text: string): Promise<void>;
  remove(id: string): Promise<void>;
  clearAll(): Promise<void>;
};

/**
 * Encrypt-then-store backend for native document storage. Survives process death
 * and stays outside the live SQLCipher diary file.
 */
export function createEncryptedFileCheckpointBackend(
  files: CheckpointTextFileStore,
  keys: CheckpointKeyVault,
): LogicalCheckpointBackend {
  return {
    async listRecords() {
      const key = await keys.getOrCreateKey();
      const ids = await files.listIds();
      const records: LogicalCheckpointRecord[] = [];
      for (const id of ids) {
        const raw = await files.readText(id);
        if (raw == null) continue;
        try {
          const sealed = parseSealedLocalBlob(raw);
          const plain = openLocalBlob(sealed, key);
          records.push(JSON.parse(bytesToUtf8(plain)) as LogicalCheckpointRecord);
        } catch (error) {
          throw new AppError(
            'STORAGE',
            'A local recovery point failed authentication and was not loaded',
            {
              details: { reason: 'checkpoint_auth', checkpointId: id },
              cause: error,
            },
          );
        }
      }
      return records;
    },
    async putRecord(record) {
      const key = await keys.getOrCreateKey();
      const sealed = sealLocalBlob(utf8ToBytes(JSON.stringify(record)), key);
      await files.writeText(record.checkpointId, serializeSealedLocalBlob(sealed));
    },
    async deleteRecord(checkpointId) {
      await files.remove(checkpointId);
    },
    async clearAll() {
      await files.clearAll();
      await keys.clearKey();
    },
  };
}

export function createMemoryCheckpointKeyVault(
  initial?: Uint8Array,
): CheckpointKeyVault & { key: Uint8Array | null } {
  const state: { key: Uint8Array | null } = {
    key: initial ? new Uint8Array(initial) : null,
  };
  return {
    get key() {
      return state.key;
    },
    async getOrCreateKey() {
      if (!state.key) state.key = randomBytes(32);
      return new Uint8Array(state.key);
    },
    async clearKey() {
      if (state.key) state.key.fill(0);
      state.key = null;
    },
  };
}

export function createMemoryCheckpointTextFileStore(): CheckpointTextFileStore & {
  readonly files: Map<string, string>;
} {
  const files = new Map<string, string>();
  return {
    files,
    async listIds() {
      return [...files.keys()];
    },
    async readText(id) {
      return files.get(id) ?? null;
    },
    async writeText(id, text) {
      files.set(id, text);
    },
    async remove(id) {
      files.delete(id);
    },
    async clearAll() {
      files.clear();
    },
  };
}

/** Dexie table outside the live diary database so replace-import cannot wipe it. */
export function createWebIndexedCheckpointBackend(
  databaseName = WEB_STORAGE_LIMITS.checkpointDatabaseName,
): LogicalCheckpointBackend {
  let dbPromise: Promise<import('dexie').Dexie> | null = null;

  async function db() {
    if (!dbPromise) {
      dbPromise = (async () => {
        const Dexie = (await import('dexie')).default;
        const instance = new Dexie(databaseName);
        instance.version(1).stores({
          records: 'checkpointId, kind, createdAtMs',
        });
        return instance;
      })();
    }
    return dbPromise;
  }

  return {
    async listRecords() {
      const instance = await db();
      return instance.table('records').toArray() as Promise<LogicalCheckpointRecord[]>;
    },
    async putRecord(record) {
      const instance = await db();
      await instance.table('records').put(record);
    },
    async deleteRecord(checkpointId) {
      const instance = await db();
      await instance.table('records').delete(checkpointId);
    },
    async clearAll() {
      const instance = await db();
      await instance.table('records').clear();
    },
  };
}

export async function createNativeFileCheckpointStore(): Promise<CheckpointTextFileStore> {
  const FileSystem = await import('expo-file-system/legacy');
  const root = `${FileSystem.documentDirectory ?? ''}${NATIVE_DIR}/`;
  if (!FileSystem.documentDirectory) {
    throw new AppError('STORAGE', 'Document directory is unavailable for recovery points', {
      details: { reason: 'checkpoint_no_document_dir' },
    });
  }
  const info = await FileSystem.getInfoAsync(root);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(root, { intermediates: true });
  }
  return {
    async listIds() {
      const names = await FileSystem.readDirectoryAsync(root);
      return names.filter((name) => name.endsWith('.lumi-ckpt')).map((name) => name.slice(0, -10));
    },
    async readText(id) {
      const path = `${root}${id}.lumi-ckpt`;
      const exists = await FileSystem.getInfoAsync(path);
      if (!exists.exists) return null;
      return FileSystem.readAsStringAsync(path);
    },
    async writeText(id, text) {
      const path = `${root}${id}.lumi-ckpt`;
      const tmp = `${path}.tmp`;
      await FileSystem.writeAsStringAsync(tmp, text);
      const previous = await FileSystem.getInfoAsync(path);
      if (previous.exists) await FileSystem.deleteAsync(path, { idempotent: true });
      await FileSystem.moveAsync({ from: tmp, to: path });
    },
    async remove(id) {
      await FileSystem.deleteAsync(`${root}${id}.lumi-ckpt`, { idempotent: true });
      await FileSystem.deleteAsync(`${root}${id}.lumi-ckpt.tmp`, { idempotent: true });
    },
    async clearAll() {
      const names = await FileSystem.readDirectoryAsync(root);
      for (const name of names) {
        await FileSystem.deleteAsync(`${root}${name}`, { idempotent: true });
      }
    },
  };
}

export async function createSecureStoreCheckpointKeyVault(): Promise<CheckpointKeyVault> {
  const SecureStore = await import('expo-secure-store');
  return {
    async getOrCreateKey() {
      const existing = await SecureStore.getItemAsync(CHECKPOINT_KEY_ID);
      if (existing && /^[0-9a-f]{64}$/i.test(existing)) {
        return hexToBytes(existing);
      }
      const created = randomBytes(32);
      await SecureStore.setItemAsync(CHECKPOINT_KEY_ID, bytesToHex(created), {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
      return created;
    },
    async clearKey() {
      await SecureStore.deleteItemAsync(CHECKPOINT_KEY_ID);
    },
  };
}

export async function openPlatformLogicalCheckpointVault(): Promise<LogicalCheckpointVault> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Platform } = require('react-native') as { Platform: { OS: string } };
  if (Platform.OS === 'web') {
    return createLogicalCheckpointVault(createWebIndexedCheckpointBackend());
  }
  const files = await createNativeFileCheckpointStore();
  const keys = await createSecureStoreCheckpointKeyVault();
  return createLogicalCheckpointVault(createEncryptedFileCheckpointBackend(files, keys));
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
