import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveActiveFamilySelection,
  familyIdFromActiveFamilySelection,
} from '../../src/domain/attachments/activeFamilySelection.ts';
import { syncActiveFamilyForPhotoTransfer } from '../../src/application/syncActiveFamilyForPhotoTransfer.ts';
import { createHttpFamilyMembershipClient } from '../../src/infrastructure/family/httpFamilyMembershipClient.ts';
import { createFamilyPhotoTransferSessionBinding } from '../../src/application/bindFamilyPhotoTransferSession.ts';

test('active family selection stays cold with no memberships and auto-binds a single family', () => {
  assert.equal(resolveActiveFamilySelection({ memberships: [] }).kind, 'none');

  const single = resolveActiveFamilySelection({
    memberships: [{ familyId: 'fam_1', role: 'admin', status: 'active' }],
  });
  assert.deepEqual(single, { kind: 'single', familyId: 'fam_1' });
  assert.equal(familyIdFromActiveFamilySelection(single), 'fam_1');

  const revokedOnly = resolveActiveFamilySelection({
    memberships: [{ familyId: 'fam_x', role: 'caregiver', status: 'revoked' }],
  });
  assert.equal(revokedOnly.kind, 'none');
});

test('multiple active families require an explicit choice and keep a valid previous pick', () => {
  const memberships = [
    { familyId: 'fam_a', role: 'admin', status: 'active' },
    { familyId: 'fam_b', role: 'caregiver', status: 'active' },
  ];
  const needsChoice = resolveActiveFamilySelection({ memberships });
  assert.equal(needsChoice.kind, 'choice_required');
  if (needsChoice.kind !== 'choice_required') return;
  assert.equal(needsChoice.preferredFamilyId, null);
  assert.equal(familyIdFromActiveFamilySelection(needsChoice), null);

  const kept = resolveActiveFamilySelection({
    memberships,
    previouslySelectedFamilyId: 'fam_b',
  });
  assert.equal(kept.kind, 'choice_required');
  if (kept.kind !== 'choice_required') return;
  assert.equal(kept.preferredFamilyId, 'fam_b');
  assert.equal(familyIdFromActiveFamilySelection(kept), 'fam_b');

  const stale = resolveActiveFamilySelection({
    memberships,
    previouslySelectedFamilyId: 'fam_gone',
  });
  assert.equal(stale.kind, 'choice_required');
  if (stale.kind !== 'choice_required') return;
  assert.equal(stale.preferredFamilyId, null);
});

test('sync helper binds single membership into photo transfer session', () => {
  const binding = createFamilyPhotoTransferSessionBinding({
    boundary: {
      apiBaseUrl: 'https://api.example.test',
      syncConfigured: true,
    },
  });
  binding.bindAuthSession({
    appUserId: 'user-1',
    accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
    transport: 'bearer',
    accessToken: 'tok',
    csrfToken: null,
  });

  const synced = syncActiveFamilyForPhotoTransfer({
    memberships: [{ familyId: 'fam_only', role: 'admin', status: 'active' }],
    bindActiveFamily: binding.bindActiveFamily,
  });
  assert.equal(synced.boundFamilyId, 'fam_only');
  assert.equal(binding.runtime.getSession().activeFamilyId, 'fam_only');
  assert.equal(binding.runtime.getSession().appUserId, 'user-1');
});

test('membership HTTP client sends bearer or cookie credentials to /v1/me', async () => {
  const seen: Array<{ auth?: string; csrf?: string; credentials?: RequestCredentials }> = [];
  const bearerClient = createHttpFamilyMembershipClient({
    apiBaseUrl: 'https://api.example.test',
    getAccessCredentials: async () => ({ kind: 'bearer', accessToken: 'tok' }),
    fetchImpl: async (_url, init) => {
      const headers = new Headers(init?.headers);
      seen.push({
        auth: headers.get('authorization') ?? undefined,
        credentials: init?.credentials,
      });
      return new Response(
        JSON.stringify({
          appUserId: 'u1',
          memberships: [{ familyId: 'fam_1', role: 'admin', status: 'active' }],
        }),
        { status: 200 },
      );
    },
  });
  const listed = await bearerClient.listMemberships();
  assert.equal(listed.ok, true);
  if (!listed.ok) return;
  assert.equal(listed.memberships[0]?.familyId, 'fam_1');
  assert.equal(seen[0]?.auth, 'Bearer tok');

  const cookieSeen: Array<{ csrf?: string | null; credentials?: RequestCredentials }> = [];
  const cookieClient = createHttpFamilyMembershipClient({
    apiBaseUrl: 'https://api.example.test',
    getAccessCredentials: async () => ({ kind: 'cookie', csrfToken: 'csrf' }),
    fetchImpl: async (_url, init) => {
      const headers = new Headers(init?.headers);
      cookieSeen.push({
        csrf: headers.get('x-csrf-token'),
        credentials: init?.credentials,
      });
      return new Response(
        JSON.stringify({
          memberships: [{ familyId: 'fam_2', role: 'caregiver', status: 'active' }],
        }),
        { status: 200 },
      );
    },
  });
  const cookieListed = await cookieClient.listMemberships();
  assert.equal(cookieListed.ok, true);
  assert.deepEqual(cookieSeen[0], { csrf: 'csrf', credentials: 'include' });
});
