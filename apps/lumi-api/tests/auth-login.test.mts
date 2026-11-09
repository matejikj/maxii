import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LUMI_AUTH_MODE_VERSION, LUMI_API_PROTOCOL_VERSION } from '@lumi/contracts';
import { loadApiConfig } from '../src/config/env.ts';
import { createFamilyApi } from '../src/http/createServer.ts';

function cookieHeaderFromSetCookie(setCookie: string | string[] | undefined): string {
  if (!setCookie) return '';
  const parts = Array.isArray(setCookie) ? setCookie : [setCookie];
  return parts.map((item) => item.split(';')[0] ?? '').filter(Boolean).join('; ');
}

async function boot() {
  const config = loadApiConfig({
    LUMI_OIDC_MOCK: '1',
    LUMI_TEST_HS256_SECRET: 'unit-test-hs256',
    LUMI_OIDC_ISSUER: 'http://test.invalid/realms/lumi',
    LUMI_OIDC_AUDIENCE: 'lumi-api',
    LUMI_OIDC_REDIRECT_URIS: 'com.matejikj://oidc/callback,http://127.0.0.1:8081/oidc/callback',
    LUMI_CORS_ORIGINS: 'http://127.0.0.1:8081',
    LUMI_API_PUBLIC_URL: 'http://127.0.0.1:8787',
  } as NodeJS.ProcessEnv);
  return createFamilyApi(config);
}

test('auth mode metadata advertises Keycloak OIDC without requiring the client to hold secrets', async () => {
  const { app } = await boot();
  const mode = await app.inject({ method: 'GET', url: '/v1/auth/mode' });
  assert.equal(mode.statusCode, 200);
  assert.equal(mode.json().version, LUMI_AUTH_MODE_VERSION);
  assert.equal(mode.json().mode, 'oidc_keycloak_v1');
  await app.close();
});

test('login rejects unknown redirect URIs and completes PKCE cookie session', async () => {
  const { app } = await boot();

  const denied = await app.inject({
    method: 'POST',
    url: '/v1/auth/login/start',
    payload: { redirectUri: 'https://evil.invalid/steal' },
  });
  assert.equal(denied.statusCode, 403);

  const start = await app.inject({
    method: 'POST',
    url: '/v1/auth/login/start',
    payload: { redirectUri: 'com.matejikj://oidc/callback' },
  });
  assert.equal(start.statusCode, 200);
  const { state, authorizationUrl } = start.json() as {
    state: string;
    authorizationUrl: string;
  };
  assert.match(authorizationUrl, /code_challenge=/);

  const authUrl = new URL(authorizationUrl);
  const redirected = await app.inject({
    method: 'GET',
    url: `${authUrl.pathname}?${authUrl.searchParams.toString()}&login_hint=parent-one`,
  });
  assert.equal(redirected.statusCode, 302);
  const location = redirected.headers.location;
  assert.ok(typeof location === 'string');
  const returned = new URL(location);
  assert.equal(returned.searchParams.get('state'), state);
  const code = returned.searchParams.get('code');
  assert.ok(code);

  const callback = await app.inject({
    method: 'POST',
    url: '/v1/auth/login/callback',
    payload: {
      code,
      state,
      redirectUri: 'com.matejikj://oidc/callback',
      transport: 'cookie',
    },
  });
  assert.equal(callback.statusCode, 200);
  assert.equal(callback.json().transport, 'cookie');
  assert.ok(callback.json().appUserId);
  const cookieHeader = cookieHeaderFromSetCookie(callback.headers['set-cookie']);
  assert.match(cookieHeader, /lumi_session=/);

  const session = await app.inject({
    method: 'GET',
    url: '/v1/auth/session',
    headers: { cookie: cookieHeader },
  });
  assert.equal(session.statusCode, 200);
  assert.equal(session.json().appUserId, callback.json().appUserId);
  assert.equal(session.json().transport, 'cookie');
  assert.equal(typeof session.json().csrfToken, 'string');
  assert.equal(session.json().csrfToken, callback.json().csrfToken);

  const logout = await app.inject({
    method: 'POST',
    url: '/v1/auth/logout',
    headers: { cookie: cookieHeader },
  });
  assert.equal(logout.statusCode, 200);
  assert.equal(logout.json().preservedLocalDrafts, true);

  const after = await app.inject({
    method: 'GET',
    url: '/v1/auth/session',
    headers: { cookie: cookieHeader },
  });
  assert.equal(after.statusCode, 401);
  await app.close();
});

test('bearer login returns an access token usable for family create', async () => {
  const { app } = await boot();
  const start = await app.inject({
    method: 'POST',
    url: '/v1/auth/login/start',
    payload: { redirectUri: 'com.matejikj://oidc/callback' },
  });
  const authUrl = new URL(start.json().authorizationUrl as string);
  const redirected = await app.inject({
    method: 'GET',
    url: `${authUrl.pathname}?${authUrl.searchParams.toString()}&login_hint=parent-two`,
  });
  const returned = new URL(String(redirected.headers.location));
  const callback = await app.inject({
    method: 'POST',
    url: '/v1/auth/login/callback',
    payload: {
      code: returned.searchParams.get('code'),
      state: start.json().state,
      redirectUri: 'com.matejikj://oidc/callback',
      transport: 'bearer',
    },
  });
  assert.equal(callback.statusCode, 200);
  assert.equal(callback.json().transport, 'bearer');
  const token = callback.json().accessToken as string;
  assert.ok(token);

  const created = await app.inject({
    method: 'POST',
    url: '/v1/families',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: 'after-login',
      displayName: 'Logged-in family',
    },
  });
  assert.equal(created.statusCode, 201);
  await app.close();
});
