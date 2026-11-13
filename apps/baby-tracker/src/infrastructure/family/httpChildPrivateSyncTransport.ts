import type { ChildPrivateSyncTransportPort } from '../../domain/sync/childPrivateWorker';
import type { FamilyAccessCredentials } from './familyAccessCredentials';

/** Matches the family API wire protocol without importing the contracts package. */
const PROTOCOL_VERSION = 1 as const;

const CHILD_PRIVATE_PUSH_PATH = '/v1/child-private/sync/push';
const CHILD_PRIVATE_PULL_PATH = '/v1/child-private/sync/pull';

export type HttpChildPrivateSyncTransportConfig = {
  readonly apiBaseUrl: string;
  readonly deviceId: string;
  /** Resolves bearer or cookie+CSRF credentials for each request. */
  readonly getAccessCredentials: () => Promise<FamilyAccessCredentials | null>;
  readonly fetchImpl?: typeof fetch | undefined;
};

type RequestAuth = {
  readonly headers: Record<string, string>;
  readonly credentials: RequestCredentials;
};

type PushJson = {
  readonly epoch?: number;
  readonly receipts?: readonly {
    readonly operationId: string;
    readonly status: string;
    readonly reason?: string;
  }[];
};

type PullJson = {
  readonly epoch?: number;
  readonly entries?: readonly {
    readonly changelogSeq: number;
    readonly operationId: string;
    readonly revisionId: string;
    readonly entityId: string;
    readonly kind: string;
    readonly payloadHash: string;
    readonly payload: Readonly<Record<string, unknown>>;
  }[];
  readonly nextCursor?: string | null;
  readonly resyncRequired?: boolean;
};

type ErrorBody = {
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
  };
  readonly sync?: PullJson;
};

/**
 * HTTP adapter for the owner-scoped child-private sync stream. Never calls
 * /v1/families — private outbox traffic must stay off the family care endpoint.
 */
export function createHttpChildPrivateSyncTransport(
  config: HttpChildPrivateSyncTransportConfig,
): ChildPrivateSyncTransportPort {
  const fetchImpl = config.fetchImpl ?? fetch;
  const base = config.apiBaseUrl.replace(/\/$/, '');

  async function resolveAuth(extra?: Record<string, string>): Promise<RequestAuth> {
    const credentials = await config.getAccessCredentials();
    if (!credentials) {
      throw new Error('child_private_sync_unauthorized');
    }
    if (credentials.kind === 'bearer') {
      return {
        credentials: 'same-origin',
        headers: {
          authorization: `Bearer ${credentials.accessToken}`,
          ...(extra ?? {}),
        },
      };
    }
    return {
      // Cookie BFF sessions need ambient cookies plus double-submit CSRF.
      credentials: 'include',
      headers: {
        'x-csrf-token': credentials.csrfToken,
        ...(extra ?? {}),
      },
    };
  }

  async function readJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  return {
    async push(input) {
      const auth = await resolveAuth({ 'content-type': 'application/json' });
      // Session principal is trusted on the server; actorAppUserId mirrors the
      // local owner binding so retries stay attributable to this workspace.
      const body = {
        protocolVersion: PROTOCOL_VERSION,
        attemptId: input.attemptId,
        operations: input.operations.map((item) => ({
          schemaVersion: PROTOCOL_VERSION,
          operationId: item.operationId,
          deviceId: config.deviceId,
          actorAppUserId: input.ownerAppUserId,
          kind: item.commandType,
          entityId: item.entityId,
          revisionId: item.revisionId,
          parentRevisionIds: item.parentRevisionIds,
          payloadHash: item.payloadHash,
          payload: item.payload,
        })),
      };
      const response = await fetchImpl(`${base}${CHILD_PRIVATE_PUSH_PATH}`, {
        method: 'POST',
        headers: auth.headers,
        credentials: auth.credentials,
        body: JSON.stringify(body),
      });
      const json = (await readJson(response)) as PushJson & ErrorBody;
      if (!response.ok) {
        throw new Error(json.error?.code ?? `child_private_sync_push_${response.status}`);
      }
      return {
        epoch: json.epoch ?? 0,
        receipts: json.receipts ?? [],
      };
    },

    async pull(input) {
      const auth = await resolveAuth();
      const query = new URLSearchParams();
      if (input.cursor) query.set('cursor', input.cursor);
      const suffix = query.size > 0 ? `?${query.toString()}` : '';
      const response = await fetchImpl(`${base}${CHILD_PRIVATE_PULL_PATH}${suffix}`, {
        method: 'GET',
        headers: auth.headers,
        credentials: auth.credentials,
      });
      const json = (await readJson(response)) as PullJson & ErrorBody;
      // Server signals epoch drift as 409 + sync page; surface it as a normal
      // pull result so the worker can keep unsent private work.
      if (response.status === 409 && json.error?.code === 'resync_required' && json.sync) {
        return {
          entries: json.sync.entries ?? [],
          nextCursor: json.sync.nextCursor ?? null,
          epoch: json.sync.epoch ?? 0,
          resyncRequired: true,
        };
      }
      if (!response.ok) {
        throw new Error(json.error?.code ?? `child_private_sync_pull_${response.status}`);
      }
      return {
        entries: json.entries ?? [],
        nextCursor: json.nextCursor ?? null,
        epoch: json.epoch ?? 0,
        resyncRequired: Boolean(json.resyncRequired),
      };
    },
  };
}

/**
 * Personal / cold builds never open the child-private HTTP stream.
 */
export function createDisabledChildPrivateSyncTransport(): ChildPrivateSyncTransportPort {
  return {
    async push() {
      throw new Error('child_private_sync_not_configured');
    },
    async pull() {
      throw new Error('child_private_sync_not_configured');
    },
  };
}

/**
 * Prefer a configured API URL + sync gate; otherwise keep the transport cold.
 */
export function resolveChildPrivateSyncTransport(input: {
  readonly apiBaseUrl: string | null;
  readonly childPrivateSyncConfigured: boolean;
  readonly deviceId: string;
  readonly getAccessCredentials: () => Promise<FamilyAccessCredentials | null>;
  readonly fetchImpl?: typeof fetch | undefined;
}): ChildPrivateSyncTransportPort {
  if (!input.childPrivateSyncConfigured || !input.apiBaseUrl?.trim()) {
    return createDisabledChildPrivateSyncTransport();
  }
  return createHttpChildPrivateSyncTransport({
    apiBaseUrl: input.apiBaseUrl,
    deviceId: input.deviceId,
    getAccessCredentials: input.getAccessCredentials,
    ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
  });
}
