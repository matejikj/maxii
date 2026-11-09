import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHILD_SHELL_FIRST_ENTRY,
  CHILD_SHELL_TABS,
  asActorId,
  asChildId,
  asEntityId,
  asRevisionId,
  attemptChildShellActivation,
  childShellAllowsRoute,
  createChildPrivateProject,
  isChildPrivateModeActive,
  normalizeChildDisplayAlias,
  planPrincipalWorkspaceHandoff,
  resolveRootShellKind,
  selectChildShellTodayProjects,
  type ProjectTemplateRevision,
} from '../../src/domain/index.ts';
import {
  presentChildShellAvailability,
  resolveActiveRootShell,
  tryActivateChildShell,
} from '../../src/application/childShell.ts';
import { PROJECT_TEMPLATES_PUBLISHED } from '../../src/content/catalog/projectTemplatesPublished.ts';

const template = PROJECT_TEMPLATES_PUBLISHED[0]! as ProjectTemplateRevision;
const now = { epochMs: 1_700_000_000_000 };
const openGates = {
  verifiedChildIdentity: true,
  supportedRecovery: true,
  dedicatedDeviceOrAccount: true,
  legalOperationalFrameworkReady: true,
} as const;

test('production personal build keeps child shell unavailable', () => {
  assert.equal(isChildPrivateModeActive(), false);
  assert.equal(resolveActiveRootShell(), 'caregiver');
  const availability = presentChildShellAvailability();
  assert.equal(availability.available, false);
  assert.equal(availability.fifthTab, false);
  assert.equal(availability.profileInHeader, true);
  assert.equal(availability.tabs.length, 4);
  assert.deepEqual(
    availability.tabs.map((tab) => tab.title),
    ['Dnes', 'Projekty', 'Portfolio', 'Objevování'],
  );
  assert.equal(CHILD_SHELL_FIRST_ENTRY.includesAbilityTest, false);
  assert.equal(CHILD_SHELL_FIRST_ENTRY.includesCareerPath, false);
});

test('child shell forbids caregiver care and history routes', () => {
  assert.equal(childShellAllowsRoute('today'), true);
  assert.equal(childShellAllowsRoute('projects'), true);
  assert.equal(childShellAllowsRoute('Care'), false);
  assert.equal(childShellAllowsRoute('History'), false);
  assert.equal(childShellAllowsRoute('care_quick_actions'), false);
  assert.equal(childShellAllowsRoute('family_global_search'), false);
});

test('activation refuses until every gate passes and rejects DOB-like aliases', () => {
  const blocked = tryActivateChildShell({
    appUserId: asActorId('child_user'),
    displayAlias: 'Mája',
  });
  assert.equal(blocked.ok, false);
  assert.ok(blocked.blockers.includes('verified_child_identity'));

  assert.throws(() => normalizeChildDisplayAlias('2015-04-01'), /Date of birth/);
  assert.throws(() => normalizeChildDisplayAlias(''), /required/);

  const activated = attemptChildShellActivation({
    gates: openGates,
    appUserId: asActorId('child_user'),
    displayAlias: '  Mája  ',
    linkedChildProfileId: asChildId('child_a'),
  });
  assert.equal(activated.ok, true);
  assert.equal(activated.session?.principal.displayAlias, 'Mája');
  assert.equal(activated.session?.tabs.length, CHILD_SHELL_TABS.length);
  assert.equal(
    resolveRootShellKind({
      childSession: activated.session,
      childPrivateModeActive: true,
    }),
    'child',
  );
  assert.equal(
    resolveActiveRootShell({
      session: activated.session,
      gateOverrides: openGates,
    }),
    'child',
  );
});

test('principal switch clears foreign drafts and never reopens the wrong workspace', () => {
  const handoff = planPrincipalWorkspaceHandoff({
    previousAppUserId: 'caregiver_1',
    nextAppUserId: 'child_user',
    openDraftOwnerAppUserId: 'caregiver_1',
    openJobCount: 2,
  });
  assert.equal(handoff.switched, true);
  assert.equal(handoff.clearOpenDraft, true);
  assert.equal(handoff.isolateOpenJobs, true);
  assert.equal(handoff.reopenWrongWorkspace, false);
});

test('child today lists at most three own private projects', () => {
  const owner = asActorId('child_user');
  const sibling = asActorId('other_child');
  const projects = [0, 1, 2, 3].map((index) =>
    createChildPrivateProject({
      projectId: asEntityId(`proj_${index}`),
      revisionId: asRevisionId(`rev_${index}`),
      childId: asChildId('child_a'),
      ownerAppUserId: index === 3 ? sibling : owner,
      template,
      title: `Projekt ${index}`,
      intent: template.intent,
      now,
      createStepId: (step) => asEntityId(`step_${index}_${step}`),
      childPrivateModeActive: true,
    }),
  );
  const today = selectChildShellTodayProjects(projects, owner);
  assert.equal(today.length, 3);
  assert.equal(
    today.every((row) => row.ownerAppUserId === owner),
    true,
  );
});
