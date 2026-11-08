import { AppError } from '../../../domain/errors';
import type { Instant } from '../../../domain/ports/clock';
import type { SqlConnection } from './sqlConnection';
import { SCHEMA_V1_CHECKSUM, SCHEMA_V1_STATEMENTS, SCHEMA_VERSION_1 } from './schema/v1';
import { SCHEMA_V2_CHECKSUM, SCHEMA_V2_STATEMENTS, SCHEMA_VERSION_2 } from './schema/v2';
import { SCHEMA_V3_CHECKSUM, SCHEMA_V3_STATEMENTS, SCHEMA_VERSION_3 } from './schema/v3';
import { SCHEMA_V4_CHECKSUM, SCHEMA_V4_STATEMENTS, SCHEMA_VERSION_4 } from './schema/v4';
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
  const pending = MIGRATIONS.filter((migration) => migration.version > current);
  if (pending.length === 0) {
    return { fromVersion: current, toVersion: current, checkpointId: null };
  }

  const requireCheckpoint = options.requireCheckpoint ?? true;
  let checkpointId: string | null = null;
  if (requireCheckpoint) {
    checkpointId = await options.checkpointStore.createPreMigrationCheckpoint({
      databaseName: options.databaseName,
      fromVersion: current,
      serialize: () => db.serializeAsync(),
      now: options.now,
    });
  }

  try {
    for (const migration of pending) {
      await db.withExclusiveTransactionAsync(async (txn) => {
        for (const statement of migration.statements) {
          // schema_migrations bootstrap DDL is idempotent; skip re-create in v1 body.
          if (
            migration.version === SCHEMA_VERSION_1 &&
            statement.startsWith('CREATE TABLE schema_migrations')
          ) {
            continue;
          }
          await txn.execAsync(statement);
        }
        await txn.runAsync(
          `INSERT INTO schema_migrations (version, checksum, applied_at_ms) VALUES (?, ?, ?)`,
          migration.version,
          migration.checksum,
          options.now.epochMs,
        );
      });
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
