import { randomUUID } from 'node:crypto';
import pg from 'pg';
import type { AppUserId, FamilyId } from '@lumi/contracts';

/**
 * Mirrors an in-memory family membership into Compose Postgres so attachment
 * RLS policies can authorize the same principal the HTTP API already trusted.
 */
export async function seedFamilyAttachmentTenant(input: {
  readonly adminDatabaseUrl: string;
  readonly appUserId: AppUserId;
  readonly familyId: FamilyId;
  readonly role?: 'admin' | 'caregiver';
  readonly displayName?: string;
}): Promise<void> {
  const client = new pg.Client({
    connectionString: input.adminDatabaseUrl,
    connectionTimeoutMillis: 5_000,
  });
  await client.connect();
  try {
    await client.query('begin');
    await client.query(
      `insert into app_user (app_user_id, status) values ($1, 'active')
       on conflict (app_user_id) do nothing`,
      [input.appUserId],
    );
    await client.query(
      `insert into family (family_id, display_name, created_by)
       values ($1, $2, $3)
       on conflict (family_id) do nothing`,
      [input.familyId, input.displayName ?? 'attachment-tenant', input.appUserId],
    );
    await client.query(
      `insert into family_membership (membership_id, family_id, app_user_id, role, status)
       values ($1, $2, $3, $4, 'active')
       on conflict (family_id, app_user_id) do update set
         role = excluded.role,
         status = 'active'`,
      [randomUUID(), input.familyId, input.appUserId, input.role ?? 'admin'],
    );
    await client.query('commit');
  } catch (error) {
    try {
      await client.query('rollback');
    } catch {
      // ignore
    }
    throw error;
  } finally {
    await client.end();
  }
}
