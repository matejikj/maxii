import {
  createEmptyChildPrivateSyncState,
  type LocalChildPrivateSyncState,
} from '../domain/sync/childPrivateTransport';
import {
  runChildPrivateSyncTick,
  type ChildPrivateSyncTransportPort,
  type ChildPrivateSyncWorkerResult,
} from '../domain/sync/childPrivateWorker';
import {
  credentialsFromFamilyAuthSession,
  type FamilyAuthSession,
} from '../infrastructure/family/familyAuthPort';
import {
  createDisabledChildPrivateSyncTransport,
  resolveChildPrivateSyncTransport,
} from '../infrastructure/family/httpChildPrivateSyncTransport';

export type ChildPrivateSyncRemoteGate = {
  readonly apiBaseUrl: string | null;
  readonly syncConfigured: boolean;
};

export type ChildPrivateSyncSessionBinding = {
  /** Apply login/logout; personal mode never opens the HTTP transport. */
  readonly bindAuthSession: (session: FamilyAuthSession | null) => void;
  readonly getTransport: () => ChildPrivateSyncTransportPort;
  readonly isTransferReady: () => boolean;
  /** Current authenticated principal, or null when logged out / personal cold. */
  readonly getAppUserId: () => string | null;
  /**
   * Runs one owner-scoped tick when sync is configured and a session is bound.
   * Cold personal builds return the prior state without contacting a backend.
   */
  readonly runTick: (input: {
    readonly state: LocalChildPrivateSyncState;
    readonly attemptId: string;
    readonly now: string;
    readonly batchSize?: number;
  }) => Promise<ChildPrivateSyncWorkerResult>;
};

/**
 * Binds authenticated credentials into the child-private sync HTTP transport.
 * Without sync env flags the port stays disabled so personal builds never
 * contact a backend. FamilyId is intentionally absent from this binding.
 */
export function createChildPrivateSyncSessionBinding(input: {
  readonly boundary: ChildPrivateSyncRemoteGate;
  readonly deviceId: string;
  readonly fetchImpl?: typeof fetch | undefined;
}): ChildPrivateSyncSessionBinding {
  let authSession: FamilyAuthSession | null = null;
  let transport: ChildPrivateSyncTransportPort =
    createDisabledChildPrivateSyncTransport();

  function rebuild(): void {
    const syncReady =
      input.boundary.syncConfigured && Boolean(input.boundary.apiBaseUrl);
    transport = resolveChildPrivateSyncTransport({
      apiBaseUrl: input.boundary.apiBaseUrl,
      // Only open HTTP when sync is configured and a principal is present.
      childPrivateSyncConfigured: syncReady && authSession != null,
      deviceId: input.deviceId,
      getAccessCredentials: async () =>
        credentialsFromFamilyAuthSession(authSession),
      fetchImpl: input.fetchImpl,
    });
  }

  rebuild();

  return {
    bindAuthSession(session) {
      authSession = session;
      rebuild();
    },
    getTransport: () => transport,
    getAppUserId: () => authSession?.appUserId ?? null,
    isTransferReady: () =>
      Boolean(
        input.boundary.syncConfigured &&
          input.boundary.apiBaseUrl &&
          authSession?.appUserId,
      ),
    async runTick(tickInput) {
      const ownerAppUserId = authSession?.appUserId ?? null;
      if (
        !ownerAppUserId ||
        !input.boundary.syncConfigured ||
        !input.boundary.apiBaseUrl
      ) {
        // Local outbox stays durable; absence of remote config is not a failure.
        return {
          state: tickInput.state ?? createEmptyChildPrivateSyncState(),
          pushed: 0,
          pulled: 0,
          nextDelayMs: 5_000,
        };
      }
      return runChildPrivateSyncTick({
        state: tickInput.state,
        ownerAppUserId,
        transport,
        attemptId: tickInput.attemptId,
        now: tickInput.now,
        ...(tickInput.batchSize != null
          ? { batchSize: tickInput.batchSize }
          : {}),
      });
    },
  };
}
