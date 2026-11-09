import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFamilyPhotoTransferSessionBinding } from '../../src/application/bindFamilyPhotoTransferSession.ts';
import type { FamilyAuthSession } from '../../src/infrastructure/family/familyAuthPort.ts';

const bearerSession: FamilyAuthSession = {
  appUserId: 'user-1',
  accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
  transport: 'bearer',
  accessToken: 'access-token',
  csrfToken: null,
};

test('photo transfer binding stays cold without sync env even after login', async () => {
  const binding = createFamilyPhotoTransferSessionBinding({
    boundary: {
      apiBaseUrl: 'https://api.example.test',
      authConfigured: true,
      syncConfigured: false,
    },
  });

  binding.bindAuthSession(bearerSession);
  binding.bindActiveFamily('fam_1');

  assert.equal(binding.runtime.getSession().familySyncConfigured, false);
  assert.equal(binding.runtime.getSession().appUserId, 'user-1');
  assert.equal(binding.runtime.getSession().activeFamilyId, 'fam_1');

  const result = await binding.getTransferPort().getQuota({ familyId: 'fam_1' });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'not_configured');
});

test('photo transfer binding opens bearer HTTP client after login + family + sync', async () => {
  const seen: string[] = [];
  const binding = createFamilyPhotoTransferSessionBinding({
    boundary: {
      apiBaseUrl: 'https://api.example.test',
      authConfigured: true,
      syncConfigured: true,
    },
    fetchImpl: async (url, init) => {
      const headers = new Headers(init?.headers);
      seen.push(headers.get('authorization') ?? '');
      return new Response(
        JSON.stringify({
          remainingBytes: 10,
          usedBytes: 0,
          reservedBytes: 0,
          budgetBytes: 10,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
  });

  binding.bindAuthSession(bearerSession);
  binding.bindActiveFamily('fam_1');

  assert.equal(binding.runtime.getSession().familySyncConfigured, true);
  assert.equal(binding.runtime.getSession().appUserId, 'user-1');
  assert.equal(binding.runtime.getSession().activeFamilyId, 'fam_1');

  const quota = await binding.getTransferPort().getQuota({ familyId: 'fam_1' });
  assert.equal(quota.ok, true);
  assert.deepEqual(seen, ['Bearer access-token']);

  binding.bindAuthSession(null);
  assert.equal(binding.runtime.getSession().appUserId, null);
  const afterLogout = await binding.getTransferPort().getQuota({ familyId: 'fam_1' });
  assert.equal(afterLogout.ok, false);
  if (afterLogout.ok) return;
  assert.equal(afterLogout.code, 'not_configured');
});

test('cookie auth credentials reach transfer client with CSRF header', async () => {
  const seen: Array<{ csrf: string | null; credentials?: RequestCredentials }> = [];
  const binding = createFamilyPhotoTransferSessionBinding({
    boundary: {
      apiBaseUrl: 'https://api.example.test',
      authConfigured: true,
      syncConfigured: true,
    },
    fetchImpl: async (_url, init) => {
      const headers = new Headers(init?.headers);
      seen.push({
        csrf: headers.get('x-csrf-token'),
        credentials: init?.credentials,
      });
      return new Response(
        JSON.stringify({
          remainingBytes: 1,
          usedBytes: 0,
          reservedBytes: 0,
          budgetBytes: 1,
        }),
        { status: 200 },
      );
    },
  });

  binding.bindAuthSession({
    appUserId: 'user-cookie',
    accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
    transport: 'cookie',
    accessToken: null,
    csrfToken: 'csrf-from-login',
  });
  binding.bindActiveFamily('fam_2');

  const quota = await binding.getTransferPort().getQuota({ familyId: 'fam_2' });
  assert.equal(quota.ok, true);
  assert.deepEqual(seen, [{ csrf: 'csrf-from-login', credentials: 'include' }]);
});
