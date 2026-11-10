import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asActorId,
  asChildId,
  asEntityId,
  asRevisionId,
  createChildPrivateProject,
  type Project,
  type UnitOfWorkFactory,
} from '../../src/domain/index.ts';
import {
  closeChildShellProject,
  continueChildShellProject,
  loadChildShellProjectDetail,
  pauseChildShellProject,
  saveChildShellProjectReflection,
} from '../../src/application/childShellProjectDetail.ts';
import { PROJECT_TEMPLATES_PUBLISHED } from '../../src/content/catalog/projectTemplatesPublished.ts';

const now = { epochMs: 1_700_000_500_000 };
const childId = asChildId('child_detail');
const owner = asActorId('child_owner_detail');
const stranger = asActorId('stranger_detail');
const template = PROJECT_TEMPLATES_PUBLISHED[0]!;
const ids = { createId: (prefix: string) => `${prefix}_${Math.random().toString(16).slice(2, 8)}` };

function memoryProjects(seed: Project[]): {
  unitOfWork: UnitOfWorkFactory;
  projects: Map<string, Project>;
} {
  const projects = new Map(seed.map((row) => [row.projectId, row] as const));
  const unitOfWork: UnitOfWorkFactory = {
    run: async (work) =>
      work({
        projects: {
          getById: async (id) => projects.get(id) ?? null,
          save: async (project) => {
            projects.set(project.projectId, project);
          },
          listAll: async () => [...projects.values()],
          listByChild: async (id) =>
            [...projects.values()].filter((row) => row.childId === id),
          delete: async () => undefined,
          deleteByChild: async () => 0,
          clearAll: async () => {
            projects.clear();
          },
        },
      } as never),
  };
  return { unitOfWork, projects };
}

function seedProject(): Project {
  return createChildPrivateProject({
    projectId: asEntityId('proj_detail_1'),
    revisionId: asRevisionId('rev_detail_1'),
    childId,
    ownerAppUserId: owner,
    template,
    title: template.title,
    intent: template.intent,
    now,
    createStepId: (index) => asEntityId(`step_detail_${index}`),
    childPrivateModeActive: true,
  });
}

test('detail loads for owner with intent, current step and Jen pro mě', async () => {
  const project = seedProject();
  const { unitOfWork } = memoryProjects([project]);

  await assert.rejects(
    () =>
      loadChildShellProjectDetail({
        unitOfWork,
        projectId: project.projectId,
        ownerAppUserId: owner,
        childPrivateModeActive: false,
      }),
    /not activated/,
  );

  const detail = await loadChildShellProjectDetail({
    unitOfWork,
    projectId: project.projectId,
    ownerAppUserId: owner,
    childPrivateModeActive: true,
  });
  assert.equal(detail.scopeLabel, 'Jen pro mě');
  assert.equal(detail.title, template.title);
  assert.equal(detail.intent, template.intent);
  assert.ok(detail.currentStep);
  assert.equal(detail.hasMoreSteps, true);
  assert.equal(detail.steps.length, 3);

  await assert.rejects(
    () =>
      loadChildShellProjectDetail({
        unitOfWork,
        projectId: project.projectId,
        ownerAppUserId: stranger,
        childPrivateModeActive: true,
      }),
    /owner/,
  );
});

test('continue marks one step; pause and close are secondary; reflection is optional', async () => {
  const project = seedProject();
  const { unitOfWork, projects } = memoryProjects([project]);

  const continued = await continueChildShellProject({
    unitOfWork,
    ids,
    now: { epochMs: now.epochMs + 1 },
    projectId: project.projectId,
    ownerAppUserId: owner,
    childPrivateModeActive: true,
  });
  assert.equal(continued.status, 'active');
  assert.equal(continued.steps.filter((step) => step.status === 'tried').length, 1);
  assert.ok(continued.currentStep);

  const paused = await pauseChildShellProject({
    unitOfWork,
    ids,
    now: { epochMs: now.epochMs + 2 },
    projectId: project.projectId,
    ownerAppUserId: owner,
    childPrivateModeActive: true,
  });
  assert.equal(paused.status, 'paused');

  const closed = await closeChildShellProject({
    unitOfWork,
    ids,
    now: { epochMs: now.epochMs + 3 },
    projectId: project.projectId,
    ownerAppUserId: owner,
    childPrivateModeActive: true,
  });
  assert.equal(closed.status, 'closed');

  const withReflection = await saveChildShellProjectReflection({
    unitOfWork,
    ids,
    now: { epochMs: now.epochMs + 4 },
    projectId: project.projectId,
    ownerAppUserId: owner,
    reflection: 'Zkusil/a jsem první tvar.',
    childPrivateModeActive: true,
  });
  assert.equal(withReflection.reflection, 'Zkusil/a jsem první tvar.');

  const cleared = await saveChildShellProjectReflection({
    unitOfWork,
    ids,
    now: { epochMs: now.epochMs + 5 },
    projectId: project.projectId,
    ownerAppUserId: owner,
    reflection: '   ',
    childPrivateModeActive: true,
  });
  assert.equal(cleared.reflection, null);
  assert.equal(projects.get(project.projectId)?.reflection, null);
});
