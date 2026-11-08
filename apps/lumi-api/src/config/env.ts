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
  };
}
