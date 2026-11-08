/**
 * Narrow SQL surface used by the private diary. Keeping this interface lets
 * Node contract tests drive the same UnitOfWork/migration code as expo-sqlite.
 */
export type SqlBindValue = string | number | null | Uint8Array;

export type SqlConnection = {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: SqlBindValue[]): Promise<{ changes: number }>;
  getFirstAsync<T>(source: string, ...params: SqlBindValue[]): Promise<T | null>;
  getAllAsync<T>(source: string, ...params: SqlBindValue[]): Promise<T[]>;
  withExclusiveTransactionAsync(task: (txn: SqlConnection) => Promise<void>): Promise<void>;
  serializeAsync(): Promise<Uint8Array>;
  closeAsync(): Promise<void>;
};

export type SqlDatabaseOpener = {
  open(name: string): Promise<SqlConnection>;
  delete(name: string): Promise<void>;
  /** True when a durable ciphertext file for this name already exists. */
  exists(name: string): Promise<boolean>;
};
