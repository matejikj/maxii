import type { LumiApiErrorBody, LumiApiErrorCode } from '@lumi/contracts';

export function apiError(
  code: LumiApiErrorCode,
  message: string,
  requestId: string,
  details?: Readonly<Record<string, string | number | boolean | null>>,
): { status: number; body: LumiApiErrorBody } {
  const statusByCode: Record<LumiApiErrorCode, number> = {
    unauthorized: 401,
    forbidden: 403,
    not_found: 404,
    conflict: 409,
    validation: 400,
    unsupported_schema: 400,
    rate_limited: 429,
    service_unavailable: 503,
    csrf_rejected: 403,
    issuer_rejected: 401,
    token_expired: 401,
    resync_required: 409,
  };
  return {
    status: statusByCode[code],
    body: {
      error: {
        code,
        message,
        requestId,
        ...(details ? { details } : {}),
      },
    },
  };
}
