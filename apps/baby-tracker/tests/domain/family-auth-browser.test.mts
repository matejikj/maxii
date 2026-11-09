import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserFamilyAuthPort } from '../../src/infrastructure/family/browserFamilyAuthPort.ts';

test('browser auth port completes login, logout preserves local drafts, unknown mode holds data', async () => {
  const calls: string[] = [];
  let pendingState = 'state-1';

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.endsWith('/v1/auth/mode')) {
      return new Response(JSON.stringify({ version: 1, mode: 'oidc_keycloak_v1' }), {
        status: 200,
      });
    }
    if (url.endsWith('/v1/auth/login/start')) {
      return new Response(
        JSON.stringify({
          state: pendingState,
          authorizationUrl: 'https://idp.example/auth?state=state-1',
        }),
        { status: 200 },
      );
    }
    if (url.endsWith('/v1/auth/login/callback')) {
      return new Response(
        JSON.stringify({
          appUserId: 'user-1',
          expiresAt: '2026-11-09T12:00:00.000Z',
          transport: 'bearer',
          accessToken: 'token',
        }),
        { status: 200 },
      );
    }
    if (url.endsWith('/v1/auth/logout')) {
      return new Response(JSON.stringify({ preservedLocalDrafts: true }), { status: 200 });
    }
    return new Response('missing', { status: 404 });
  }) as typeof fetch;

  const port = createBrowserFamilyAuthPort({
    apiBaseUrl: 'http://api.test',
    redirectUri: 'com.matejikj://oidc/callback',
    transport: 'bearer',
    fetchImpl,
  });

  const start = await port.beginBrowserLogin();
  assert.equal(start.state, 'state-1');
  const session = await port.completeBrowserLogin({ code: 'abc', state: 'state-1' });
  assert.equal(session.appUserId, 'user-1');
  assert.equal(session.transport, 'bearer');
  assert.equal(session.accessToken, 'token');
  assert.equal((await port.currentSession())?.appUserId, 'user-1');
  assert.deepEqual(await port.getAccessCredentials(), {
    kind: 'bearer',
    accessToken: 'token',
  });
  const logout = await port.logout();
  assert.equal(logout.preservedLocalDrafts, true);
  assert.equal(await port.currentSession(), null);
  assert.equal(await port.getAccessCredentials(), null);
  assert.ok(calls.some((item) => item.includes('/v1/auth/logout')));

  const unknown = createBrowserFamilyAuthPort({
    apiBaseUrl: 'http://api.test',
    redirectUri: 'com.matejikj://oidc/callback',
    transport: 'bearer',
    fetchImpl: (async () =>
      new Response(JSON.stringify({ version: 1, mode: 'future_otp' }), {
        status: 200,
      })) as typeof fetch,
  });
  await assert.rejects(() => unknown.beginBrowserLogin(), /nezná|aktualizujte/i);
});
