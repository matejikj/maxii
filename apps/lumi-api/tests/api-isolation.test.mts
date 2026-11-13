import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AppUserId, FamilyId } from '@lumi/contracts';
import { LUMI_API_PROTOCOL_VERSION } from '@lumi/contracts';
import { loadApiConfig } from '../src/config/env.ts';
import { createFamilyApi } from '../src/http/createServer.ts';
import { verifyCsrfDoubleSubmit } from '../src/auth/csrf.ts';
import { createPkcePair, isAllowedRedirectUri } from '../src/auth/pkce.ts';

async function boot() {
  const config = loadApiConfig({
    LUMI_TEST_HS256_SECRET: 'unit-test-hs256',
    LUMI_OIDC_ISSUER: 'http://test.invalid/realms/lumi',
    LUMI_OIDC_AUDIENCE: 'lumi-api',
    LUMI_CORS_ORIGINS: 'http://allowed.invalid',
  } as NodeJS.ProcessEnv);
  return createFamilyApi(config);
}

test('health and readiness stay available without a database', async () => {
  const { app } = await boot();
  const health = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(health.statusCode, 200);
  assert.equal(health.json().protocolVersion, LUMI_API_PROTOCOL_VERSION);
  const ready = await app.inject({ method: 'GET', url: '/ready' });
  assert.equal(ready.statusCode, 200);
  assert.equal(ready.json().ready, true);
  await app.close();
});

test('wrong issuer and expired tokens are rejected', async () => {
  const { app, tokens } = await boot();
  const user = randomUUID() as AppUserId;
  const good = await tokens.mintTestToken({ subject: 'sub-a', appUserId: user });
  const wrongIssuer = await tokens.mintTestToken({
    subject: 'sub-a',
    appUserId: user,
    issuer: 'http://evil.invalid/realms/lumi',
  });
  const expired = await tokens.mintTestToken({
    subject: 'sub-a',
    appUserId: user,
    expiresInSec: -10,
  });

  const ok = await app.inject({
    method: 'GET',
    url: '/v1/me',
    headers: { authorization: `Bearer ${good}` },
  });
  assert.equal(ok.statusCode, 200);

  const badIssuer = await app.inject({
    method: 'GET',
    url: '/v1/me',
    headers: { authorization: `Bearer ${wrongIssuer}` },
  });
  assert.equal(badIssuer.statusCode, 401);
  assert.equal(badIssuer.json().error.code, 'issuer_rejected');

  const badExp = await app.inject({
    method: 'GET',
    url: '/v1/me',
    headers: { authorization: `Bearer ${expired}` },
  });
  assert.equal(badExp.statusCode, 401);
  assert.equal(badExp.json().error.code, 'token_expired');
  await app.close();
});

test('two families cannot read each other objects by guessing IDs', async () => {
  const { app, tokens } = await boot();
  const userA = randomUUID() as AppUserId;
  const userB = randomUUID() as AppUserId;
  const tokenA = await tokens.mintTestToken({ subject: 'a', appUserId: userA });
  const tokenB = await tokens.mintTestToken({ subject: 'b', appUserId: userB });

  const familyA = await app.inject({
    method: 'POST',
    url: '/v1/families',
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: 'create-a',
      displayName: 'Family A',
    },
  });
  assert.equal(familyA.statusCode, 201);
  const familyAId = familyA.json().familyId as FamilyId;

  const familyB = await app.inject({
    method: 'POST',
    url: '/v1/families',
    headers: { authorization: `Bearer ${tokenB}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: 'create-b',
      displayName: 'Family B',
    },
  });
  assert.equal(familyB.statusCode, 201);

  const seeded = await app.inject({
    method: 'POST',
    url: '/v1/test/seed-object',
    payload: { familyId: familyAId, label: 'private-note' },
  });
  assert.equal(seeded.statusCode, 201);
  const objectId = seeded.json().objectId as string;

  const denied = await app.inject({
    method: 'GET',
    url: `/v1/families/${familyAId}/objects/${objectId}`,
    headers: { authorization: `Bearer ${tokenB}` },
  });
  assert.equal(denied.statusCode, 403);

  const allowed = await app.inject({
    method: 'GET',
    url: `/v1/families/${familyAId}/objects/${objectId}`,
    headers: { authorization: `Bearer ${tokenA}` },
  });
  assert.equal(allowed.statusCode, 200);
  assert.equal(allowed.json().label, 'private-note');
  await app.close();
});

test('cookie CSRF rejects mismatched tokens; bearer skips CSRF', () => {
  assert.equal(
    verifyCsrfDoubleSubmit({
      method: 'POST',
      cookieToken: 'abc',
      headerToken: 'xyz',
      usesBearerAuth: false,
    }),
    false,
  );
  assert.equal(
    verifyCsrfDoubleSubmit({
      method: 'POST',
      cookieToken: 'same',
      headerToken: 'same',
      usesBearerAuth: false,
    }),
    true,
  );
  assert.equal(
    verifyCsrfDoubleSubmit({
      method: 'POST',
      cookieToken: undefined,
      headerToken: undefined,
      usesBearerAuth: true,
    }),
    true,
  );
});

test('PKCE pair and redirect allow-list reject forged returns', () => {
  const pair = createPkcePair();
  assert.equal(pair.verifier.length > 20, true);
  assert.equal(pair.challenge.length > 20, true);
  assert.equal(pair.verifier === pair.challenge, false);
  assert.equal(
    isAllowedRedirectUri('com.matejikj://oidc/callback', ['com.matejikj://oidc/callback']),
    true,
  );
  assert.equal(
    isAllowedRedirectUri('https://evil.invalid/steal', ['com.matejikj://oidc/callback']),
    false,
  );
});
