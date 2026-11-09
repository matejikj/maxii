export type ProcessRole = 'api' | 'worker';

export type ApiConfig = {
  readonly role: ProcessRole;
  readonly host: string;
  readonly port: number;
  readonly publicBaseUrl: string;
  readonly databaseUrl: string | null;
  readonly oidcIssuer: string;
  readonly oidcAudience: string;
  readonly oidcJwksUrl: string | null;
  readonly oidcClientId: string;
  readonly oidcClientSecret: string | null;
  readonly oidcTokenUrl: string | null;
  /** Local mock IdP for automated tests — never enable on a shared host. */
  readonly oidcMock: boolean;
  readonly allowedRedirectUris: readonly string[];
  /** Dev/test HMAC secret — never used when JWKS URL is configured. */
  readonly testHs256Secret: string | null;
  readonly corsOrigins: readonly string[];
  readonly csrfCookieName: string;
  readonly sessionCookieName: string;
  readonly rateLimitPerWindow: number;
  readonly rateLimitWindowMs: number;
  readonly requestTimeoutMs: number;
  readonly workerId: string;
  readonly workerLeaseMs: number;
  readonly workerPollMs: number;
  /** Optional bearer for /v1/ops/* — unset keeps metrics private (401). */
  readonly opsBearerToken: string | null;
  /** Independent uptime probe configured outside this VPS. */
  readonly offHostProbeConfigured: boolean;
  /**
   * Optional private attachment object store (Cloudflare R2 / S3-compatible).
   * Unset keeps the in-memory fixture so personal and CI boots stay offline.
   */
  readonly attachmentObjectStore: {
    readonly provider: 'memory' | 'r2';
    readonly endpoint: string | null;
    readonly region: string | null;
    readonly bucket: string | null;
    readonly accessKeyId: string | null;
    readonly secretAccessKey: string | null;
  };
};

function readList(value: string | undefined): readonly string[] {
  if (!value?.trim()) return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function loadApiConfig(
  env: NodeJS.ProcessEnv = process.env,
): ApiConfig {
  const role = env.LUMI_PROCESS_ROLE === 'worker' ? 'worker' : 'api';
  const port = Number(env.LUMI_API_PORT ?? '8787');
  const issuer = env.LUMI_OIDC_ISSUER?.trim() || 'http://127.0.0.1:8080/realms/lumi';
  const rateLimitPerWindow = Number(env.LUMI_RATE_LIMIT_PER_WINDOW ?? '120');
  const rateLimitWindowMs = Number(env.LUMI_RATE_LIMIT_WINDOW_MS ?? '60000');
  const requestTimeoutMs = Number(env.LUMI_REQUEST_TIMEOUT_MS ?? '15000');
  const workerLeaseMs = Number(env.LUMI_WORKER_LEASE_MS ?? '15000');
  const workerPollMs = Number(env.LUMI_WORKER_POLL_MS ?? '1000');
  return {
    role,
    host: env.LUMI_API_HOST?.trim() || '127.0.0.1',
    port: Number.isFinite(port) ? port : 8787,
    publicBaseUrl: env.LUMI_API_PUBLIC_URL?.trim() || `http://127.0.0.1:${port}`,
    databaseUrl: env.LUMI_DATABASE_URL?.trim() || null,
    oidcIssuer: issuer,
    oidcAudience: env.LUMI_OIDC_AUDIENCE?.trim() || 'lumi-api',
    oidcJwksUrl: env.LUMI_OIDC_JWKS_URL?.trim() || null,
    oidcClientId: env.LUMI_OIDC_CLIENT_ID?.trim() || 'lumi-api',
    oidcClientSecret: env.LUMI_OIDC_CLIENT_SECRET?.trim() || null,
    oidcTokenUrl:
      env.LUMI_OIDC_TOKEN_URL?.trim() ||
      `${issuer}/protocol/openid-connect/token`,
    oidcMock: env.LUMI_OIDC_MOCK === '1',
    allowedRedirectUris: readList(
      env.LUMI_OIDC_REDIRECT_URIS ||
        'com.matejikj://oidc/callback,http://127.0.0.1:8081/oidc/callback',
    ),
    testHs256Secret: env.LUMI_TEST_HS256_SECRET?.trim() || null,
    corsOrigins: readList(env.LUMI_CORS_ORIGINS),
    csrfCookieName: env.LUMI_CSRF_COOKIE_NAME?.trim() || 'lumi_csrf',
    sessionCookieName: env.LUMI_SESSION_COOKIE_NAME?.trim() || 'lumi_session',
    rateLimitPerWindow: Number.isFinite(rateLimitPerWindow) ? rateLimitPerWindow : 120,
    rateLimitWindowMs: Number.isFinite(rateLimitWindowMs) ? rateLimitWindowMs : 60_000,
    requestTimeoutMs: Number.isFinite(requestTimeoutMs) ? requestTimeoutMs : 15_000,
    workerId: env.LUMI_WORKER_ID?.trim() || `worker-${process.pid}`,
    workerLeaseMs: Number.isFinite(workerLeaseMs) ? workerLeaseMs : 15_000,
    workerPollMs: Number.isFinite(workerPollMs) ? workerPollMs : 1_000,
    opsBearerToken: env.LUMI_OPS_BEARER_TOKEN?.trim() || null,
    offHostProbeConfigured: env.LUMI_OFF_HOST_PROBE_CONFIGURED === '1',
    attachmentObjectStore: {
      provider: env.LUMI_ATTACHMENT_STORE === 'r2' ? 'r2' : 'memory',
      endpoint: env.LUMI_R2_ENDPOINT?.trim() || null,
      region: env.LUMI_R2_REGION?.trim() || 'auto',
      bucket: env.LUMI_R2_BUCKET?.trim() || null,
      accessKeyId: env.LUMI_R2_ACCESS_KEY_ID?.trim() || null,
      secretAccessKey: env.LUMI_R2_SECRET_ACCESS_KEY?.trim() || null,
    },
  };
}
