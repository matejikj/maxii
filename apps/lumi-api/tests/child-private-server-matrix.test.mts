import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  evaluateChildPrivateServerAccess,
  familyAdminIsChildPrivateSuperuserOnServer,
  type ChildPrivateServerAction,
  type ChildPrivateServerPrincipalKind,
  type ChildPrivateServerResource,
} from '../src/childPrivate/serverAccessMatrix.ts';

const OWNER = 'child_owner';
const RECIPIENT = 'parent_named';
const ADMIN = 'parent_admin';
const SIBLING = 'child_sibling';

const WRITE_ACTIONS: readonly ChildPrivateServerAction[] = [
  'write',
  'delete',
  'list',
  'count',
  'export',
  'restore',
  'wipe',
];

test('family admin is never a child-private superuser on the server matrix', () => {
  assert.equal(familyAdminIsChildPrivateSuperuserOnServer(), false);
});

test('owner session matching ownerAppUserId may perform every resource action', () => {
  const resources: readonly ChildPrivateServerResource[] = [
    'project',
    'portfolio',
    'share_snapshot',
    'list',
    'count',
    'export',
    'restore',
    'wipe',
  ];
  for (const resource of resources) {
    for (const action of ['read', ...WRITE_ACTIONS] as const) {
      const decision = evaluateChildPrivateServerAccess({
        principalKind: 'owner',
        sessionAppUserId: OWNER,
        resource,
        action,
        ownerAppUserId: OWNER,
      });
      assert.equal(decision.allowed, true, `${resource}/${action}`);
      assert.equal(decision.reason, 'owner');
    }
  }
});

test('spoofed owner kind with mismatched session is denied', () => {
  const decision = evaluateChildPrivateServerAccess({
    principalKind: 'owner',
    sessionAppUserId: ADMIN,
    resource: 'project',
    action: 'read',
    ownerAppUserId: OWNER,
  });
  assert.deepEqual(decision, { allowed: false, reason: 'denied_not_owner' });
});

test('family admin and caregiver never read private projects or counts', () => {
  for (const kind of ['other_adult_admin', 'other_adult_caregiver'] as const) {
    for (const resource of ['project', 'portfolio', 'list', 'count', 'export'] as const) {
      const decision = evaluateChildPrivateServerAccess({
        principalKind: kind,
        sessionAppUserId: ADMIN,
        resource,
        action: 'read',
        ownerAppUserId: OWNER,
      });
      assert.equal(decision.allowed, false, `${kind}/${resource}`);
      assert.equal(decision.reason, 'denied_family_admin');
    }
  }
});

test('sibling and foreign principals are denied across the matrix', () => {
  const rows: readonly {
    kind: ChildPrivateServerPrincipalKind;
    session: string;
    reason: string;
  }[] = [
    { kind: 'other_child', session: SIBLING, reason: 'denied_sibling' },
    { kind: 'foreign_family', session: 'stranger', reason: 'denied_foreign' },
    { kind: 'inactive_member', session: OWNER, reason: 'denied_inactive' },
  ];
  for (const row of rows) {
    const decision = evaluateChildPrivateServerAccess({
      principalKind: row.kind,
      sessionAppUserId: row.session,
      resource: 'project',
      action: 'read',
      ownerAppUserId: OWNER,
    });
    assert.deepEqual(decision, { allowed: false, reason: row.reason });
  }
});

test('named recipient may read only an active share they are listed on', () => {
  const active = evaluateChildPrivateServerAccess({
    principalKind: 'named_recipient',
    sessionAppUserId: RECIPIENT,
    resource: 'share_snapshot',
    action: 'read',
    ownerAppUserId: OWNER,
    share: { audienceAppUserIds: [RECIPIENT], revokedAtMs: null },
  });
  assert.deepEqual(active, { allowed: true, reason: 'named_recipient_read_share' });

  const liveProject = evaluateChildPrivateServerAccess({
    principalKind: 'named_recipient',
    sessionAppUserId: RECIPIENT,
    resource: 'project',
    action: 'read',
    ownerAppUserId: OWNER,
    share: { audienceAppUserIds: [RECIPIENT], revokedAtMs: null },
  });
  assert.deepEqual(liveProject, {
    allowed: false,
    reason: 'denied_live_project_to_recipient',
  });

  const revoked = evaluateChildPrivateServerAccess({
    principalKind: 'named_recipient',
    sessionAppUserId: RECIPIENT,
    resource: 'share_snapshot',
    action: 'read',
    ownerAppUserId: OWNER,
    share: { audienceAppUserIds: [RECIPIENT], revokedAtMs: 1 },
  });
  assert.deepEqual(revoked, { allowed: false, reason: 'denied_share_revoked' });

  const notAudience = evaluateChildPrivateServerAccess({
    principalKind: 'named_recipient',
    sessionAppUserId: ADMIN,
    resource: 'share_snapshot',
    action: 'read',
    ownerAppUserId: OWNER,
    share: { audienceAppUserIds: [RECIPIENT], revokedAtMs: null },
  });
  assert.deepEqual(notAudience, { allowed: false, reason: 'denied_not_in_audience' });
});
