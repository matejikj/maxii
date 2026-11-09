import type {
  FamilyAttachmentTransferPort,
  FamilyAttachmentTransferResult,
} from '../../domain/attachments/familyAttachmentTransferPort';
import { createDisabledFamilyAttachmentTransferPort } from '../../domain/attachments/familyAttachmentTransferPort';

/** Matches the family API wire protocol without importing the contracts package. */
const PROTOCOL_VERSION = 1 as const;

export type HttpFamilyAttachmentTransferConfig = {
  readonly apiBaseUrl: string;
  readonly getAccessToken: () => Promise<string | null>;
  readonly fetchImpl?: typeof fetch;
};

type ErrorBody = {
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
    readonly details?: Readonly<Record<string, string | number | boolean | null>>;
  };
};

/**
 * Authenticated client for family photo intents/upload/finalize/read.
 * Construct only when a remote API URL and session exist; personal mode stays
 * on the disabled port.
 */
export function createHttpFamilyAttachmentTransferClient(
  config: HttpFamilyAttachmentTransferConfig,
): FamilyAttachmentTransferPort {
  const fetchImpl = config.fetchImpl ?? fetch;
  const base = config.apiBaseUrl.replace(/\/$/, '');

  async function authHeaders(
    extra?: Record<string, string>,
  ): Promise<Record<string, string> | null> {
    const token = await config.getAccessToken();
    if (!token) return null;
    return {
      authorization: `Bearer ${token}`,
      ...(extra ?? {}),
    };
  }

  function mapStatus(status: number, body: ErrorBody): FamilyAttachmentTransferResult<never> {
    const code = body.error?.code;
    const message = body.error?.message ?? `Attachment transfer failed (${status})`;
    if (status === 401) return { ok: false, code: 'unauthorized', message };
    if (status === 403) return { ok: false, code: 'forbidden', message };
    if (status === 404) return { ok: false, code: 'not_found', message };
    if (status === 409) {
      if (code === 'conflict' && body.error?.details?.reason === 'quota_exceeded') {
        return { ok: false, code: 'quota', message };
      }
      if (code === 'conflict' && body.error?.details?.reason === 'pending_budget_exceeded') {
        return { ok: false, code: 'quota', message };
      }
      // Erased attachments and other conflicts stay non-retryable here.
      return { ok: false, code: 'conflict', message };
    }
    if (status === 400) return { ok: false, code: 'validation', message };
    return { ok: false, code: 'network', message };
  }

  async function readError(response: Response): Promise<ErrorBody> {
    try {
      return (await response.json()) as ErrorBody;
    } catch {
      return {};
    }
  }

  return {
    async getQuota({ familyId }) {
      const headers = await authHeaders();
      if (!headers) {
        return { ok: false, code: 'unauthorized', message: 'Missing access token' };
      }
      try {
        const response = await fetchImpl(`${base}/v1/families/${familyId}/attachments/quota`, {
          method: 'GET',
          headers,
        });
        if (!response.ok) return mapStatus(response.status, await readError(response));
        const json = (await response.json()) as {
          remainingBytes: number;
          usedBytes: number;
          reservedBytes: number;
          budgetBytes: number;
        };
        return {
          ok: true,
          value: {
            remainingBytes: json.remainingBytes,
            usedBytes: json.usedBytes,
            reservedBytes: json.reservedBytes,
            budgetBytes: json.budgetBytes,
          },
        };
      } catch {
        return { ok: false, code: 'network', message: 'Quota request failed' };
      }
    },

    async createUploadIntent(input) {
      const headers = await authHeaders({ 'content-type': 'application/json' });
      if (!headers) {
        return { ok: false, code: 'unauthorized', message: 'Missing access token' };
      }
      try {
        const response = await fetchImpl(
          `${base}/v1/families/${input.familyId}/attachments/intents`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              protocolVersion: PROTOCOL_VERSION,
              idempotencyKey: input.idempotencyKey,
              attachmentId: input.attachmentId,
              childId: input.childId,
              eventId: input.eventId,
              role: input.role,
              expectedBytes: input.expectedBytes,
              expectedSha256: input.expectedSha256,
              contentType: 'image/jpeg',
            }),
          },
        );
        if (!response.ok) return mapStatus(response.status, await readError(response));
        const json = (await response.json()) as {
          intentId: string;
          objectKey: string;
          expiresAt: string;
          reservedBytes: number;
        };
        return {
          ok: true,
          value: {
            intentId: json.intentId,
            objectKey: json.objectKey,
            expiresAt: json.expiresAt,
            reservedBytes: json.reservedBytes,
          },
        };
      } catch {
        return { ok: false, code: 'network', message: 'Upload intent failed' };
      }
    },

    async uploadRenditionBytes(input) {
      const headers = await authHeaders({ 'content-type': 'application/octet-stream' });
      if (!headers) {
        return { ok: false, code: 'unauthorized', message: 'Missing access token' };
      }
      try {
        const response = await fetchImpl(
          `${base}/v1/families/${input.familyId}/attachments/intents/${input.intentId}`,
          {
            method: 'PUT',
            headers,
            body: input.bytes,
          },
        );
        if (!response.ok) return mapStatus(response.status, await readError(response));
        return { ok: true, value: { ok: true } };
      } catch {
        return { ok: false, code: 'network', message: 'Upload bytes failed' };
      }
    },

    async finalizeUpload(input) {
      const headers = await authHeaders({ 'content-type': 'application/json' });
      if (!headers) {
        return { ok: false, code: 'unauthorized', message: 'Missing access token' };
      }
      try {
        const response = await fetchImpl(
          `${base}/v1/families/${input.familyId}/attachments/intents/${input.intentId}/finalize`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              protocolVersion: PROTOCOL_VERSION,
              intentId: input.intentId,
              sha256: input.sha256,
              byteLength: input.byteLength,
            }),
          },
        );
        if (!response.ok) return mapStatus(response.status, await readError(response));
        return { ok: true, value: { activated: true } };
      } catch {
        return { ok: false, code: 'network', message: 'Finalize failed' };
      }
    },

    async readRendition(input) {
      const headers = await authHeaders();
      if (!headers) {
        return { ok: false, code: 'unauthorized', message: 'Missing access token' };
      }
      try {
        const response = await fetchImpl(
          `${base}/v1/families/${input.familyId}/attachments/${input.attachmentId}/${input.role}`,
          { method: 'GET', headers },
        );
        if (!response.ok) return mapStatus(response.status, await readError(response));
        const buffer = new Uint8Array(await response.arrayBuffer());
        const sha256 = response.headers.get('x-lumi-attachment-sha256') ?? '';
        const byteLengthHeader = response.headers.get('x-lumi-attachment-bytes');
        const byteLength = byteLengthHeader
          ? Number(byteLengthHeader)
          : buffer.byteLength;
        return {
          ok: true,
          value: { bytes: buffer, sha256, byteLength },
        };
      } catch {
        return { ok: false, code: 'network', message: 'Download failed' };
      }
    },
  };
}

/**
 * Prefer a configured API URL + token provider; otherwise keep transfers cold.
 */
export function resolveFamilyAttachmentTransferPort(input: {
  readonly apiBaseUrl: string | null;
  readonly familySyncConfigured: boolean;
  readonly getAccessToken: () => Promise<string | null>;
  readonly fetchImpl?: typeof fetch;
}): FamilyAttachmentTransferPort {
  if (!input.familySyncConfigured || !input.apiBaseUrl?.trim()) {
    return createDisabledFamilyAttachmentTransferPort();
  }
  return createHttpFamilyAttachmentTransferClient({
    apiBaseUrl: input.apiBaseUrl,
    getAccessToken: input.getAccessToken,
    fetchImpl: input.fetchImpl,
  });
}
