import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeFamilyAccess,
  authorizeFamilyAdminAction,
  resolveActiveBinding,
  resolveAuthModeOrHold,
  suggestChildLinkDecision,
  applyExplicitChildLinkDecision,
  bindLocalActorToAccount,
  wouldLeaveFamilyWithoutAdmin,
  LUMI_AUTH_MODE_VERSION,
  type AppUserId,
  type FamilyId,
  type FamilyMembership,
  type MembershipId,
} from '../src/index.ts';

const userA = 'user-a' as AppUserId;
const userB = 'user-b' as AppUserId;
const family1 = 'family-1' as FamilyId;
const family2 = 'family-2' as FamilyId;

function membership(
  overrides: Partial<FamilyMembership> & Pick<FamilyMembership, 'appUserId' | 'familyId' | 'role'>,
): FamilyMembership {
  return {
    membershipId: `m-${overrides.appUserId}-${overrides.familyId}` as MembershipId,
    status: 'active',
    joinedAt: '2026-11-09T00:00:00.000Z',
    ...overrides,
  };
}

test('two families cannot read each other even with a guessed familyId', () => {
  const memberships = [
    membership({ appUserId: userA, familyId: family1, role: 'admin' }),
    membership({ appUserId: userB, familyId: family2, role: 'caregiver' }),
  ];
  assert.equal(
    authorizeFamilyAccess({ memberships, appUserId: userA, familyId: family2 }).allow,
    false,
  );
  assert.equal(
    authorizeFamilyAccess({ memberships, appUserId: userB, familyId: family1 }).allow,
    false,
  );
  assert.deepEqual(authorizeFamilyAccess({ memberships, appUserId: userA, familyId: family1 }), {
    allow: true,
    role: 'admin',
  });
});

test('revoked membership is denied and admin-only actions reject caregivers', () => {
  const memberships = [
    membership({ appUserId: userA, familyId: family1, role: 'caregiver' }),
    membership({
      appUserId: userB,
      familyId: family1,
      role: 'admin',
      status: 'revoked',
    }),
  ];
  const caregiverDenied = authorizeFamilyAccess({
    memberships,
    appUserId: userA,
    familyId: family1,
    requiredRoles: ['admin'],
  });
  assert.equal(caregiverDenied.allow, false);
  if (!caregiverDenied.allow) assert.equal(caregiverDenied.reason, 'role_denied');

  const revoked = authorizeFamilyAccess({
    memberships,
    appUserId: userB,
    familyId: family1,
  });
  assert.equal(revoked.allow, false);
  if (!revoked.allow) assert.equal(revoked.reason, 'revoked');
});

test('external identity binding ignores e-mail collisions and revoked links', () => {
  const bindings = [
    {
      appUserId: userA,
      issuer: 'https://idp.example/a',
      subject: 'sub-1',
      revokedAt: null,
    },
    {
      appUserId: userB,
      issuer: 'https://idp.example/b',
      subject: 'sub-1',
      revokedAt: null,
    },
    {
      appUserId: userA,
      issuer: 'https://idp.example/a',
      subject: 'old-sub',
      revokedAt: '2026-11-01T00:00:00.000Z',
    },
  ];
  assert.equal(
    resolveActiveBinding({
      bindings,
      issuer: 'https://idp.example/a',
      subject: 'sub-1',
    }),
    userA,
  );
  assert.equal(
    resolveActiveBinding({
      bindings,
      issuer: 'https://idp.example/b',
      subject: 'sub-1',
    }),
    userB,
  );
  assert.equal(
    resolveActiveBinding({
      bindings,
      issuer: 'https://idp.example/a',
      subject: 'old-sub',
    }),
    null,
  );
});

test('unknown auth mode holds local data instead of merging accounts', () => {
  assert.deepEqual(
    resolveAuthModeOrHold({ mode: 'oidc_keycloak_v1', version: LUMI_AUTH_MODE_VERSION }),
    {
      ok: true,
      mode: 'oidc_keycloak_v1',
    },
  );
  assert.deepEqual(resolveAuthModeOrHold({ mode: 'future_otp', version: LUMI_AUTH_MODE_VERSION }), {
    ok: false,
    holdLocalData: true,
    reason: 'unknown_mode',
  });
  assert.deepEqual(resolveAuthModeOrHold({ mode: 'oidc_keycloak_v1', version: 99 }), {
    ok: false,
    holdLocalData: true,
    reason: 'unsupported_version',
  });
});

test('caregiver cannot manage membership while admin can', () => {
  const memberships = [
    membership({ appUserId: userA, familyId: family1, role: 'caregiver' }),
    membership({ appUserId: userB, familyId: family1, role: 'admin' }),
  ];
  assert.equal(
    authorizeFamilyAdminAction({
      memberships,
      appUserId: userA,
      familyId: family1,
      action: 'erase_family',
    }).allow,
    false,
  );
  assert.equal(
    authorizeFamilyAdminAction({
      memberships,
      appUserId: userB,
      familyId: family1,
      action: 'invite',
    }).allow,
    true,
  );
});

test('revoking the last admin is rejected by the guard', () => {
  const memberships = [
    membership({
      appUserId: userA,
      familyId: family1,
      role: 'admin',
      membershipId: 'm-admin' as MembershipId,
    }),
    membership({
      appUserId: userB,
      familyId: family1,
      role: 'caregiver',
      membershipId: 'm-care' as MembershipId,
    }),
  ];
  assert.equal(
    wouldLeaveFamilyWithoutAdmin({
      memberships,
      familyId: family1,
      revokeMembershipId: 'm-admin',
    }),
    true,
  );
  assert.equal(
    wouldLeaveFamilyWithoutAdmin({
      memberships,
      familyId: family1,
      revokeMembershipId: 'm-care',
    }),
    false,
  );
});

test('similar name or birthday never auto-merges children', () => {
  const suggestion = suggestChildLinkDecision({
    localChildId: 'local-1',
    localDisplayName: 'Míša',
    localBirthDate: '2025-01-02',
    remoteChildId: 'remote-1',
    remoteDisplayName: 'míša',
    remoteBirthDate: '2025-01-02',
  });
  assert.equal(suggestion.autoMergeAllowed, false);
  assert.equal(suggestion.nameLooksSimilar, true);
  assert.equal(suggestion.birthDateLooksSimilar, true);
  assert.equal(suggestion.requiresExplicitDecision, true);

  const deferred = applyExplicitChildLinkDecision({
    decision: 'defer',
    localChildId: 'local-1',
    remoteChildId: 'remote-1',
  });
  assert.equal(deferred.ok, true);
  assert.equal(deferred.deferred, true);
  assert.equal(deferred.keepSeparateLocalChild, true);
});

test('local actor binding refuses claiming another member authorship', () => {
  const ok = bindLocalActorToAccount({
    localActorId: 'actor-1',
    authenticatedAppUserId: userA,
    claimedAuthorAppUserId: null,
  });
  assert.equal(ok.ok, true);
  const stolen = bindLocalActorToAccount({
    localActorId: 'actor-1',
    authenticatedAppUserId: userA,
    claimedAuthorAppUserId: userB,
  });
  assert.equal(stolen.ok, false);
});
