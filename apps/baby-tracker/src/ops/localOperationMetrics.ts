import { LOG_FIELD_ALLOWLIST, sanitizeLogFields } from '../infrastructure/telemetry/logger';

/**
 * Local-only counters for care command outcomes. No child names, notes, DOB or
 * free-text payloads — only allowlisted technical codes.
 */
export type LocalOperationMetricEvent = {
  atMs: number;
  operation: string;
  ok: boolean;
  code: string;
  durationMs: number;
  platform: string;
};

export type LocalOperationMetricsSnapshot = {
  successCount: number;
  failureCount: number;
  byOperation: Record<string, { ok: number; fail: number }>;
  recent: LocalOperationMetricEvent[];
};

const MAX_RECENT = 40;

export type LocalOperationMetrics = {
  record(event: Omit<LocalOperationMetricEvent, 'atMs'> & { atMs?: number }): void;
  snapshot(): LocalOperationMetricsSnapshot;
  clear(): void;
};

export function createLocalOperationMetrics(
  options: { nowMs?: () => number; maxRecent?: number } = {},
): LocalOperationMetrics {
  const nowMs = options.nowMs ?? (() => Date.now());
  const maxRecent = options.maxRecent ?? MAX_RECENT;
  let successCount = 0;
  let failureCount = 0;
  const byOperation: Record<string, { ok: number; fail: number }> = {};
  const recent: LocalOperationMetricEvent[] = [];

  return {
    record(event) {
      const sanitized = sanitizeLogFields({
        operation: event.operation,
        ok: event.ok,
        code: event.code,
        durationMs: event.durationMs,
        platform: event.platform,
      });
      // Drop the event entirely if sanitization could not keep required fields.
      if (
        typeof sanitized.operation !== 'string' ||
        typeof sanitized.code !== 'string' ||
        typeof sanitized.ok !== 'boolean' ||
        typeof sanitized.durationMs !== 'number'
      ) {
        return;
      }
      const entry: LocalOperationMetricEvent = {
        atMs: event.atMs ?? nowMs(),
        operation: sanitized.operation,
        ok: sanitized.ok,
        code: sanitized.code,
        durationMs: sanitized.durationMs,
        platform: typeof sanitized.platform === 'string' ? sanitized.platform : 'unknown',
      };
      if (entry.ok) successCount += 1;
      else failureCount += 1;
      const bucket = byOperation[entry.operation] ?? { ok: 0, fail: 0 };
      if (entry.ok) bucket.ok += 1;
      else bucket.fail += 1;
      byOperation[entry.operation] = bucket;
      recent.push(entry);
      while (recent.length > maxRecent) recent.shift();
    },
    snapshot() {
      return {
        successCount,
        failureCount,
        byOperation: { ...byOperation },
        recent: [...recent],
      };
    },
    clear() {
      successCount = 0;
      failureCount = 0;
      for (const key of Object.keys(byOperation)) delete byOperation[key];
      recent.length = 0;
    },
  };
}

/** Guard used by tests: metric field names must stay inside the logger allowlist. */
export function metricFieldNames(): string[] {
  return ['operation', 'ok', 'code', 'durationMs', 'platform', 'atMs'].filter((name) =>
    name === 'atMs' ? true : LOG_FIELD_ALLOWLIST.has(name),
  );
}
