/**
 * The SQLCipher key is a random 32-byte secret held only in the platform vault.
 * Types live apart from SecureStore so Node contract tests avoid loading Expo.
 */
export class DatabaseKeyStoreError extends Error {
  readonly code: 'UNAVAILABLE' | 'CORRUPT' | 'WRITE_FAILED' | 'READ_FAILED';

  constructor(code: DatabaseKeyStoreError['code'], message: string) {
    super(message);
    this.name = 'DatabaseKeyStoreError';
    this.code = code;
  }
}

export type DatabaseKeyStore = {
  /** Returns the existing key or creates one once; never silently rotates. */
  getOrCreateDatabaseKey(): Promise<Uint8Array>;
  /** Read-only probe used when the vault must not create a replacement key. */
  readDatabaseKey(): Promise<Uint8Array | null>;
  clearDatabaseKey(): Promise<void>;
};
