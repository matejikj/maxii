import { AppError } from '../../../domain/errors';
import type { Instant } from '../../../domain/ports/clock';
import { assertSchemaCompatibleWithBinary } from '../../../ops/schemaCompatibility';
import type { SqlConnection } from './sqlConnection';
import { SCHEMA_V1_CHECKSUM, SCHEMA_V1_STATEMENTS, SCHEMA_VERSION_1 } from './schema/v1';
import { SCHEMA_V2_CHECKSUM, SCHEMA_V2_STATEMENTS, SCHEMA_VERSION_2 } from './schema/v2';
import { SCHEMA_V3_CHECKSUM, SCHEMA_V3_STATEMENTS, SCHEMA_VERSION_3 } from './schema/v3';
import { SCHEMA_V4_CHECKSUM, SCHEMA_V4_STATEMENTS, SCHEMA_VERSION_4 } from './schema/v4';
import { SCHEMA_V5_CHECKSUM, SCHEMA_V5_STATEMENTS, SCHEMA_VERSION_5 } from './schema/v5';
import { SCHEMA_V6_CHECKSUM, SCHEMA_V6_STATEMENTS, SCHEMA_VERSION_6 } from './schema/v6';
import { SCHEMA_V7_CHECKSUM, SCHEMA_V7_STATEMENTS, SCHEMA_VERSION_7 } from './schema/v7';
import type { CheckpointStore } from './checkpoint';

export type Migration = {
  version: number;
  checksum: string;
  statements: readonly string[];
};

export const MIGRATIONS: readonly Migration[] = [
  {
    version: SCHEMA_VERSION_1,
    checksum: SCHEMA_V1_CHECKSUM,
    statements: SCHEMA_V1_STATEMENTS,
  },
  {
    version: SCHEMA_VERSION_2,
    checksum: SCHEMA_V2_CHECKSUM,
    statements: SCHEMA_V2_STATEMENTS,
  },
  {
    version: SCHEMA_VERSION_3,
    checksum: SCHEMA_V3_CHECKSUM,
    statements: SCHEMA_V3_STATEMENTS,
  },
  {
    version: SCHEMA_VERSION_4,
    checksum: SCHEMA_V4_CHECKSUM,
    statements: SCHEMA_V4_STATEMENTS,
  },
  {
    version: SCHEMA_VERSION_5,
    checksum: SCHEMA_V5_CHECKSUM,
    statements: SCHEMA_V5_STATEMENTS,
  },
  {
    version: SCHEMA_VERSION_6,
    checksum: SCHEMA_V6_CHECKSUM,
    statements: SCHEMA_V6_STATEMENTS,
  },
  {
    version: SCHEMA_VERSION_7,
    checksum: SCHEMA_V7_CHECKSUM,
    statements: SCHEMA_V7_STATEMENTS,
  },
];

export type MigrationResult = {
  fromVersion: number;
  toVersion: number;
  checkpointId: string | null;
};

/**
 * Applies pending migrations behind a pre-migration checkpoint. Failure keeps
 * the previous durable DB; a half-applied schema is rolled back by transaction.
 */
export async function applyPendingMigrations(
  db: SqlConnection,
  options: {
    now: Instant;
    checkpointStore: CheckpointStore;
    databaseName: string;
    /** When false, refuse to start if a checkpoint cannot be created. */
    requireCheckpoint?: boolean;
    /**
     * SQLCipher connections can reject further SQL after serializeAsync
     * ("file is not a database"). Callers re-apply PRAGMA key here.
     */
    afterCheckpoint?: () => Promise<void>;
  },
): Promise<MigrationResult> {
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      checksum TEXT NOT NULL,
      applied_at_ms INTEGER NOT NULL
    )`,
  );

  const current = await currentSchemaVersion(db);
  // Refuse diaries written by a newer binary before attempting unknown migrations.
  if (current > 0) {
    assertSchemaCompatibleWithBinary({
      platform: 'native',
      databaseSchemaVersion: current,
    });
  }
  const pending = MIGRATIONS.filter((migration) => migration.version > current);
  if (pending.length === 0) {
    return { fromVersion: current, toVersion: current, checkpointId: null };
  }

  const requireCheckpoint = options.requireCheckpoint ?? true;
  let checkpointId: string | null = null;
  if (requireCheckpoint) {
    // First install has no diary bytes to restore. Calling serializeAsync on a
    // freshly keyed SQLCipher connection can leave it unreadable
    // ("file is not a database") on Android release builds.
    const serialize =
      current === 0
        ? async () => new TextEncoder().encode('lumi.empty-pre-schema')
        : () => db.serializeAsync();
    checkpointId = await options.checkpointStore.createPreMigrationCheckpoint({
      databaseName: options.databaseName,
      fromVersion: current,
      serialize,
      now: options.now,
    });
    if (current > 0 && options.afterCheckpoint) {
      await options.afterCheckpoint();
    }
  }

  try {
    for (const migration of pending) {
      // Stay on the keyed connection. withExclusiveTransactionAsync can surface
      // "file is not a database" with SQLCipher when the txn handle loses the key.
      await db.execAsync('BEGIN IMMEDIATE');
      try {
        for (const statement of migration.statements) {
          // schema_migrations bootstrap DDL is idempotent; skip re-create in v1 body.
          if (
            migration.version === SCHEMA_VERSION_1 &&
            statement.startsWith('CREATE TABLE schema_migrations')
          ) {
            continue;
          }
          await db.execAsync(statement);
        }
        await db.runAsync(
          `INSERT INTO schema_migrations (version, checksum, applied_at_ms) VALUES (?, ?, ?)`,
          migration.version,
          migration.checksum,
          options.now.epochMs,
        );
        await db.execAsync('COMMIT');
      } catch (error) {
        await db.execAsync('ROLLBACK').catch(() => undefined);
        throw error;
      }
    }
  } catch (error) {
    throw new AppError(
      'STORAGE',
      'Migration failed; previous checkpoint remains the recovery source',
      {
        details: {
          fromVersion: current,
          checkpointId: checkpointId ?? 'none',
          reason: error instanceof Error ? error.message.slice(0, 120) : 'unknown',
        },
        retryable: false,
        cause: error,
      },
    );
  }

  const toVersion = pending[pending.length - 1]!.version;
  return { fromVersion: current, toVersion, checkpointId };
}

export async function currentSchemaVersion(db: SqlConnection): Promise<number> {
  try {
    const row = await db.getFirstAsync<{ version: number }>(
      'SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations',
    );
    return row?.version ?? 0;
  } catch {
    return 0;
  }
}

export async function assertMigrationChecksums(db: SqlConnection): Promise<void> {
  const rows = await db.getAllAsync<{ version: number; checksum: string }>(
    'SELECT version, checksum FROM schema_migrations ORDER BY version',
  );
  for (const row of rows) {
    const expected = MIGRATIONS.find((migration) => migration.version === row.version);
    if (expected == null) {
      throw new AppError('STORAGE', 'Unknown migration version present in database', {
        details: { version: row.version },
      });
    }
    if (expected.checksum !== row.checksum) {
      throw new AppError('STORAGE', 'Migration checksum mismatch; refusing to open private DB', {
        details: { version: row.version },
      });
    }
  }
}
