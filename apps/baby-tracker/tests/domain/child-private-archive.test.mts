import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asActorId,
  asChildId,
  asEntityId,
  asRevisionId,
  createChildPrivateArchive,
  createChildPrivateProject,
  createFamilyGuidedProject,
  createPortfolioItem,
  parseChildPrivateArchive,
  planShareSnapshot,
  publishShareSnapshot,
  revokeShareSnapshot,
  serializeChildPrivateArchive,
  applyChildPrivateArchiveToStaging,
  previewChildPrivateArchiveRestore,
  type Project,
  type ProjectTemplateRevision,
} from '../../src/domain/index.ts';
import {
  previewChildPrivateExport,
  stageChildPrivateArchiveRestore,
} from '../../src/application/exportChildPrivateWorkspace.ts';
import { PROJECT_TEMPLATES_PUBLISHED } from '../../src/content/catalog/projectTemplatesPublished.ts';

const template = PROJECT_TEMPLATES_PUBLISHED[0]! as ProjectTemplateRevision;
const now = { epochMs: 1_700_000_100_000 };
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
  const portfolio = [
    createPortfolioItem({
      portfolioItemId: asEntityId('port_mine'),
      project: mine,
      title: 'Výtvor',
      description: null,
      ownerAppUserId: OWNER,
      now,
      childPrivateModeActive: true,
    }),
    createPortfolioItem({
      portfolioItemId: asEntityId('port_sibling'),
      project: theirs,
      title: 'Cizí',
      description: null,
      ownerAppUserId: SIBLING,
      now,
      childPrivateModeActive: true,
    }),
  ];
  const activeShare = publishShareSnapshot({
    shareId: asEntityId('share_active'),
    draft: planShareSnapshot({
      project: mine,
      publishedTitle: 'Ukázka',
      publishedBody: 'Tělo',
      audienceAppUserIds: [PARENT],
      commentsEnabled: false,
      childPrivateModeActive: true,
    }),
    ownerAppUserId: OWNER,
    now,
  });
  const revokedShare = revokeShareSnapshot(
    publishShareSnapshot({
      shareId: asEntityId('share_revoked'),
      draft: planShareSnapshot({
        project: mine,
        publishedTitle: 'Stará',
        publishedBody: 'Tělo',
        audienceAppUserIds: [PARENT],
        commentsEnabled: false,
        childPrivateModeActive: true,
      }),
      ownerAppUserId: OWNER,
      now,
    }),
    { epochMs: now.epochMs + 1 },
  );
  return {
    mine,
    theirs,
    family,
    projects: [mine, theirs, family],
    portfolio,
    shares: [activeShare, revokedShare],
  };
}

test('archive file contains only the owner private surface and round-trips', () => {
  const f = fixture();
  const built = createChildPrivateArchive({
    ownerAppUserId: OWNER,
    childPrivateModeActive: true,
    createdAtMs: now.epochMs,
    projects: f.projects,
    portfolio: f.portfolio,
    shares: f.shares,
    filters: { includeRevokedShares: true },
  });
  assert.equal(built.ok, true);
  assert.equal(built.archive.format, 'lumi.child-private-archive.v1');
  assert.equal(built.archive.manifest.ownerAppUserId, OWNER);
  assert.equal(built.archive.manifest.projectCount, 1);
  assert.equal(built.archive.manifest.portfolioCount, 1);
  assert.equal(built.archive.manifest.shareCount, 2);
  assert.equal(built.archive.manifest.revokedShareCount, 1);
  assert.equal(built.archive.manifest.excludedFamilyHistory, true);
  assert.ok(!built.archive.projects.some((p) => p.projectId === 'proj_family'));
  assert.ok(!built.archive.projects.some((p) => p.ownerAppUserId === SIBLING));

  const json = serializeChildPrivateArchive(built.archive);
  const parsed = parseChildPrivateArchive(json);
  assert.equal(parsed.manifest.projectCount, 1);
  assert.equal(parsed.projects[0]?.projectId, 'proj_mine');
  assert.equal(parsed.shares.filter((s) => s.revokedAt != null).length, 1);
});

test('preview can materialize archive JSON without claiming live restore', () => {
  const f = fixture();
  const preview = previewChildPrivateExport({
    ownerAppUserId: OWNER,
    childPrivateModeActive: true,
    projects: f.projects,
    portfolio: f.portfolio,
    shares: f.shares,
    buildArchive: true,
    createdAtMs: now.epochMs,
    filters: { includeRevokedShares: true },
  });
  assert.equal(preview.available, true);
  assert.equal(preview.fileGenerated, true);
  assert.ok(preview.archiveJson?.includes('lumi.child-private-archive.v1'));
  assert.ok(preview.summaryLines.some((line) => /archiv/i.test(line)));
});

test('inactive mode refuses archive creation', () => {
  const f = fixture();
  const built = createChildPrivateArchive({
    ownerAppUserId: OWNER,
    childPrivateModeActive: false,
    createdAtMs: now.epochMs,
    projects: f.projects,
    portfolio: f.portfolio,
    shares: f.shares,
  });
  assert.equal(built.ok, false);
});

test('parser rejects diary payloads, credentials and foreign owners', () => {
  assert.throws(
    () =>
      parseChildPrivateArchive({
        format: 'lumi.child-private-archive.v1',
        manifest: {
          createdAtMs: 1,
          schemaCompatibility: 1,
          ownerAppUserId: OWNER,
          projectCount: 0,
          portfolioCount: 0,
          shareCount: 0,
          activeShareCount: 0,
          revokedShareCount: 0,
          excludedFamilyHistory: true,
          excludedCategories: ['family_care_history'],
        },
        projects: [],
        portfolio: [],
        shares: [],
        careEvents: [{ id: 'leak' }],
      }),
    /diary/i,
  );
  assert.throws(
    () =>
      parseChildPrivateArchive({
        format: 'lumi.child-private-archive.v1',
        credentials: { token: 'nope' },
        manifest: {
          createdAtMs: 1,
          schemaCompatibility: 1,
          ownerAppUserId: OWNER,
          projectCount: 0,
          portfolioCount: 0,
          shareCount: 0,
          activeShareCount: 0,
          revokedShareCount: 0,
          excludedFamilyHistory: true,
          excludedCategories: ['credentials'],
        },
        projects: [],
        portfolio: [],
        shares: [],
      }),
    /credential/i,
  );

  const f = fixture();
  const built = createChildPrivateArchive({
    ownerAppUserId: OWNER,
    childPrivateModeActive: true,
    createdAtMs: now.epochMs,
    projects: f.projects,
    portfolio: f.portfolio,
    shares: f.shares,
  });
  assert.equal(built.ok, true);
  const tampered = {
    ...built.archive,
    projects: [...built.archive.projects, f.theirs],
  };
  assert.throws(() => parseChildPrivateArchive(tampered), /owner/i);
});

test('soft restore staging replaces only the matching owner and keeps revoked shares revoked', () => {
  const f = fixture();
  const built = createChildPrivateArchive({
    ownerAppUserId: OWNER,
    childPrivateModeActive: true,
    createdAtMs: now.epochMs,
    projects: f.projects,
    portfolio: f.portfolio,
    shares: f.shares,
    filters: { includeRevokedShares: true },
  });
  assert.equal(built.ok, true);

  const liveMineExtra = privateProject('proj_live_extra', OWNER);
  const applied = applyChildPrivateArchiveToStaging({
    liveOwnerAppUserId: OWNER,
    childPrivateModeActive: true,
    supportedRecovery: true,
    liveProjects: [...f.projects, liveMineExtra],
    livePortfolio: f.portfolio,
    liveShares: f.shares,
    archive: built.archive,
  });
  assert.equal(applied.ok, true);
  assert.ok(!applied.staging.projects.some((p) => p.projectId === 'proj_live_extra'));
  assert.ok(applied.staging.projects.some((p) => p.projectId === 'proj_mine'));
  assert.ok(applied.staging.projects.some((p) => p.projectId === 'proj_sibling'));
  assert.ok(applied.staging.projects.some((p) => p.projectId === 'proj_family'));
  assert.equal(applied.revokedSharesPreserved, 1);
  assert.ok(
    applied.staging.shares.some(
      (share) => share.shareId === 'share_revoked' && share.revokedAt != null,
    ),
  );
});

test('two-account soft restore blocks a sibling archive in the owner workspace', () => {
  const f = fixture();
  const siblingArchive = createChildPrivateArchive({
    ownerAppUserId: SIBLING,
    childPrivateModeActive: true,
    createdAtMs: now.epochMs,
    projects: f.projects,
    portfolio: f.portfolio,
    shares: f.shares,
  });
  assert.equal(siblingArchive.ok, true);

  const preview = previewChildPrivateArchiveRestore({
    liveOwnerAppUserId: OWNER,
    childPrivateModeActive: true,
    supportedRecovery: true,
    liveProjects: f.projects,
    livePortfolio: f.portfolio,
    liveShares: f.shares,
    archive: siblingArchive.archive,
  });
  assert.equal(preview.status, 'blocked');
  assert.match(preview.blockedReason ?? '', /jiném/i);
  assert.equal(preview.liveRestoreClaimed, false);
  assert.equal(preview.familyHistoryAutoTransfer, false);

  const staged = stageChildPrivateArchiveRestore({
    liveOwnerAppUserId: OWNER,
    childPrivateModeActive: true,
    supportedRecovery: true,
    liveProjects: f.projects,
    livePortfolio: f.portfolio,
    liveShares: f.shares,
    rawArchive: serializeChildPrivateArchive(siblingArchive.archive),
  });
  assert.equal(staged.apply.ok, false);
  assert.equal(staged.apply.reason, 'owner_mismatch');
});

test('soft restore stays blocked while recovery gate is closed', () => {
  const f = fixture();
  const built = createChildPrivateArchive({
    ownerAppUserId: OWNER,
    childPrivateModeActive: true,
    createdAtMs: now.epochMs,
    projects: f.projects,
    portfolio: f.portfolio,
    shares: f.shares,
  });
  assert.equal(built.ok, true);
  const applied = applyChildPrivateArchiveToStaging({
    liveOwnerAppUserId: OWNER,
    childPrivateModeActive: true,
    supportedRecovery: false,
    liveProjects: f.projects,
    livePortfolio: f.portfolio,
    liveShares: f.shares,
    archive: built.archive,
  });
  assert.equal(applied.ok, false);
  assert.equal(applied.reason, 'recovery_gate_closed');
});
