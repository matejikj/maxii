import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asActorId,
  asChildId,
  asEntityId,
  asRevisionId,
  createChildPrivateProject,
  createFamilyGuidedProject,
  evaluateProjectAccess,
  type ProjectAccessAction,
  type ProjectAccessContext,
  type ProjectPrincipalKind,
  type ProjectTemplateRevision,
} from '../../src/domain/index.ts';
import { PROJECT_TEMPLATES_PUBLISHED } from '../../src/content/catalog/projectTemplatesPublished.ts';

const template = PROJECT_TEMPLATES_PUBLISHED[0]! as ProjectTemplateRevision;
const now = { epochMs: 1_700_000_000_000 };
const OWNER = asActorId('child_owner');
const RECIPIENT = asActorId('parent_named');

const ACTIONS: readonly ProjectAccessAction[] = [
  'create',
  'read',
  'update',
  'delete',
  'export',
  'list',
  'count',
  'share_publish',
  'share_revoke',
  'restore',
];

const privateProject = createChildPrivateProject({
  projectId: asEntityId('proj_matrix_private'),
  revisionId: asRevisionId('rev_matrix'),
  childId: asChildId('child_a'),
  ownerAppUserId: OWNER,
  template,
  title: template.title,
  intent: template.intent,
  now,
  createStepId: (index) => asEntityId(`mstep_${index}`),
  childPrivateModeActive: true,
});

const activeShare = {
  ownerAppUserId: OWNER,
  audienceAppUserIds: [RECIPIENT],
  revokedAt: null,
} as const;

type Row = {
  name: string;
  principalKind: ProjectPrincipalKind;
  principalAppUserId: ReturnType<typeof asActorId> | null;
  share?: ProjectAccessContext['share'];
  /** Actions that are allowed (mode active); everything else must deny. */
  allowed: readonly ProjectAccessAction[];
  denyReason: string;
  allowedReason?: string;
};

const ROWS: readonly Row[] = [
  {
    name: 'owner',
    principalKind: 'owner',
    principalAppUserId: OWNER,
    allowed: ACTIONS,
    denyReason: 'n/a',
    allowedReason: 'owner',
  },
  {
    name: 'named recipient with active share',
    principalKind: 'named_recipient',
    principalAppUserId: RECIPIENT,
    share: activeShare,
    allowed: ['read', 'list', 'count'],
    denyReason: 'denied_child_private',
    allowedReason: 'named_recipient_read_share',
  },
  {
    name: 'named recipient without share',
    principalKind: 'named_recipient',
    principalAppUserId: RECIPIENT,
    allowed: [],
    denyReason: 'denied_child_private',
  },
  {
    name: 'named recipient with revoked share',
    principalKind: 'named_recipient',
    principalAppUserId: RECIPIENT,
    share: { ...activeShare, revokedAt: { epochMs: now.epochMs + 1 } },
    allowed: [],
    denyReason: 'denied_child_private',
  },
  {
    name: 'named recipient not in audience',
    principalKind: 'named_recipient',
    principalAppUserId: asActorId('parent_other'),
    share: activeShare,
    allowed: [],
    denyReason: 'denied_child_private',
  },
  {
    name: 'named recipient with share from another owner',
    principalKind: 'named_recipient',
    principalAppUserId: RECIPIENT,
    share: { ...activeShare, ownerAppUserId: asActorId('someone_else') },
    allowed: [],
    denyReason: 'denied_child_private',
  },
  {
    name: 'owner kind with a different app user',
    principalKind: 'owner',
    principalAppUserId: asActorId('sibling_user'),
    allowed: [],
    denyReason: 'denied_child_private',
  },
  {
    name: 'owner kind without app user id',
    principalKind: 'owner',
    principalAppUserId: null,
    allowed: [],
    denyReason: 'denied_child_private',
  },
  {
    name: 'family admin',
    principalKind: 'other_adult_admin',
    principalAppUserId: asActorId('admin_1'),
    allowed: [],
    denyReason: 'denied_child_private',
  },
  {
    name: 'other adult caregiver',
    principalKind: 'other_adult_caregiver',
    principalAppUserId: asActorId('caregiver_2'),
    allowed: [],
    denyReason: 'denied_child_private',
  },
  {
    name: 'other child',
    principalKind: 'other_child',
    principalAppUserId: asActorId('sibling_user'),
    allowed: [],
    denyReason: 'denied_other_child',
  },
  {
    name: 'foreign family',
    principalKind: 'foreign_family',
    principalAppUserId: asActorId('stranger'),
    allowed: [],
    denyReason: 'denied_foreign',
  },
  {
    name: 'inactive member',
    principalKind: 'inactive_member',
    principalAppUserId: asActorId('former_member'),
    allowed: [],
    denyReason: 'denied_inactive',
  },
];

test('childPrivate grid: every principal × action decision matches the expected table (mode active)', () => {
  let cells = 0;
  for (const row of ROWS) {
    for (const action of ACTIONS) {
      const decision = evaluateProjectAccess(action, {
        principalKind: row.principalKind,
        principalAppUserId: row.principalAppUserId,
        childPrivateModeActive: true,
        project: privateProject,
        share: row.share ?? null,
      });
      const shouldAllow = row.allowed.includes(action);
      assert.equal(
        decision.allowed,
        shouldAllow,
        `${row.name} × ${action}: expected allowed=${shouldAllow}, got ${decision.reason}`,
      );
      assert.equal(
        decision.reason,
        shouldAllow ? row.allowedReason : row.denyReason,
        `${row.name} × ${action} reason`,
      );
      cells += 1;
    }
  }
  assert.equal(cells, ROWS.length * ACTIONS.length);
});

test('childPrivate grid: inactive mode denies every action for every principal that is not blocked earlier', () => {
  for (const row of ROWS) {
    for (const action of ACTIONS) {
      const decision = evaluateProjectAccess(action, {
        principalKind: row.principalKind,
        principalAppUserId: row.principalAppUserId,
        childPrivateModeActive: false,
        project: privateProject,
        share: row.share ?? null,
      });
      assert.equal(
        decision.allowed,
        false,
        `${row.name} × ${action} must deny while mode is closed`,
      );
      const earlyDenied: Partial<Record<ProjectPrincipalKind, string>> = {
        foreign_family: 'denied_foreign',
        inactive_member: 'denied_inactive',
        other_child: 'denied_other_child',
      };
      assert.equal(decision.reason, earlyDenied[row.principalKind] ?? 'child_mode_inactive');
    }
  }
});

test('export, list, count and restore deny every non-owner principal on childPrivate', () => {
  const guarded: readonly ProjectAccessAction[] = ['export', 'restore', 'list', 'count'];
  for (const row of ROWS.filter((r) => r.name !== 'owner')) {
    for (const action of guarded) {
      const decision = evaluateProjectAccess(action, {
        principalKind: row.principalKind,
        principalAppUserId: row.principalAppUserId,
        childPrivateModeActive: true,
        project: privateProject,
        share: row.share ?? null,
      });
      const recipientMayListOrCount =
        row.name === 'named recipient with active share' &&
        (action === 'list' || action === 'count');
      assert.equal(decision.allowed, recipientMayListOrCount, `${row.name} × ${action}`);
    }
  }
});

test('export and restore always deny a named recipient even with an active share', () => {
  for (const action of [
    'export',
    'restore',
    'update',
    'delete',
    'share_publish',
    'share_revoke',
    'create',
  ] as const) {
    const decision = evaluateProjectAccess(action, {
      principalKind: 'named_recipient',
      principalAppUserId: RECIPIENT,
      childPrivateModeActive: true,
      project: privateProject,
      share: activeShare,
    });
    assert.equal(decision.allowed, false, action);
    assert.equal(decision.reason, 'denied_child_private');
  }
});

test('foreign, inactive and other-child principals are denied on familyGuided too', () => {
  const family = createFamilyGuidedProject({
    projectId: asEntityId('proj_matrix_family'),
    revisionId: asRevisionId('rev_matrix_family'),
    childId: asChildId('child_a'),
    creatorAppUserId: asActorId('caregiver_1'),
    familyId: 'family_1',
    template,
    now,
    createStepId: (index) => asEntityId(`fstep_${index}`),
  });
  for (const principalKind of ['foreign_family', 'inactive_member', 'other_child'] as const) {
    for (const action of ACTIONS) {
      const decision = evaluateProjectAccess(action, {
        principalKind,
        principalAppUserId: asActorId('x'),
        childPrivateModeActive: true,
        project: family,
      });
      assert.equal(decision.allowed, false, `${principalKind} × ${action}`);
    }
  }
});
