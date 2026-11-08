import { bytesToHex } from '@noble/hashes/utils.js';

export class EncryptedDatabaseError extends Error {
  readonly code:
    | 'CIPHER_UNAVAILABLE'
    | 'KEY_REQUIRED'
    | 'OPEN_FAILED'
    | 'INTEGRITY_FAILED';

  constructor(code: EncryptedDatabaseError['code'], message: string) {
    super(message);
    this.name = 'EncryptedDatabaseError';
    this.code = code;
  }
}

type CipherQueryable = {
  getFirstAsync<T>(source: string): Promise<T | null>;
  closeAsync(): Promise<void>;
};

/**
 * Applies the vault key as a SQLCipher passphrase. Expo's Android SQLCipher
 * build accepts `PRAGMA key = '…'` reliably; the raw `x'hex'` form has been
 * observed to leave connections unreadable (`file is not a database`).
 * Hex encoding keeps the 32-byte secret high-entropy and quote-safe.
 */
export function sqlCipherKeyPragma(key: Uint8Array): string {
  if (key.byteLength === 0) {
    throw new EncryptedDatabaseError('KEY_REQUIRED', 'SQLCipher key must not be empty.');
  }
  return `PRAGMA key = '${bytesToHex(key)}'`;
}

/**
 * Private care records require a binary that actually embeds SQLCipher. When
 * cipher_version is missing, SQLite would silently ignore PRAGMA key and store
 * plaintext — that path is refused here before any private table is created.
 */
export async function assertSqlCipherAvailable(
  openMemory: () => CipherQueryable,
): Promise<string> {
  const db = openMemory();
  try {
    const row = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version');
    if (row?.cipher_version == null || row.cipher_version.length === 0) {
      throw new EncryptedDatabaseError(
        'CIPHER_UNAVAILABLE',
        'SQLCipher is not present in this binary. Rebuild with expo-sqlite useSQLCipher enabled; refusing plaintext private storage.',
      );
    }
    return row.cipher_version;
  } finally {
    await db.closeAsync();
  }
}
