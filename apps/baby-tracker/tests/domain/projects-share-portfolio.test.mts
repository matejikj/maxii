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
  filterSharesForRequester,
  planShareSnapshot,
  presentShareToRecipient,
  publishShareSnapshot,
  restoreMustNotRepublishShare,
  revokeShareSnapshot,
  type ProjectTemplateRevision,
} from '../../src/domain/index.ts';
import { PROJECT_TEMPLATES_PUBLISHED } from '../../src/content/catalog/projectTemplatesPublished.ts';

const template = PROJECT_TEMPLATES_PUBLISHED[0]! as ProjectTemplateRevision;
const now = { epochMs: 1_700_000_100_000 };
const childOwner = asActorId('child_user');
const parentNamed = asActorId('parent_named');
const otherAdmin = asActorId('family_admin');

function privateProject() {
  return createChildPrivateProject({
    projectId: asEntityId('proj_private'),
    revisionId: asRevisionId('rev_private_1'),
    childId: asChildId('child_a'),
    ownerAppUserId: childOwner,
    template,
    title: template.title,
    intent: 'Původní záměr',
    now,
    createStepId: (index) => asEntityId(`s_${index}`),
    childPrivateModeActive: true,
  });
}

test('share snapshot freezes body so later private edits do not leak', () => {
  const project = privateProject();
  const draft = planShareSnapshot({
    project,
    publishedTitle: 'Ukázka mostu',
    publishedBody: 'Jen tato věta.',
    audienceAppUserIds: [parentNamed],
    childPrivateModeActive: true,
  });
  const share = publishShareSnapshot({
    shareId: asEntityId('share_1'),
    draft,
    ownerAppUserId: childOwner,
    now,
  });
  const edited = {
    ...project,
    intent: 'Tajná reflexe po sdílení',
    revisionId: asRevisionId('rev_private_2'),
  };
  const presented = presentShareToRecipient(share, edited);
  assert.equal(presented.body, 'Jen tato věta.');
  assert.equal(presented.liveProjectLeaked, false);
  assert.doesNotMatch(presented.body, /Tajná/);
});

test('revoked share cannot be read and restore must not republish', () => {
  const project = privateProject();
  const share = publishShareSnapshot({
    shareId: asEntityId('share_2'),
    draft: planShareSnapshot({
      project,
      publishedTitle: 'Dočasná',
      publishedBody: 'Tělo',
      audienceAppUserIds: [parentNamed],
      childPrivateModeActive: true,
    }),
    ownerAppUserId: childOwner,
    now,
  });
  const revoked = revokeShareSnapshot(share, { epochMs: now.epochMs + 1 });
  assert.ok(revoked.revokedAt);
  assert.throws(() => presentShareToRecipient(revoked, project), /revoked/);
  assert.equal(restoreMustNotRepublishShare(), true);
});

test('share publish refuses empty audience and oversized body', () => {
  const project = privateProject();
  assert.throws(
    () =>
      planShareSnapshot({
        project,
        publishedTitle: 'X',
        publishedBody: 'y',
        audienceAppUserIds: [],
        childPrivateModeActive: true,
      }),
    /recipient/,
  );
  assert.throws(
    () =>
      planShareSnapshot({
        project,
        publishedTitle: 'X',
        publishedBody: 'x'.repeat(30 * 1024),
        audienceAppUserIds: [parentNamed],
        childPrivateModeActive: true,
      }),
    /size limit/,
  );
});

test('portfolio selection stays private by default', () => {
  const project = createFamilyGuidedProject({
    projectId: asEntityId('proj_family'),
    revisionId: asRevisionId('rev_f'),
    childId: asChildId('child_a'),
    creatorAppUserId: asActorId('caregiver_1'),
    familyId: 'family_1',
    template,
    now,
    createStepId: (index) => asEntityId(`fs_${index}`),
  });
  const item = createPortfolioItem({
    portfolioItemId: asEntityId('port_1'),
    project,
    title: 'Vybraný výtvor',
    description: null,
    ownerAppUserId: asActorId('caregiver_1'),
    now,
    childPrivateModeActive: false,
  });
  assert.equal(item.visibility, 'private');
});

test('family export never includes childPrivate projects or unaddressed shares', () => {
  const privateRow = privateProject();
  const familyRow = createFamilyGuidedProject({
    projectId: asEntityId('proj_family_2'),
    revisionId: asRevisionId('rev_f2'),
    childId: asChildId('child_a'),
    creatorAppUserId: asActorId('caregiver_1'),
    familyId: 'family_1',
    template,
    now,
    createStepId: (index) => asEntityId(`fs2_${index}`),
  });
  const exported = filterProjectsForFamilyExport({
    projects: [privateRow, familyRow],
    principalKind: 'other_adult_admin',
    principalAppUserId: otherAdmin,
    childPrivateModeActive: false,
  });
  assert.equal(exported.length, 1);
  assert.equal(exported[0]!.scope, 'familyGuided');

  const share = publishShareSnapshot({
    shareId: asEntityId('share_3'),
    draft: planShareSnapshot({
      project: privateRow,
      publishedTitle: 'Jen rodiči',
      publishedBody: 'Tělo',
      audienceAppUserIds: [parentNamed],
      childPrivateModeActive: true,
    }),
    ownerAppUserId: childOwner,
    now,
  });
  const forAdmin = filterSharesForRequester({
    shares: [share],
    principalKind: 'other_adult_admin',
    principalAppUserId: otherAdmin,
  });
  assert.equal(forAdmin.length, 0);
  const forRecipient = filterSharesForRequester({
    shares: [share],
    principalKind: 'named_recipient',
    principalAppUserId: parentNamed,
  });
  assert.equal(forRecipient.length, 1);
});

test('inactive child mode blocks private share planning', () => {
  const project = privateProject();
  assert.throws(
    () =>
      planShareSnapshot({
        project,
        publishedTitle: 'X',
        publishedBody: 'y',
        audienceAppUserIds: [parentNamed],
        childPrivateModeActive: false,
      }),
    /not activated/,
  );
});
