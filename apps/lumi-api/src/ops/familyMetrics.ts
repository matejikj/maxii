/**
 * In-process family API/ops counters. Only technical codes and path classes —
 * never notes, DOB, invitation secrets, or diary payloads.
 */

export type FamilyOpsPathClass =
  | 'health'
  | 'auth'
  | 'family'
  | 'sync'
  | 'backup'
  | 'ops'
  | 'other';

export type FamilyOpsMetricEvent = {
  readonly atMs: number;
  readonly pathClass: FamilyOpsPathClass;
  readonly method: string;
  readonly statusClass: '2xx' | '4xx' | '5xx' | 'other';
  readonly rejected: boolean;
  readonly durationMs: number;
  readonly code?: string;
};

export type FamilyOpsMetricsSnapshot = {
  readonly requestCount: number;
  readonly rejectedCount: number;
  readonly serverErrorCount: number;
  readonly byPathClass: Readonly<
    Record<FamilyOpsPathClass, { ok: number; rejected: number; serverError: number }>
  >;
  readonly queueBacklog: number | null;
  readonly syncLagSamplesMs: readonly number[];
  readonly maxSyncLagMs: number | null;
  readonly backup: {
    readonly lastCompletedAtMs: number | null;
    readonly lastAttemptAtMs: number | null;
    readonly lastAttemptOk: boolean | null;
    readonly failedAttempts: number;
  };
  readonly recent: readonly FamilyOpsMetricEvent[];
};

export type FamilyOpsMetrics = {
  recordRequest(
    event: Omit<FamilyOpsMetricEvent, 'atMs'> & { readonly atMs?: number },
  ): void;
  recordSyncLagMs(lagMs: number, atMs?: number): void;
  recordBackupAttempt(input: {
    readonly ok: boolean;
    readonly atMs?: number;
    readonly completedAtMs?: number;
  }): void;
  setQueueBacklog(count: number | null): void;
  snapshot(): FamilyOpsMetricsSnapshot;
  clear(): void;
};

const PATH_CLASSES: readonly FamilyOpsPathClass[] = [
  'health',
  'auth',
  'family',
  'sync',
  'backup',
  'ops',
  'other',
];

const MAX_RECENT = 64;
const MAX_LAG_SAMPLES = 32;

export function classifyFamilyOpsPath(url: string): FamilyOpsPathClass {
  const path = url.split('?')[0] ?? url;
  if (path === '/health' || path === '/ready') return 'health';
  if (path.startsWith('/v1/auth') || path.startsWith('/v1/me')) return 'auth';
  if (path.includes('/backup') || path.includes('/recovery') || path.includes('/erasure')) {
    return 'backup';
  }
  if (path.includes('/sync')) return 'sync';
  if (path.startsWith('/v1/ops')) return 'ops';
  if (path.startsWith('/v1/families') || path.startsWith('/v1/objects')) return 'family';
  return 'other';
}

export function statusClassOf(statusCode: number): FamilyOpsMetricEvent['statusClass'] {
  if (statusCode >= 200 && statusCode < 300) return '2xx';
  if (statusCode >= 400 && statusCode < 500) return '4xx';
  if (statusCode >= 500 && statusCode < 600) return '5xx';
  return 'other';
}

function emptyBuckets(): Record<
  FamilyOpsPathClass,
  { ok: number; rejected: number; serverError: number }
> {
  return {
    health: { ok: 0, rejected: 0, serverError: 0 },
    auth: { ok: 0, rejected: 0, serverError: 0 },
    family: { ok: 0, rejected: 0, serverError: 0 },
    sync: { ok: 0, rejected: 0, serverError: 0 },
    backup: { ok: 0, rejected: 0, serverError: 0 },
    ops: { ok: 0, rejected: 0, serverError: 0 },
    other: { ok: 0, rejected: 0, serverError: 0 },
  };
}

export function createFamilyOpsMetrics(
  options: { readonly nowMs?: () => number; readonly maxRecent?: number } = {},
): FamilyOpsMetrics {
  const nowMs = options.nowMs ?? (() => Date.now());
  const maxRecent = options.maxRecent ?? MAX_RECENT;
  let requestCount = 0;
  let rejectedCount = 0;
  let serverErrorCount = 0;
  const byPathClass = emptyBuckets();
  const recent: FamilyOpsMetricEvent[] = [];
  const syncLagSamplesMs: number[] = [];
  let queueBacklog: number | null = null;
  let lastCompletedAtMs: number | null = null;
  let lastAttemptAtMs: number | null = null;
  let lastAttemptOk: boolean | null = null;
  let failedAttempts = 0;

  return {
    recordRequest(event) {
      const entry: FamilyOpsMetricEvent = {
        atMs: event.atMs ?? nowMs(),
        pathClass: PATH_CLASSES.includes(event.pathClass) ? event.pathClass : 'other',
        method: event.method.slice(0, 16),
        statusClass: event.statusClass,
        rejected: event.rejected,
        durationMs: Math.max(0, Math.round(event.durationMs)),
        ...(typeof event.code === 'string' ? { code: event.code.slice(0, 64) } : {}),
      };
      requestCount += 1;
      const bucket = byPathClass[entry.pathClass];
      if (entry.statusClass === '5xx') {
        serverErrorCount += 1;
        bucket.serverError += 1;
      } else if (entry.rejected || entry.statusClass === '4xx') {
        rejectedCount += 1;
        bucket.rejected += 1;
      } else {
        bucket.ok += 1;
      }
      recent.push(entry);
      while (recent.length > maxRecent) recent.shift();
    },

    recordSyncLagMs(lagMs) {
      if (!Number.isFinite(lagMs) || lagMs < 0) return;
      syncLagSamplesMs.push(Math.round(lagMs));
      while (syncLagSamplesMs.length > MAX_LAG_SAMPLES) syncLagSamplesMs.shift();
    },

    recordBackupAttempt(input) {
      const at = input.atMs ?? nowMs();
      lastAttemptAtMs = at;
      lastAttemptOk = input.ok;
      if (input.ok) {
        lastCompletedAtMs = input.completedAtMs ?? at;
      } else {
        failedAttempts += 1;
      }
    },

    setQueueBacklog(count) {
      queueBacklog = count == null || !Number.isFinite(count) ? null : Math.max(0, Math.floor(count));
    },

    snapshot() {
      return {
        requestCount,
        rejectedCount,
        serverErrorCount,
        byPathClass: {
          health: { ...byPathClass.health },
          auth: { ...byPathClass.auth },
          family: { ...byPathClass.family },
          sync: { ...byPathClass.sync },
          backup: { ...byPathClass.backup },
          ops: { ...byPathClass.ops },
          other: { ...byPathClass.other },
        },
        queueBacklog,
        syncLagSamplesMs: [...syncLagSamplesMs],
        maxSyncLagMs:
          syncLagSamplesMs.length === 0 ? null : Math.max(...syncLagSamplesMs),
        backup: {
          lastCompletedAtMs,
          lastAttemptAtMs,
          lastAttemptOk,
          failedAttempts,
        },
        recent: [...recent],
      };
    },

    clear() {
      requestCount = 0;
      rejectedCount = 0;
      serverErrorCount = 0;
      for (const key of PATH_CLASSES) {
        byPathClass[key] = { ok: 0, rejected: 0, serverError: 0 };
      }
      recent.length = 0;
      syncLagSamplesMs.length = 0;
      queueBacklog = null;
      lastCompletedAtMs = null;
      lastAttemptAtMs = null;
      lastAttemptOk = null;
      failedAttempts = 0;
    },
  };
}
