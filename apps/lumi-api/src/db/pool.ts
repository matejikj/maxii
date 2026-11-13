import pg from 'pg';
import type { AppUserId, FamilyId } from '@lumi/contracts';

const { Pool } = pg;

export type AppDbPool = InstanceType<typeof Pool>;

/**
 * Runtime pool for the non-owner application role. Migrations and backups use
 * separate credentials so RLS cannot be bypassed by accident.
 */
export function createAppDbPool(databaseUrl: string): AppDbPool {
  return new Pool({
    connectionString: databaseUrl,
    max: 8,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
}

/**
 * Sets per-transaction GUCs consumed by RLS policies. Clearing happens with
 * the transaction end so pooled connections never leak another family's context.
 */
export async function withTenantTransaction<T>(
  pool: AppDbPool,
  input: {
    readonly appUserId: AppUserId;
    readonly familyId: FamilyId | null;
  },
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`select set_config('lumi.app_user_id', $1, true)`, [input.appUserId]);
    await client.query(`select set_config('lumi.family_id', $1, true)`, [input.familyId ?? '']);
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    try {
      await client.query('rollback');
    } catch {
      // ignore rollback failures after the original error
    }
    throw error;
  } finally {
    client.release();
  }
}
