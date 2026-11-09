import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asActorId,
  asChildId,
  asEntityId,
  asRevisionId,
  canActivateChildPrivateMode,
  createChildPrivateProject,
  createFamilyGuidedProject,
  evaluateProjectAccess,
  familyAdminIsChildPrivateSuperuser,
  isChildPrivateModeActive,
  planPrivateTakeoverCopy,
  shareExposesLivePrivateProject,
  type ProjectTemplateRevision,
} from '../../src/domain/index.ts';
import { PROJECT_TEMPLATES_PUBLISHED } from '../../src/content/catalog/projectTemplatesPublished.ts';

const template = PROJECT_TEMPLATES_PUBLISHED[0]! as ProjectTemplateRevision;
const now = { epochMs: 1_700_000_000_000 };

function familyProject() {
  return createFamilyGuidedProject({
    projectId: asEntityId('proj_family'),
    revisionId: asRevisionId('rev_1'),
    childId: asChildId('child_a'),
    creatorAppUserId: asActorId('caregiver_1'),
    familyId: 'family_1',
    template,
    now,
    createStepId: (index) => asEntityId(`step_${index}`),
  });
}

test('family admin is never a childPrivate superuser', () => {
  assert.equal(familyAdminIsChildPrivateSuperuser(), false);
});

test('share never exposes live private project revisions', () => {
  assert.equal(shareExposesLivePrivateProject(), false);
});

test('child private mode stays inactive until all gates pass', () => {
  assert.equal(isChildPrivateModeActive(), false);
  assert.equal(
    canActivateChildPrivateMode({
      verifiedChildIdentity: true,
      supportedRecovery: true,
      dedicatedDeviceOrAccount: true,
      legalOperationalFrameworkReady: true,
    }).active,
    true,
  );
});

test('privacy matrix denies childPrivate to family admin and other caregivers', () => {
  const project = createChildPrivateProject({
    projectId: asEntityId('proj_private'),
    revisionId: asRevisionId('rev_p'),
    childId: asChildId('child_a'),
    ownerAppUserId: asActorId('child_user'),
    template,
    title: template.title,
    intent: template.intent,
    now,
    createStepId: (index) => asEntityId(`pstep_${index}`),
    childPrivateModeActive: true,
  });

  for (const principalKind of ['other_adult_admin', 'other_adult_caregiver'] as const) {
    const decision = evaluateProjectAccess('read', {
      principalKind,
      principalAppUserId: asActorId('admin_1'),
      childPrivateModeActive: true,
      project,
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, 'denied_child_private');
  }
});

test('named recipient may read only an active share snapshot, not live private', () => {
  const project = createChildPrivateProject({
    projectId: asEntityId('proj_private2'),
    revisionId: asRevisionId('rev_p2'),
    childId: asChildId('child_a'),
    ownerAppUserId: asActorId('child_user'),
    template,
    title: template.title,
    intent: template.intent,
    now,
    createStepId: (index) => asEntityId(`pstep2_${index}`),
    childPrivateModeActive: true,
  });
  const recipient = asActorId('parent_named');
  const allowed = evaluateProjectAccess('read', {
    principalKind: 'named_recipient',
    principalAppUserId: recipient,
    childPrivateModeActive: true,
    project,
    share: {
      ownerAppUserId: asActorId('child_user'),
      audienceAppUserIds: [recipient],
      revokedAt: null,
    },
  });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.reason, 'named_recipient_read_share');

  const writeDenied = evaluateProjectAccess('update', {
    principalKind: 'named_recipient',
    principalAppUserId: recipient,
    childPrivateModeActive: true,
    project,
    share: {
      ownerAppUserId: asActorId('child_user'),
      audienceAppUserIds: [recipient],
      revokedAt: null,
    },
  });
  assert.equal(writeDenied.allowed, false);
});

test('familyGuided is readable by caregivers and writable by creator', () => {
  const project = familyProject();
  assert.equal(
    evaluateProjectAccess('read', {
      principalKind: 'other_adult_caregiver',
      principalAppUserId: asActorId('other_care'),
      childPrivateModeActive: false,
      project,
    }).allowed,
    true,
  );
  assert.equal(
    evaluateProjectAccess('update', {
      principalKind: 'other_adult_caregiver',
      principalAppUserId: asActorId('other_care'),
      childPrivateModeActive: false,
      project,
    }).allowed,
    false,
  );
  assert.equal(
    evaluateProjectAccess('update', {
      principalKind: 'owner',
      principalAppUserId: asActorId('caregiver_1'),
      childPrivateModeActive: false,
      project,
    }).allowed,
    true,
  );
});

test('private takeover copies without flipping the original scope', () => {
  const source = familyProject();
  const planned = planPrivateTakeoverCopy({
    source,
    newProjectId: asEntityId('proj_copy'),
    newRevisionId: asRevisionId('rev_copy'),
    ownerAppUserId: asActorId('child_user'),
    now,
    remapStepId: (_stepId, index) => asEntityId(`copy_step_${index}`),
    childPrivateModeActive: true,
  });
  assert.equal(planned.sourceUnchangedScope, 'familyGuided');
  assert.equal(planned.copy.scope, 'childPrivate');
  assert.equal(source.scope, 'familyGuided');
  assert.notEqual(planned.copy.projectId, source.projectId);
});

test('child private create refuses when mode is inactive', () => {
  assert.throws(
    () =>
      createChildPrivateProject({
        projectId: asEntityId('proj_blocked'),
        revisionId: asRevisionId('rev_blocked'),
        childId: asChildId('child_a'),
        ownerAppUserId: asActorId('child_user'),
        template,
        title: template.title,
        intent: template.intent,
        now,
        createStepId: (index) => asEntityId(`bstep_${index}`),
        childPrivateModeActive: false,
      }),
    /not activated/,
  );
});
