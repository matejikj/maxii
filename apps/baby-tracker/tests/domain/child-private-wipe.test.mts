import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHILD_PRIVATE_WIPE_CONFIRMATION,
  applyChildPrivateWorkspaceWipe,
  asActorId,
  asChildId,
  asEntityId,
  asRevisionId,
  childPrivateWipeConfirmationMatches,
  createChildPrivateProject,
  createFamilyGuidedProject,
  createPortfolioItem,
  planChildPrivateWorkspaceWipe,
  planShareSnapshot,
  publishShareSnapshot,
  type PortfolioItem,
  type Project,
  type ProjectTemplateRevision,
  type ShareSnapshot,
  type UnitOfWorkFactory,
} from '../../src/domain/index.ts';
import { wipeChildPrivateWorkspace } from '../../src/application/wipeChildPrivateWorkspace.ts';
import { presentChildShellMyData } from '../../src/application/childShellMyData.ts';
import { attemptChildShellActivation } from '../../src/domain/index.ts';
import { PROJECT_TEMPLATES_PUBLISHED } from '../../src/content/catalog/projectTemplatesPublished.ts';

const template = PROJECT_TEMPLATES_PUBLISHED[0]! as ProjectTemplateRevision;
const now = { epochMs: 1_700_000_400_000 };
const OWNER = asActorId('child_owner');
const SIBLING = asActorId('child_sibling');
const PARENT = asActorId('parent_1');

function privateProject(id: string, owner: typeof OWNER): Project {
  return createChildPrivateProject({
    projectId: asEntityId(id),
    revisionId: asRevisionId(`rev_${id}`),
    childId: asChildId('child_a'),
    ownerAppUserId: owner,
    template,
    title: `Projekt ${id}`,
    intent: template.intent,
    now,
    createStepId: (index) => asEntityId(`${id}_step_${index}`),
    childPrivateModeActive: true,
  });
}

function fixture() {
  const mine = privateProject('proj_mine', OWNER);
  const theirs = privateProject('proj_sibling', SIBLING);
  const family = createFamilyGuidedProject({
    projectId: asEntityId('proj_family'),
    revisionId: asRevisionId('rev_family'),
    childId: asChildId('child_a'),
    creatorAppUserId: PARENT,
    familyId: 'family_1',
    template,
    now,
    createStepId: (index) => asEntityId(`fam_step_${index}`),
  });
  const portfolio: PortfolioItem[] = [
    createPortfolioItem({
      portfolioItemId: asEntityId('port_mine'),
      project: mine,
      title: 'CANARY_WIPE_MINE',
      description: null,
      ownerAppUserId: OWNER,
      now,
      childPrivateModeActive: true,
    }),
    createPortfolioItem({
      portfolioItemId: asEntityId('port_sibling'),
      project: theirs,
      title: 'CANARY_SIBLING',
      description: null,
      ownerAppUserId: SIBLING,
      now,
      childPrivateModeActive: true,
    }),
  ];
  const draft = planShareSnapshot({
    project: mine,
    publishedTitle: 'Ukázka',
    publishedBody: 'Jen toto.',
    audienceAppUserIds: [PARENT],
    childPrivateModeActive: true,
  });
  const share = publishShareSnapshot({
    shareId: asEntityId('share_mine'),
    ownerAppUserId: OWNER,
    draft,
    now,
  });
  return {
    projects: [mine, theirs, family] as Project[],
    portfolio,
    shares: [share] as ShareSnapshot[],
    mine,
    theirs,
    family,
  };
}

function memoryWipeUow(state: {
  projects: Project[];
  portfolio: PortfolioItem[];
  shares: ShareSnapshot[];
}): UnitOfWorkFactory {
  return {
    run: async (work) =>
      work({
        projects: {
          listAll: async () => [...state.projects],
          save: async (project) => {
            state.projects = [
              ...state.projects.filter((row) => row.projectId !== project.projectId),
              project,
            ];
          },
          clearAll: async () => {
            state.projects = [];
          },
        },
        portfolio: {
          listAll: async () => [...state.portfolio],
          save: async (item) => {
            state.portfolio = [
              ...state.portfolio.filter((row) => row.portfolioItemId !== item.portfolioItemId),
              item,
            ];
          },
          clearAll: async () => {
            state.portfolio = [];
          },
        },
        shares: {
          listAll: async () => [...state.shares],
          save: async (share) => {
            state.shares = [...state.shares.filter((row) => row.shareId !== share.shareId), share];
          },
          clearAll: async () => {
            state.shares = [];
          },
        },
      } as never),
  };
}

test('wipe plan selects only the owner childPrivate rows', () => {
  const { projects, portfolio, shares } = fixture();
  const plan = planChildPrivateWorkspaceWipe({
    ownerAppUserId: OWNER,
    principalAppUserId: OWNER,
    principalKind: 'owner',
    childPrivateModeActive: true,
    projects,
    portfolio,
    shares,
  });
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.deepEqual(plan.projectIds, [asEntityId('proj_mine')]);
  assert.deepEqual(plan.portfolioItemIds, [asEntityId('port_mine')]);
  assert.deepEqual(plan.shareIds, [asEntityId('share_mine')]);
  assert.equal(plan.familyGuidedPreserved, true);
  assert.equal(plan.liveAccountCancellation, false);
  assert.equal(plan.confirmationPhrase, CHILD_PRIVATE_WIPE_CONFIRMATION);
});

test('parent and sibling principals cannot plan a wipe of another workspace', () => {
  const { projects, portfolio, shares } = fixture();
  const parentPlan = planChildPrivateWorkspaceWipe({
    ownerAppUserId: OWNER,
    principalAppUserId: PARENT,
    principalKind: 'other_adult_admin',
    childPrivateModeActive: true,
    projects,
    portfolio,
    shares,
  });
  assert.deepEqual(parentPlan, { ok: false, reason: 'denied_not_owner' });

  const siblingPlan = planChildPrivateWorkspaceWipe({
    ownerAppUserId: OWNER,
    principalAppUserId: SIBLING,
    principalKind: 'owner',
    childPrivateModeActive: true,
    projects,
    portfolio,
    shares,
  });
  assert.deepEqual(siblingPlan, { ok: false, reason: 'denied_not_owner' });
});

test('inactive mode refuses wipe planning', () => {
  const { projects, portfolio, shares } = fixture();
  const plan = planChildPrivateWorkspaceWipe({
    ownerAppUserId: OWNER,
    principalAppUserId: OWNER,
    principalKind: 'owner',
    childPrivateModeActive: false,
    projects,
    portfolio,
    shares,
  });
  assert.deepEqual(plan, { ok: false, reason: 'child_mode_inactive' });
});

test('apply wipe drops owner rows and keeps sibling plus familyGuided', () => {
  const { projects, portfolio, shares } = fixture();
  const plan = planChildPrivateWorkspaceWipe({
    ownerAppUserId: OWNER,
    principalAppUserId: OWNER,
    principalKind: 'owner',
    childPrivateModeActive: true,
    projects,
    portfolio,
    shares,
  });
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  const staging = applyChildPrivateWorkspaceWipe({
    plan,
    projects,
    portfolio,
    shares,
    wipedAtMs: now.epochMs + 5,
  });
  assert.equal(staging.projects.length, 2);
  assert.ok(staging.projects.some((row) => row.projectId === asEntityId('proj_sibling')));
  assert.ok(staging.projects.some((row) => row.projectId === asEntityId('proj_family')));
  assert.equal(staging.portfolio.length, 1);
  assert.equal(staging.portfolio[0]?.title, 'CANARY_SIBLING');
  assert.equal(staging.shares.length, 0);
});

test('confirmation phrase must match exactly', () => {
  assert.equal(childPrivateWipeConfirmationMatches(CHILD_PRIVATE_WIPE_CONFIRMATION), true);
  assert.equal(childPrivateWipeConfirmationMatches(' SMAZAT VLASTNI '), true);
  assert.equal(childPrivateWipeConfirmationMatches('SMAZAT'), false);
  assert.equal(childPrivateWipeConfirmationMatches('smazat vlastni'), false);
});

test('UoW wipe removes canaries for the owner and leaves foreign private data', async () => {
  const seeded = fixture();
  const state = {
    projects: [...seeded.projects],
    portfolio: [...seeded.portfolio],
    shares: [...seeded.shares],
  };
  const unitOfWork = memoryWipeUow(state);

  const denied = await wipeChildPrivateWorkspace({
    unitOfWork,
    ownerAppUserId: OWNER,
    childPrivateModeActive: true,
    confirmationPhrase: 'SMAZAT',
    wipedAtMs: now.epochMs,
  });
  assert.deepEqual(denied, { ok: false, reason: 'confirmation_mismatch' });
  assert.equal(state.projects.length, 3);

  const wiped = await wipeChildPrivateWorkspace({
    unitOfWork,
    ownerAppUserId: OWNER,
    childPrivateModeActive: true,
    confirmationPhrase: CHILD_PRIVATE_WIPE_CONFIRMATION,
    wipedAtMs: now.epochMs + 1,
  });
  assert.equal(wiped.ok, true);
  if (!wiped.ok) return;
  assert.equal(wiped.projectCount, 1);
  assert.equal(wiped.portfolioCount, 1);
  assert.equal(wiped.shareCount, 1);
  assert.equal(wiped.liveAccountCancellation, false);
  assert.match(wiped.externalExportNote, /ručně/);

  assert.equal(state.projects.length, 2);
  assert.ok(!JSON.stringify(state.projects).includes('CANARY_WIPE_MINE'));
  assert.ok(JSON.stringify(state.portfolio).includes('CANARY_SIBLING'));
  assert.equal(state.shares.length, 0);
});

test('My data marks wipe available only in active mode with confirmation wording', () => {
  const activation = attemptChildShellActivation({
    gates: {
      verifiedChildIdentity: true,
      supportedRecovery: true,
      dedicatedDeviceOrAccount: true,
      legalOperationalFrameworkReady: true,
    },
    appUserId: OWNER,
    displayAlias: 'Mája',
    linkedChildProfileId: asChildId('child_a'),
    firstEntryCompleted: true,
  });
  assert.equal(activation.ok, true);
  const session = activation.session!;

  const inactive = presentChildShellMyData({
    session,
    childPrivateModeActive: false,
    portfolioCount: 0,
    activeShareCount: 0,
    appearanceStyleLabel: 'Les',
  });
  assert.equal(inactive.sections.find((row) => row.id === 'wipe')?.status, 'unavailable');

  const active = presentChildShellMyData({
    session,
    childPrivateModeActive: true,
    portfolioCount: 1,
    activeShareCount: 0,
    appearanceStyleLabel: 'Les',
    gateOverrides: {
      verifiedChildIdentity: true,
      supportedRecovery: true,
      dedicatedDeviceOrAccount: true,
      legalOperationalFrameworkReady: true,
    },
  });
  const wipe = active.sections.find((row) => row.id === 'wipe');
  assert.equal(wipe?.status, 'available');
  assert.match(wipe?.detail ?? '', /SMAZAT VLASTNI/);
  assert.match(wipe?.detail ?? '', /Live zrušení účtu to není/i);
});
