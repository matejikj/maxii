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
  /** Dev/test HMAC secret — never used when JWKS URL is configured. */
  readonly testHs256Secret: string | null;
  readonly corsOrigins: readonly string[];
  readonly csrfCookieName: string;
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
  return {
    role,
    host: env.LUMI_API_HOST?.trim() || '127.0.0.1',
    port: Number.isFinite(port) ? port : 8787,
    publicBaseUrl: env.LUMI_API_PUBLIC_URL?.trim() || `http://127.0.0.1:${port}`,
    databaseUrl: env.LUMI_DATABASE_URL?.trim() || null,
    oidcIssuer: env.LUMI_OIDC_ISSUER?.trim() || 'http://127.0.0.1:8080/realms/lumi',
    oidcAudience: env.LUMI_OIDC_AUDIENCE?.trim() || 'lumi-api',
    oidcJwksUrl: env.LUMI_OIDC_JWKS_URL?.trim() || null,
    testHs256Secret: env.LUMI_TEST_HS256_SECRET?.trim() || null,
    corsOrigins: readList(env.LUMI_CORS_ORIGINS),
    csrfCookieName: env.LUMI_CSRF_COOKIE_NAME?.trim() || 'lumi_csrf',
  };
}
