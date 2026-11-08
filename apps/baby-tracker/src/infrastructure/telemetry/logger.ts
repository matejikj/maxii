/**
 * Structured logging for the personal client. Only allowlisted field names may
 * leave the process so care notes, DOB and raw rows cannot leak into Metro,
 * crash reports or future analytics adapters.
 */
export const LOG_FIELD_ALLOWLIST = new Set([
  'code',
  'retryable',
  'platform',
  'operation',
  'durationMs',
  'count',
  'stage',
  'ok',
]);

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFields = Record<string, unknown>;

export type Logger = {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
};

export type LoggerSink = (line: string) => void;

const REDACTED = '[redacted]';

export function sanitizeLogFields(fields: LogFields | undefined): Record<string, string | number | boolean | null> {
  if (fields == null) {
    return {};
  }
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!LOG_FIELD_ALLOWLIST.has(key)) {
      out[key] = REDACTED;
      continue;
    }
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
      continue;
    }
    out[key] = REDACTED;
  }
  return out;
}

export function formatLogLine(level: LogLevel, message: string, fields?: LogFields): string {
  return JSON.stringify({
    level,
    message,
    fields: sanitizeLogFields(fields),
  });
}

export function createLogger(sink: LoggerSink = defaultSink): Logger {
  const write = (level: LogLevel, message: string, fields?: LogFields) => {
    sink(formatLogLine(level, message, fields));
  };
  return {
    debug: (message, fields) => write('debug', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
  };
}

function defaultSink(line: string): void {
  // Single JSON line keeps device log scraping predictable without dumping objects.
  console.log(line);
}
