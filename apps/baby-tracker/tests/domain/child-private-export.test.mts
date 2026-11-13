import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asActorId,
  asChildId,
  asEntityId,
  asRevisionId,
  createChildPrivateProject,
  createFamilyGuidedProject,
  createPortfolioItem,
  filterProjectsForFamilyExport,
  planChildPrivateExport,
  publishShareSnapshot,
  revokeShareSnapshot,
  planShareSnapshot,
  type Project,
  type ProjectTemplateRevision,
} from '../../src/domain/index.ts';
import { previewChildPrivateExport } from '../../src/application/exportChildPrivateWorkspace.ts';
import { PROJECT_TEMPLATES_PUBLISHED } from '../../src/content/catalog/projectTemplatesPublished.ts';

const template = PROJECT_TEMPLATES_PUBLISHED[0]! as ProjectTemplateRevision;
const now = { epochMs: 1_700_000_000_000 };
const OWNER = asActorId('child_owner');
const SIBLING = asActorId('child_sibling');
const PARENT = asActorId('parent_1');

function privateProject(id: string, owner: typeof OWNER, childId = 'child_a'): Project {
  return createChildPrivateProject({
    projectId: asEntityId(id),
    revisionId: asRevisionId(`rev_${id}`),
    childId: asChildId(childId),
    ownerAppUserId: owner,
    template,
    title: `Projekt ${id}`,
    intent: template.intent,
    now,
    createStepId: (index) => asEntityId(`${id}_step_${index}`),
    childPrivateModeActive: true,
  });
}

function familyProject(): Project {
  return createFamilyGuidedProject({
    projectId: asEntityId('proj_family'),
    revisionId: asRevisionId('rev_family'),
    childId: asChildId('child_a'),
    creatorAppUserId: PARENT,
    familyId: 'family_1',
    template,
    now,
    createStepId: (index) => asEntityId(`fam_step_${index}`),
  });
}

function fixture() {
  const mine = privateProject('proj_mine', OWNER);
  const mineClosed = { ...privateProject('proj_mine_closed', OWNER), status: 'closed' as const };
  const theirs = privateProject('proj_sibling', SIBLING);
  const family = familyProject();
  const item = (project: Project, owner: typeof OWNER, id: string) =>
    createPortfolioItem({
      portfolioItemId: asEntityId(id),
      project,
      title: 'Výtvor',
      description: null,
      ownerAppUserId: owner,
      now,
      childPrivateModeActive: true,
    });
  const portfolio = [item(mine, OWNER, 'port_mine'), item(theirs, SIBLING, 'port_sibling')];
  const share = (project: Project, owner: typeof OWNER, id: string) =>
    publishShareSnapshot({
      shareId: asEntityId(id),
      draft: planShareSnapshot({
        project,
        publishedTitle: 'Ukázka',
        publishedBody: 'Tělo',
        audienceAppUserIds: [PARENT],
        commentsEnabled: false,
        childPrivateModeActive: true,
      }),
      ownerAppUserId: owner,
      now,
    });
  const activeShare = share(mine, OWNER, 'share_active');
  const revokedShare = revokeShareSnapshot(share(mine, OWNER, 'share_revoked'), now);
  const foreignShare = share(theirs, SIBLING, 'share_foreign');
  return {
    mine,
    mineClosed,
    theirs,
    family,
    projects: [mine, mineClosed, theirs, family],
    portfolio,
    shares: [activeShare, revokedShare, foreignShare],
  };
}

test('owner export includes only own childPrivate project, portfolio and share counts', () => {
  const f = fixture();
  const plan = planChildPrivateExport({
    ownerAppUserId: OWNER,
    childPrivateModeActive: true,
    projects: f.projects,
    portfolio: f.portfolio,
    shares: f.shares,
  });
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.projects.map((p) => p.projectId).sort(), ['proj_mine', 'proj_mine_closed']);
  assert.ok(plan.projects.every((p) => p.scope === 'childPrivate' && p.ownerAppUserId === OWNER));
  assert.equal(plan.manifest?.ownerAppUserId, OWNER);
  assert.equal(plan.manifest?.projectCount, 2);
  assert.equal(plan.manifest?.portfolioCount, 1);
  assert.equal(plan.manifest?.shareCount, 1);
  assert.equal(plan.manifest?.activeShareCount, 1);
  assert.equal(plan.manifest?.excludedFamilyHistory, true);
});

test('owner export never contains familyGuided, foreign private, or foreign portfolio/shares', () => {
  const f = fixture();
  const plan = planChildPrivateExport({
    ownerAppUserId: OWNER,
    childPrivateModeActive: true,
    projects: f.projects,
    portfolio: f.portfolio,
    shares: f.shares,
    filters: { includeRevokedShares: true },
  });
  assert.ok(!plan.projects.some((p) => p.projectId === 'proj_family'));
  assert.ok(!plan.projects.some((p) => p.projectId === 'proj_sibling'));
  assert.ok(plan.portfolio.every((p) => p.ownerAppUserId === OWNER));
  assert.ok(plan.shares.every((s) => s.ownerAppUserId === OWNER));
  assert.equal(plan.manifest?.shareCount, 2);
  assert.equal(plan.manifest?.revokedShareCount, 1);
});

test('foreign owner export contains nothing of the first owner', () => {
  const f = fixture();
  const plan = planChildPrivateExport({
    ownerAppUserId: asActorId('stranger'),
    childPrivateModeActive: true,
    projects: f.projects,
    portfolio: f.portfolio,
    shares: f.shares,
  });
  assert.equal(plan.manifest?.projectCount, 0);
  assert.equal(plan.manifest?.portfolioCount, 0);
  assert.equal(plan.manifest?.shareCount, 0);
});

test('filters narrow the owner export without widening it', () => {
  const f = fixture();
  const base = {
    ownerAppUserId: OWNER,
    childPrivateModeActive: true,
    projects: f.projects,
    portfolio: f.portfolio,
    shares: f.shares,
  } as const;
  const closedOnly = planChildPrivateExport({ ...base, filters: { statuses: ['closed'] } });
  assert.deepEqual(
    closedOnly.projects.map((p) => p.projectId),
    ['proj_mine_closed'],
  );
  assert.equal(closedOnly.manifest?.portfolioCount, 0);
  const noPortfolio = planChildPrivateExport({
    ...base,
    filters: { includePortfolio: false, includeShares: false },
  });
  assert.equal(noPortfolio.manifest?.portfolioCount, 0);
  assert.equal(noPortfolio.manifest?.shareCount, 0);
  assert.equal(noPortfolio.manifest?.projectCount, 2);
  const otherChild = planChildPrivateExport({
    ...base,
    filters: { childId: asChildId('child_zzz') },
  });
  assert.equal(otherChild.manifest?.projectCount, 0);
  // Asking for a sibling's status never exposes the sibling's rows.
  const wide = planChildPrivateExport({
    ...base,
    filters: { statuses: ['idea', 'active', 'paused', 'closed', 'archived'] },
  });
  assert.ok(!wide.projects.some((p) => p.ownerAppUserId === SIBLING));
});

test('inactive mode blocks the whole export', () => {
  const f = fixture();
  const plan = planChildPrivateExport({
    ownerAppUserId: OWNER,
    childPrivateModeActive: false,
    projects: f.projects,
    portfolio: f.portfolio,
    shares: f.shares,
  });
  assert.equal(plan.ok, false);
  assert.equal(plan.manifest, null);
  assert.equal(plan.projects.length, 0);
  const preview = previewChildPrivateExport({
    ownerAppUserId: OWNER,
    childPrivateModeActive: false,
    projects: f.projects,
    portfolio: f.portfolio,
    shares: f.shares,
  });
  assert.equal(preview.available, false);
  assert.deepEqual(preview.summaryLines, []);
});

test('caregiver family export still excludes childPrivate even for the same owner id', () => {
  const f = fixture();
  for (const principalKind of ['owner', 'other_adult_admin', 'other_adult_caregiver'] as const) {
    const exported = filterProjectsForFamilyExport({
      projects: f.projects,
      principalKind,
      principalAppUserId: OWNER,
      childPrivateModeActive: true,
    });
    assert.ok(exported.every((p) => p.scope === 'familyGuided'));
    assert.ok(!exported.some((p) => p.scope === 'childPrivate'));
  }
});

test('preview summary lines are derived from counts and empty workspace says so', () => {
  const f = fixture();
  const preview = previewChildPrivateExport({
    ownerAppUserId: OWNER,
    childPrivateModeActive: true,
    projects: f.projects,
    portfolio: f.portfolio,
    shares: f.shares,
  });
  assert.equal(preview.available, true);
  assert.equal(preview.fileGenerated, false);
  assert.ok(preview.summaryLines.some((line) => line.includes('Projekty: 2')));
  const empty = previewChildPrivateExport({
    ownerAppUserId: OWNER,
    childPrivateModeActive: true,
    projects: [],
    portfolio: [],
    shares: [],
  });
  assert.match(empty.summaryLines[0] ?? '', /Zatím není co exportovat/);
});
