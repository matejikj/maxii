import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asActorId,
  asChildId,
  asEntityId,
  asRevisionId,
  createFamilyGuidedBlankProject,
  currentProjectStep,
  planShareSnapshot,
  presentSelfManagementPreparation,
  presentShareToRecipient,
  publishShareSnapshot,
  shareIncludesLiveSourceNotes,
  updateProjectSourceNotes,
} from '../../src/domain/index.ts';
import {
  PROJECT_COHORT_15_17_PACK,
  describeProjectCohortAvailability,
  listProjectTemplatesByCohort,
  searchPublishedProjectTemplates,
} from '../../src/content/catalog/projectTemplatesPublished.ts';

const now = { epochMs: 1_700_000_600_000 };

test('15-17 pack exposes four embedded offline templates', () => {
  const availability = describeProjectCohortAvailability('15-17');
  assert.equal(availability.offlineEmbedded, true);
  assert.equal(availability.templateCount, 4);
  assert.equal(PROJECT_COHORT_15_17_PACK.revisionIds.length, 4);
  assert.equal(listProjectTemplatesByCohort('15-17').length, 4);
  assert.match(availability.detail, /zdroj/);
  assert.equal(searchPublishedProjectTemplates('15-17').length, 4);
});

test('own-brief blank idea starts with assignment steps without private scope', () => {
  const project = createFamilyGuidedBlankProject({
    projectId: asEntityId('proj_brief'),
    revisionId: asRevisionId('rev_brief'),
    childId: asChildId('child_a'),
    creatorAppUserId: null,
    familyId: null,
    title: 'Vlastní krátký experiment',
    style: 'ownBrief',
    now,
    createStepId: (index) => asEntityId(`brief_step_${index}`),
  });
  assert.equal(project.scope, 'familyGuided');
  assert.equal(project.sourceNotes, null);
  assert.match(currentProjectStep(project)?.text ?? '', /vlastní výsledek/i);
});

test('source notes stay on the live project and never auto-enter a share', () => {
  assert.equal(shareIncludesLiveSourceNotes(), false);
  let project = createFamilyGuidedBlankProject({
    projectId: asEntityId('proj_src'),
    revisionId: asRevisionId('rev_src'),
    childId: asChildId('child_a'),
    creatorAppUserId: asActorId('care_1'),
    familyId: null,
    title: 'Malá otázka',
    style: 'ownBrief',
    now,
    createStepId: (index) => asEntityId(`src_${index}`),
  });
  project = updateProjectSourceNotes(
    project,
    {
      question: 'Jak papír drží ohyb?',
      sourceLabel: 'Vlastní bezpečné pozorování',
      checkedOn: '2026-11-09',
      supportedClaim: 'Jeden ohyb zvládl bez trhliny',
      openQuestion: 'Neověřeno pro jiné papíry',
      verifiedOnline: false,
    },
    asRevisionId('rev_src_1'),
    { epochMs: now.epochMs + 1 },
  );
  assert.equal(project.sourceNotes?.verifiedOnline, false);
  assert.equal(project.sourceNotes?.sourceLabel, 'Vlastní bezpečné pozorování');

  const draft = planShareSnapshot({
    project,
    publishedTitle: project.title,
    publishedBody: 'Jen vybraný text ukázky',
    audienceAppUserIds: [asActorId('adult_2')],
    commentsEnabled: false,
    childPrivateModeActive: false,
  });
  assert.equal(draft.publishedBody.includes('ohyb'), false);

  const share = publishShareSnapshot({
    shareId: asEntityId('share_src'),
    draft,
    ownerAppUserId: asActorId('care_1'),
    now: { epochMs: now.epochMs + 2 },
  });
  const presented = presentShareToRecipient(share, project);
  assert.equal(presented.liveProjectLeaked, false);
  assert.equal(presented.body.includes('ohyb'), false);
});

test('self-management preparation stays preview-only without family history handoff', () => {
  const prep = presentSelfManagementPreparation();
  assert.equal(prep.screenAvailable, false);
  assert.equal(prep.familyHistoryAutoTransfer, false);
  assert.ok(prep.previewItems.length >= 3);
  assert.match(prep.detail, /histori/i);
});
