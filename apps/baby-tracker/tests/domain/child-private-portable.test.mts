import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asActorId,
  asChildId,
  asEntityId,
  asRevisionId,
  createChildPrivateProject,
  createDiaryArchive,
  createFamilyGuidedProject,
  createPortfolioItem,
  planShareSnapshot,
  publishShareSnapshot,
  type Project,
  type ProjectTemplateRevision,
} from '../../src/domain/index.ts';
import {
  childPrivatePortableFileName,
  openSealedChildPrivatePortable,
  sealChildPrivatePortableArchive,
} from '../../src/application/sealChildPrivatePortable.ts';
import { presentChildShellMyData } from '../../src/application/childShellMyData.ts';
import { attemptChildShellActivation } from '../../src/domain/index.ts';
import {
  DEFAULT_ARGON2ID_PARAMS,
  sealPortableBackup,
  serializePortableBackup,
} from '../../src/infrastructure/crypto/portableBackup.ts';
import { PROJECT_TEMPLATES_PUBLISHED } from '../../src/content/catalog/projectTemplatesPublished.ts';
import { AppError } from '../../src/domain/errors.ts';

const template = PROJECT_TEMPLATES_PUBLISHED[0]! as ProjectTemplateRevision;
const now = { epochMs: 1_700_000_200_000 };
const OWNER = asActorId('child_owner');
const SIBLING = asActorId('child_sibling');
const PARENT = asActorId('parent_1');
const FAST_ARGON = { ...DEFAULT_ARGON2ID_PARAMS, t: 1, m: 32 };

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
  ];
  const share = publishShareSnapshot({
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
  return {
    mine,
    projects: [mine, theirs, family],
    portfolio,
    shares: [share],
  };
}

test('sealed portable child archive round-trips and excludes family rows', () => {
  const f = fixture();
  const sealed = sealChildPrivatePortableArchive({
    ownerAppUserId: OWNER,
    childPrivateModeActive: true,
    password: 'child-recovery-phrase',
    createdAtMs: now.epochMs,
    projects: f.projects,
    portfolio: f.portfolio,
    shares: f.shares,
    argonParams: FAST_ARGON,
  });
  assert.equal(sealed.ok, true);
  assert.equal(sealed.sealed, true);
  assert.equal(sealed.credentialsIncluded, false);
  assert.equal(sealed.familyHistoryIncluded, false);
  assert.match(sealed.fileName, /^lumi-child-private-archive-/);
  assert.equal(sealed.fileName, childPrivatePortableFileName(now.epochMs));
  assert.ok(!sealed.archive.projects.some((p) => p.projectId === 'proj_family'));
  assert.ok(!sealed.archive.projects.some((p) => p.ownerAppUserId === SIBLING));

  const opened = openSealedChildPrivatePortable({
    serializedEnvelope: sealed.serialized,
    password: 'child-recovery-phrase',
    liveOwnerAppUserId: OWNER,
    childPrivateModeActive: true,
    supportedRecovery: true,
    liveProjects: f.projects,
    livePortfolio: f.portfolio,
    liveShares: f.shares,
  });
  assert.equal(opened.archive.manifest.projectCount, 1);
  assert.equal(opened.preview.status, 'ready');
  assert.equal(opened.apply.ok, true);
  assert.ok(opened.apply.staging.projects.some((p) => p.projectId === 'proj_mine'));
});

test('sealed export refuses inactive mode and empty password', () => {
  const f = fixture();
  assert.deepEqual(
    sealChildPrivatePortableArchive({
      ownerAppUserId: OWNER,
      childPrivateModeActive: false,
      password: 'x',
      createdAtMs: now.epochMs,
      projects: f.projects,
      portfolio: f.portfolio,
      shares: f.shares,
      argonParams: FAST_ARGON,
    }),
    { ok: false, reason: 'child_mode_inactive' },
  );
  assert.deepEqual(
    sealChildPrivatePortableArchive({
      ownerAppUserId: OWNER,
      childPrivateModeActive: true,
      password: '',
      createdAtMs: now.epochMs,
      projects: f.projects,
      portfolio: f.portfolio,
      shares: f.shares,
      argonParams: FAST_ARGON,
    }),
    { ok: false, reason: 'empty_password' },
  );
});

test('wrong password fails closed without staging apply', () => {
  const f = fixture();
  const sealed = sealChildPrivatePortableArchive({
    ownerAppUserId: OWNER,
    childPrivateModeActive: true,
    password: 'right-password',
    createdAtMs: now.epochMs,
    projects: f.projects,
    portfolio: f.portfolio,
    shares: f.shares,
    argonParams: FAST_ARGON,
  });
  assert.equal(sealed.ok, true);
  assert.throws(
    () =>
      openSealedChildPrivatePortable({
        serializedEnvelope: sealed.serialized,
        password: 'wrong-password',
        liveOwnerAppUserId: OWNER,
        childPrivateModeActive: true,
        supportedRecovery: true,
        liveProjects: f.projects,
        livePortfolio: f.portfolio,
        liveShares: f.shares,
      }),
    (error: unknown) => error instanceof AppError && error.code === 'CRYPTO',
  );
});

test('diary portable envelope is rejected as a child private archive', () => {
  const diary = createDiaryArchive({
    createdAtMs: now.epochMs,
    schemaCompatibility: 8,
    profiles: [],
    careEvents: [],
    sessions: [],
    drafts: [],
    revisions: [],
    receipts: [],
    deletions: [],
    meta: [],
  });
  const envelope = sealPortableBackup(
    new TextEncoder().encode(JSON.stringify(diary)),
    'diary-password',
    FAST_ARGON,
  );
  assert.throws(
    () =>
      openSealedChildPrivatePortable({
        serializedEnvelope: serializePortableBackup(envelope),
        password: 'diary-password',
        liveOwnerAppUserId: OWNER,
        childPrivateModeActive: true,
        supportedRecovery: true,
        liveProjects: [],
        livePortfolio: [],
        liveShares: [],
      }),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION',
  );
});

test('sibling sealed archive cannot soft-restore into the owner workspace', () => {
  const f = fixture();
  const sealed = sealChildPrivatePortableArchive({
    ownerAppUserId: SIBLING,
    childPrivateModeActive: true,
    password: 'sibling-password',
    createdAtMs: now.epochMs,
    projects: f.projects,
    portfolio: f.portfolio,
    shares: f.shares,
    argonParams: FAST_ARGON,
  });
  assert.equal(sealed.ok, true);
  const opened = openSealedChildPrivatePortable({
    serializedEnvelope: sealed.serialized,
    password: 'sibling-password',
    liveOwnerAppUserId: OWNER,
    childPrivateModeActive: true,
    supportedRecovery: true,
    liveProjects: f.projects,
    livePortfolio: f.portfolio,
    liveShares: f.shares,
  });
  assert.equal(opened.preview.status, 'blocked');
  assert.equal(opened.apply.ok, false);
  assert.equal(opened.apply.reason, 'owner_mismatch');
});

test('my data names a sealed portable file only when one was prepared', () => {
  const openGates = {
    verifiedChildIdentity: true,
    supportedRecovery: true,
    dedicatedDeviceOrAccount: true,
    legalOperationalFrameworkReady: true,
  } as const;
  const activation = attemptChildShellActivation({
    gates: openGates,
    appUserId: OWNER,
    displayAlias: 'Mája',
    linkedChildProfileId: asChildId('child_a'),
    firstEntryCompleted: true,
  });
  assert.equal(activation.ok, true);
  const without = presentChildShellMyData({
    session: activation.session!,
    childPrivateModeActive: true,
    portfolioCount: 1,
    activeShareCount: 0,
    appearanceStyleLabel: 'Les',
    gateOverrides: openGates,
    exportPreview: {
      available: true,
      manifest: {
        ownerAppUserId: OWNER,
        projectCount: 1,
        portfolioCount: 1,
        shareCount: 0,
        activeShareCount: 0,
        revokedShareCount: 0,
        excludedFamilyHistory: true,
        excludedCategories: [],
      },
      summaryLines: ['Projekty: 1'],
      fileGenerated: true,
      archive: null,
      archiveJson: null,
    },
  });
  assert.match(
    without.sections.find((row) => row.id === 'export')?.detail ?? '',
    /Heslem chráněný přenosný soubor vznikne jen po výslovném exportu/,
  );
  assert.equal(without.sealedPortableFileName, null);

  const withFile = presentChildShellMyData({
    session: activation.session!,
    childPrivateModeActive: true,
    portfolioCount: 1,
    activeShareCount: 0,
    appearanceStyleLabel: 'Les',
    gateOverrides: openGates,
    exportPreview: without.exportPreview,
    sealedPortableFileName: 'lumi-child-private-archive-demo.json',
  });
  assert.equal(withFile.sealedPortableFileName, 'lumi-child-private-archive-demo.json');
  assert.match(
    withFile.sections.find((row) => row.id === 'export')?.detail ?? '',
    /lumi-child-private-archive-demo\.json/,
  );
});
