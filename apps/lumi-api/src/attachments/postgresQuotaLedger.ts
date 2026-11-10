import type { PoolClient } from 'pg';
import { FAMILY_ATTACHMENT_QUOTA, planFamilyAttachmentReservation } from '@lumi/contracts';
import type { AppDbPool } from '../db/pool.ts';
import type { FamilyAttachmentQuotaPort } from './quotaLedger.ts';

type QuotaRow = { used: number; reserved: number };

/**
 * Durable quota ledger on `family_attachment_quota`. Every mutation locks the
 * family row with SELECT ... FOR UPDATE so parallel API workers cannot
 * double-spend the pending-reservation budget. No RLS — server-only table.
 */
export function createPostgresFamilyAttachmentQuotaLedger(
  pool: AppDbPool,
  input?: {
    readonly budgetBytes?: number;
    readonly pendingReservationBudgetBytes?: number;
  },
): FamilyAttachmentQuotaPort {
  const budgetBytes = input?.budgetBytes ?? FAMILY_ATTACHMENT_QUOTA.familyBudgetBytes;
  const pendingBudget =
    input?.pendingReservationBudgetBytes ??
    FAMILY_ATTACHMENT_QUOTA.pendingReservationBudgetBytes;

  async function lockRow(client: PoolClient, familyId: string): Promise<QuotaRow> {
    await client.query(
      `insert into family_attachment_quota (family_id) values ($1)
       on conflict (family_id) do nothing`,
      [familyId],
    );
    const result = await client.query(
      `select used_bytes, reserved_bytes from family_attachment_quota
       where family_id = $1 for update`,
      [familyId],
    );
    const row = result.rows[0] as { used_bytes: string; reserved_bytes: string };
    return { used: Number(row.used_bytes), reserved: Number(row.reserved_bytes) };
  }

  async function writeRow(client: PoolClient, familyId: string, next: QuotaRow): Promise<void> {
    await client.query(
      `update family_attachment_quota
       set used_bytes = $2, reserved_bytes = $3, updated_at = now()
       where family_id = $1`,
      [familyId, next.used, next.reserved],
    );
  }

  async function withLockedRow<T>(
    familyId: string,
    run: (row: QuotaRow, client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const row = await lockRow(client, familyId);
      const result = await run(row, client);
      await client.query('commit');
      return result;
    } catch (error) {
      try {
        await client.query('rollback');
      } catch {
        // ignore rollback failure after the original error
      }
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    async view(familyId: string) {
      const result = await pool.query(
        `select used_bytes, reserved_bytes from family_attachment_quota where family_id = $1`,
        [familyId],
      );
      const row = result.rows[0] as { used_bytes: string; reserved_bytes: string } | undefined;
      const usedBytes = row ? Number(row.used_bytes) : 0;
      const reservedBytes = row ? Number(row.reserved_bytes) : 0;
      return {
        familyId,
        budgetBytes,
        usedBytes,
        reservedBytes,
        remainingBytes: Math.max(0, budgetBytes - usedBytes - reservedBytes),
      };
    },

    async reserve(familyId: string, requestBytes: number) {
      return withLockedRow(familyId, async (row, client) => {
        const plan = planFamilyAttachmentReservation({
          budgetBytes,
          usedBytes: row.used,
          reservedBytes: row.reserved,
          pendingReservationBudgetBytes: pendingBudget,
          requestBytes,
        });
        if (!plan.ok) return plan;
        await writeRow(client, familyId, { used: row.used, reserved: plan.nextReservedBytes });
        return { ok: true as const, reservedBytes: requestBytes };
      });
    },

    async commitReservation(familyId: string, reservedBytes: number) {
      await withLockedRow(familyId, async (row, client) => {
        await writeRow(client, familyId, {
          used: row.used + reservedBytes,
          reserved: Math.max(0, row.reserved - reservedBytes),
        });
      });
    },

    async releaseReservation(familyId: string, reservedBytes: number) {
      await withLockedRow(familyId, async (row, client) => {
        await writeRow(client, familyId, {
          used: row.used,
          reserved: Math.max(0, row.reserved - reservedBytes),
        });
      });
    },

    async releaseUsed(familyId: string, usedBytes: number) {
      await withLockedRow(familyId, async (row, client) => {
        await writeRow(client, familyId, {
          used: Math.max(0, row.used - usedBytes),
          reserved: row.reserved,
        });
      });
    },
  };
}
