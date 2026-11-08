/** Wire protocol version shared by clients and the family API. */
export const LUMI_API_PROTOCOL_VERSION = 1 as const;

export const LUMI_API_LIMITS = {
  maxJsonBodyBytes: 64 * 1024,
  maxIdempotencyKeyLength: 128,
  maxDisplayNameLength: 80,
  maxPageSize: 100,
  /** Invitation plaintext is shown once; server stores only a hash. */
  invitationTokenBytes: 32,
  invitationDefaultTtlSeconds: 48 * 60 * 60,
  invitationMaxTtlSeconds: 7 * 24 * 60 * 60,
  invitationMaxAttempts: 5,
  /** Push batches stay small so partial failures stay recoverable. */
  maxSyncPushBatch: 25,
  maxSyncPullPage: 50,
} as const;

export type HealthResponse = {
  readonly ok: true;
  readonly protocolVersion: typeof LUMI_API_PROTOCOL_VERSION;
  readonly role: 'api' | 'worker';
  readonly time: string;
};

export type ReadinessResponse = {
  readonly ready: boolean;
  readonly checks: Readonly<Record<string, 'ok' | 'fail' | 'skip'>>;
};
