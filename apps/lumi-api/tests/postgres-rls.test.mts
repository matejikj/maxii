import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createAppDbPool, withTenantTransaction } from '../src/db/pool.ts';
import type { AppUserId, FamilyId } from '@lumi/contracts';

const databaseUrl =
  process.env.LUMI_DATABASE_URL?.trim() ||
  'postgres://lumi_app:lumi_app_dev_only@127.0.0.1:5433/lumi_app';
const adminUrl =
  process.env.LUMI_DATABASE_ADMIN_URL?.trim() ||
  'postgres://postgres:postgres_dev_only@127.0.0.1:5433/lumi_app';

async function postgresAvailable(url: string): Promise<boolean> {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 1500 });
  try {
    await client.connect();
    await client.query('select 1');
    await client.end();
    return true;
  } catch {
    try {
      await client.end();
    } catch {
      // ignore
    }
    return false;
  }
}

test('RLS blocks cross-family object reads on pooled connections', async (t) => {
  if (!(await postgresAvailable(adminUrl))) {
    t.skip('PostgreSQL is not reachable on the compose port');
    return;
  }

  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();

  const userA = randomUUID();
  const userB = randomUUID();
  const familyA = randomUUID();
  const familyB = randomUUID();
  const objectA = randomUUID();

  await admin.query('begin');
  await admin.query(
    `insert into app_user (app_user_id, status) values ($1, 'active'), ($2, 'active')`,
    [userA, userB],
  );
  await admin.query(
    `insert into family (family_id, display_name, created_by) values ($1, 'A', $2), ($3, 'B', $4)`,
    [familyA, userA, familyB, userB],
  );
  await admin.query(
    `insert into family_membership (membership_id, family_id, app_user_id, role, status)
     values ($1, $2, $3, 'admin', 'active'), ($4, $5, $6, 'admin', 'active')`,
    [randomUUID(), familyA, userA, randomUUID(), familyB, userB],
  );
  await admin.query(
    `insert into family_object (object_id, family_id, kind, label) values ($1, $2, 'note', 'secret-a')`,
    [objectA, familyA],
  );
  await admin.query('commit');
  await admin.end();

  const pool = createAppDbPool(databaseUrl);
  try {
    const allowed = await withTenantTransaction(
      pool,
      { appUserId: userA as AppUserId, familyId: familyA as FamilyId },
      async (client) => {
        const result = await client.query(`select label from family_object where object_id = $1`, [
          objectA,
        ]);
        return result.rows[0]?.label as string | undefined;
      },
    );
    assert.equal(allowed, 'secret-a');

    const denied = await withTenantTransaction(
      pool,
      { appUserId: userB as AppUserId, familyId: familyA as FamilyId },
      async (client) => {
        const result = await client.query(`select label from family_object where object_id = $1`, [
          objectA,
        ]);
        return result.rowCount;
      },
    );
    assert.equal(denied, 0);

    // Prove the previous tenant GUC did not stick on the pooled connection.
    const leaked = await withTenantTransaction(
      pool,
      { appUserId: userB as AppUserId, familyId: familyB as FamilyId },
      async (client) => {
        const result = await client.query(`select label from family_object where object_id = $1`, [
          objectA,
        ]);
        return result.rowCount;
      },
    );
    assert.equal(leaked, 0);
  } finally {
    await pool.end();
  }
});
