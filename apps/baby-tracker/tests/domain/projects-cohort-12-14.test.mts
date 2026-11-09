import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asChildId,
  asEntityId,
  asRevisionId,
  createFamilyGuidedBlankProject,
  currentProjectStep,
  planShareSnapshot,
  presentShareToRecipient,
  publishShareSnapshot,
  shareIncludesLiveVariantNotes,
  updateProjectVariantNotes,
  asActorId,
} from '../../src/domain/index.ts';
import {
  PROJECT_COHORT_12_14_PACK,
  describeProjectCohortAvailability,
  listProjectTemplatesByCohort,
  searchPublishedProjectTemplates,
} from '../../src/content/catalog/projectTemplatesPublished.ts';

const now = { epochMs: 1_700_000_500_000 };

test('12-14 pack exposes four embedded offline templates', () => {
  const availability = describeProjectCohortAvailability('12-14');
  assert.equal(availability.offlineEmbedded, true);
  assert.equal(availability.templateCount, 4);
  assert.equal(PROJECT_COHORT_12_14_PACK.revisionIds.length, 4);
  assert.equal(listProjectTemplatesByCohort('12-14').length, 4);
  assert.match(availability.detail, /variant/);
});

test('local discovery search finds published templates by title or cohort', () => {
  const byTitle = searchPublishedProjectTemplates(
    listProjectTemplatesByCohort('12-14')[0]!.title.slice(0, 8),
  );
  assert.ok(byTitle.length >= 1);
  const byCohort = searchPublishedProjectTemplates('12-14');
  assert.equal(byCohort.length, 4);
  assert.equal(searchPublishedProjectTemplates('zzzz-nenalezeno').length, 0);
});

test('variants blank idea offers comparison steps without private scope', () => {
  const project = createFamilyGuidedBlankProject({
    projectId: asEntityId('proj_variants'),
    revisionId: asRevisionId('rev_variants'),
    childId: asChildId('child_a'),
    creatorAppUserId: null,
    familyId: null,
    title: 'Dva směry experimentu',
    style: 'variants',
    now,
    createStepId: (index) => asEntityId(`var_step_${index}`),
  });
  assert.equal(project.scope, 'familyGuided');
  assert.equal(project.variantNotes, null);
  assert.match(currentProjectStep(project)?.text ?? '', /dvě možné varianty/i);
});

test('variant notes stay on the live project and never auto-enter a share', () => {
  assert.equal(shareIncludesLiveVariantNotes(), false);
  let project = createFamilyGuidedBlankProject({
    projectId: asEntityId('proj_live_var'),
    revisionId: asRevisionId('rev_live_var'),
    childId: asChildId('child_a'),
    creatorAppUserId: asActorId('care_1'),
    familyId: null,
    title: 'Porovnání',
    style: 'variants',
    now,
    createStepId: (index) => asEntityId(`lv_${index}`),
  });
  project = updateProjectVariantNotes(
    project,
    {
      optionA: 'Postavit z kartonu',
      optionB: 'Sestavit z přírodnin',
      chosenNote: 'Zkusíme karton, přírodniny necháme otevřené',
    },
    asRevisionId('rev_var_1'),
    { epochMs: now.epochMs + 1 },
  );
  assert.equal(project.variantNotes?.optionA, 'Postavit z kartonu');

  const draft = planShareSnapshot({
    project,
    publishedTitle: project.title,
    publishedBody: 'Jen vybraný text ukázky',
    audienceAppUserIds: [asActorId('adult_2')],
    commentsEnabled: false,
    childPrivateModeActive: false,
  });
  assert.equal(draft.publishedBody.includes('Postavit z kartonu'), false);
  assert.equal(draft.publishedBody.includes('přírodnin'), false);

  const share = publishShareSnapshot({
    shareId: asEntityId('share_1'),
    draft,
    ownerAppUserId: asActorId('care_1'),
    now: { epochMs: now.epochMs + 2 },
  });
  const presented = presentShareToRecipient(share, project);
  assert.equal(presented.liveProjectLeaked, false);
  assert.equal(presented.body.includes('Postavit z kartonu'), false);
  assert.equal(presented.body.includes('přírodnin'), false);
});
