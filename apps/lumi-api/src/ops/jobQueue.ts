import { randomUUID } from 'node:crypto';
import type { AppDbPool } from '../db/pool.ts';

export type WorkerJobKind =
  | 'health.ping'
  | 'ops.noop'
  | 'backup.daily'
  | 'backup.retention.prune'
  | 'erasure.registry.sync'
  /** Handler should call `attachments.cleanupExpiredIntents(Date.now())`. */
  | 'attachment.intent.expire';

export type WorkerJob = {
  readonly jobId: string;
  readonly kind: WorkerJobKind;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly attempts: number;
};

export type JobQueue = {
  enqueue: (kind: WorkerJobKind, payload?: Readonly<Record<string, unknown>>) => Promise<string>;
  claim: (workerId: string, leaseMs: number) => Promise<WorkerJob | null>;
  complete: (jobId: string, workerId: string) => Promise<boolean>;
  fail: (jobId: string, workerId: string, error: string) => Promise<boolean>;
  pendingCount: () => Promise<number>;
};

type MemoryRow = {
  jobId: string;
  kind: WorkerJobKind;
  payload: Readonly<Record<string, unknown>>;
  status: 'pending' | 'leased' | 'done' | 'failed';
  availableAtMs: number;
  leaseOwner: string | null;
  leaseExpiresAtMs: number | null;
  attempts: number;
  lastError: string | null;
};

/** In-memory queue for unit proofs of exclusive leases without PostgreSQL. */
export function createMemoryJobQueue(nowMs: () => number = () => Date.now()): JobQueue {
  const rows: MemoryRow[] = [];

  return {
    async enqueue(kind, payload = {}) {
      const jobId = randomUUID();
      rows.push({
        jobId,
        kind,
        payload,
        status: 'pending',
        availableAtMs: nowMs(),
        leaseOwner: null,
        leaseExpiresAtMs: null,
        attempts: 0,
        lastError: null,
      });
      return jobId;
    },

    async claim(workerId, leaseMs) {
      const now = nowMs();
      const row = rows.find(
        (item) =>
          (item.status === 'pending' && item.availableAtMs <= now) ||
          (item.status === 'leased' &&
            item.leaseExpiresAtMs != null &&
            item.leaseExpiresAtMs <= now),
      );
      if (!row) return null;
      row.status = 'leased';
      row.leaseOwner = workerId;
      row.leaseExpiresAtMs = now + leaseMs;
      row.attempts += 1;
      return {
        jobId: row.jobId,
        kind: row.kind,
        payload: row.payload,
        attempts: row.attempts,
      };
    },

    async complete(jobId, workerId) {
      const row = rows.find((item) => item.jobId === jobId);
      if (!row || row.leaseOwner !== workerId || row.status !== 'leased') return false;
      row.status = 'done';
      row.leaseOwner = null;
      row.leaseExpiresAtMs = null;
      return true;
    },

    async fail(jobId, workerId, error) {
      const row = rows.find((item) => item.jobId === jobId);
      if (!row || row.leaseOwner !== workerId || row.status !== 'leased') return false;
      row.status = 'failed';
      row.lastError = error;
      row.leaseOwner = null;
      row.leaseExpiresAtMs = null;
      return true;
    },

    async pendingCount() {
      const now = nowMs();
      return rows.filter(
        (item) =>
          item.status === 'pending' ||
          (item.status === 'leased' &&
            item.leaseExpiresAtMs != null &&
            item.leaseExpiresAtMs <= now),
      ).length;
    },
  };
}

/**
 * PostgreSQL-backed queue. Claim uses a single UPDATE … RETURNING so two
 * workers cannot lease the same job.
 */
export function createPostgresJobQueue(pool: AppDbPool): JobQueue {
  return {
    async enqueue(kind, payload = {}) {
      const jobId = randomUUID();
      await pool.query(
        `insert into worker_job (job_id, kind, payload_json, status)
         values ($1, $2, $3::jsonb, 'pending')`,
        [jobId, kind, JSON.stringify(payload)],
      );
      return jobId;
    },

    async claim(workerId, leaseMs) {
      const result = await pool.query(
        `with next_job as (
           select job_id
           from worker_job
           where (
             status = 'pending' and available_at <= now()
           ) or (
             status = 'leased' and lease_expires_at is not null and lease_expires_at <= now()
           )
           order by created_at
           for update skip locked
           limit 1
         )
         update worker_job j
         set status = 'leased',
             lease_owner = $1,
             lease_expires_at = now() + make_interval(secs => $2::double precision / 1000.0),
             attempts = j.attempts + 1,
             updated_at = now()
         from next_job
         where j.job_id = next_job.job_id
         returning j.job_id, j.kind, j.payload_json, j.attempts`,
        [workerId, leaseMs],
      );
      const row = result.rows[0] as
        | { job_id: string; kind: WorkerJobKind; payload_json: Record<string, unknown>; attempts: number }
        | undefined;
      if (!row) return null;
      return {
        jobId: row.job_id,
        kind: row.kind,
        payload: row.payload_json ?? {},
        attempts: row.attempts,
      };
    },

    async complete(jobId, workerId) {
      const result = await pool.query(
        `update worker_job
         set status = 'done', lease_owner = null, lease_expires_at = null, updated_at = now()
         where job_id = $1 and lease_owner = $2 and status = 'leased'`,
        [jobId, workerId],
      );
      return (result.rowCount ?? 0) > 0;
    },

    async fail(jobId, workerId, error) {
      const result = await pool.query(
        `update worker_job
         set status = 'failed', last_error = $3, lease_owner = null, lease_expires_at = null, updated_at = now()
         where job_id = $1 and lease_owner = $2 and status = 'leased'`,
        [jobId, workerId, error.slice(0, 500)],
      );
      return (result.rowCount ?? 0) > 0;
    },

    async pendingCount() {
      const result = await pool.query(
        `select count(*)::int as c from worker_job
         where status = 'pending'
            or (status = 'leased' and lease_expires_at is not null and lease_expires_at <= now())`,
      );
      return Number(result.rows[0]?.c ?? 0);
    },
  };
}
