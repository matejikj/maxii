import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asChildId,
  asEntityId,
  asRevisionId,
  createFamilyGuidedBlankProject,
  currentProjectStep,
  groupProjectsByStatus,
  listTodayActiveProjects,
} from '../../src/domain/index.ts';
import {
  PROJECT_COHORT_8_11_PACK,
  describeProjectCohortAvailability,
  listProjectTemplatesByCohort,
} from '../../src/content/catalog/projectTemplatesPublished.ts';

const now = { epochMs: 1_700_000_400_000 };

test('8-11 pack exposes four embedded offline templates', () => {
  const availability = describeProjectCohortAvailability('8-11');
  assert.equal(availability.offlineEmbedded, true);
  assert.equal(availability.templateCount, 4);
  assert.equal(PROJECT_COHORT_8_11_PACK.revisionIds.length, 4);
  assert.equal(listProjectTemplatesByCohort('8-11').length, 4);
  assert.match(availability.detail, /bez účtu/);
});

test('blank family idea is equal to a template start without private scope', () => {
  const project = createFamilyGuidedBlankProject({
    projectId: asEntityId('proj_blank'),
    revisionId: asRevisionId('rev_blank'),
    childId: asChildId('child_a'),
    creatorAppUserId: null,
    familyId: null,
    title: 'Most z krabic',
    intent: 'Zkusit vlastní tvar',
    now,
    createStepId: (index) => asEntityId(`blank_step_${index}`),
  });
  assert.equal(project.scope, 'familyGuided');
  assert.equal(project.templateRevisionId, null);
  assert.equal(project.steps.length, 3);
  assert.equal(currentProjectStep(project)?.text, 'Domluvíme první malý krok.');
});

test('today and shelves keep at most three active projects without scoring', () => {
  const projects = [1, 2, 3, 4].map((n) =>
    createFamilyGuidedBlankProject({
      projectId: asEntityId(`proj_${n}`),
      revisionId: asRevisionId(`rev_${n}`),
      childId: asChildId('child_a'),
      creatorAppUserId: null,
      familyId: null,
      title: `Nápad ${n}`,
      now,
      createStepId: (index) => asEntityId(`s_${n}_${index}`),
    }),
  );
  const paused = {
    ...projects[0]!,
    status: 'paused' as const,
  };
  const closed = {
    ...projects[1]!,
    status: 'closed' as const,
  };
  const shelves = groupProjectsByStatus([paused, closed, projects[2]!, projects[3]!]);
  assert.equal(shelves.active.length, 2);
  assert.equal(shelves.paused.length, 1);
  assert.equal(shelves.closed.length, 1);
  assert.equal(listTodayActiveProjects(projects).length, 3);
});
