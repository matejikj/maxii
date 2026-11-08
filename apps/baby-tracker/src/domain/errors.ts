/**
 * Product failures are typed codes plus a safe public message. Details may hold
 * only allowlisted diagnostics — never care notes, DOB, or raw DB rows.
 */
export type AppErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'STORAGE'
  | 'CRYPTO'
  | 'UNAVAILABLE'
  | 'INTERNAL';

export type AppErrorDetails = Record<string, string | number | boolean | null>;

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details: AppErrorDetails;
  readonly retryable: boolean;

  constructor(
    code: AppErrorCode,
    message: string,
    options: { details?: AppErrorDetails; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.code = code;
    this.details = options.details ?? {};
    this.retryable = options.retryable ?? false;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
