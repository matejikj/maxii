/**
 * Structured API errors. Clients must branch on `code`, never free-form text.
 * Payloads never include diary bodies or tokens.
 */
export const LUMI_API_ERROR_CODES = [
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'validation',
  'unsupported_schema',
  'rate_limited',
  'service_unavailable',
  'csrf_rejected',
  'issuer_rejected',
  'token_expired',
  'resync_required',
] as const;

export type LumiApiErrorCode = (typeof LUMI_API_ERROR_CODES)[number];

export type LumiApiErrorBody = {
  readonly error: {
    readonly code: LumiApiErrorCode;
    readonly message: string;
    readonly requestId: string;
    readonly details?: Readonly<Record<string, string | number | boolean | null>>;
  };
};

export function isLumiApiErrorCode(value: unknown): value is LumiApiErrorCode {
  return typeof value === 'string' && (LUMI_API_ERROR_CODES as readonly string[]).includes(value);
}
