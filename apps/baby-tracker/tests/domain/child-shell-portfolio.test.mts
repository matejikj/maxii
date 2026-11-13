import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asActorId,
  asChildId,
  asEntityId,
  asRevisionId,
  createChildPrivateProject,
  type PortfolioItem,
  type Project,
  type UnitOfWorkFactory,
} from '../../src/domain/index.ts';
import {
  addChildShellPortfolioSelection,
  listChildShellPortfolioCards,
  moveChildShellPortfolioCardEarlier,
  renameChildShellPortfolioCard,
} from '../../src/application/childShellPortfolio.ts';
import { PROJECT_TEMPLATES_PUBLISHED } from '../../src/content/catalog/projectTemplatesPublished.ts';

const now = { epochMs: 1_700_000_600_000 };
const childId = asChildId('child_port');
const owner = asActorId('child_owner_port');
const stranger = asActorId('stranger_port');
const template = PROJECT_TEMPLATES_PUBLISHED[0]!;
const ids = {
  createId: (() => {
    let n = 0;
    return (prefix: string) => `${prefix}_${++n}`;
  })(),
};

function memoryPortfolio(seed: { projects?: Project[]; portfolio?: PortfolioItem[] }): {
  unitOfWork: UnitOfWorkFactory;
  portfolio: Map<string, PortfolioItem>;
} {
  const projects = new Map((seed.projects ?? []).map((row) => [row.projectId, row] as const));
  const portfolio = new Map(
    (seed.portfolio ?? []).map((row) => [row.portfolioItemId, row] as const),
  );
  const unitOfWork: UnitOfWorkFactory = {
    run: async (work) =>
      work({
        projects: {
          getById: async (id) => projects.get(id) ?? null,
          save: async (project) => {
            projects.set(project.projectId, project);
          },
          listAll: async () => [...projects.values()],
          listByChild: async (id) => [...projects.values()].filter((row) => row.childId === id),
          delete: async () => undefined,
          deleteByChild: async () => 0,
          clearAll: async () => {
            projects.clear();
          },
        },
        portfolio: {
          getById: async (id) => portfolio.get(id) ?? null,
          save: async (item) => {
            portfolio.set(item.portfolioItemId, item);
          },
          delete: async (id) => {
            portfolio.delete(id);
          },
          listByChild: async (id) => [...portfolio.values()].filter((row) => row.childId === id),
          listByProject: async (id) =>
            [...portfolio.values()].filter((row) => row.projectId === id),
          listAll: async () => [...portfolio.values()],
          deleteByChild: async () => 0,
          clearAll: async () => {
            portfolio.clear();
          },
        },
      } as never),
  };
  return { unitOfWork, portfolio };
}

function seedProject(): Project {
  return createChildPrivateProject({
    projectId: asEntityId('proj_port_1'),
    revisionId: asRevisionId('rev_port_1'),
    childId,
    ownerAppUserId: owner,
    template,
    title: template.title,
    intent: template.intent,
    now,
    createStepId: (index) => asEntityId(`step_port_${index}`),
    childPrivateModeActive: true,
  });
}

test('portfolio cards stay private, filterable, and empty when mode is closed', async () => {
  const project = seedProject();
  const { unitOfWork } = memoryPortfolio({ projects: [project] });

  const closed = await listChildShellPortfolioCards({
    unitOfWork,
    childId,
    ownerAppUserId: owner,
    childPrivateModeActive: false,
  });
  assert.deepEqual(closed, []);

  const first = await addChildShellPortfolioSelection({
    unitOfWork,
    ids,
    now,
    projectId: project.projectId,
    ownerAppUserId: owner,
    title: 'Můj most',
    description: 'První pokus',
    childPrivateModeActive: true,
  });
  assert.equal(first.visibilityLabel, 'Soukromé');
  assert.equal(first.title, 'Můj most');

  await addChildShellPortfolioSelection({
    unitOfWork,
    ids,
    now: { epochMs: now.epochMs + 10 },
    projectId: project.projectId,
    ownerAppUserId: owner,
    title: 'Druhý tvar',
    childPrivateModeActive: true,
  });

  const filtered = await listChildShellPortfolioCards({
    unitOfWork,
    childId,
    ownerAppUserId: owner,
    query: 'most',
    childPrivateModeActive: true,
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.title, 'Můj most');

  await assert.rejects(
    () =>
      addChildShellPortfolioSelection({
        unitOfWork,
        ids,
        now,
        projectId: project.projectId,
        ownerAppUserId: stranger,
        title: 'Cizí',
        childPrivateModeActive: true,
      }),
    /owner/,
  );
});

test('owner can rename and move a card earlier without ranking others', async () => {
  const project = seedProject();
  const { unitOfWork } = memoryPortfolio({ projects: [project] });

  const a = await addChildShellPortfolioSelection({
    unitOfWork,
    ids,
    now,
    projectId: project.projectId,
    ownerAppUserId: owner,
    title: 'První',
    childPrivateModeActive: true,
  });
  const b = await addChildShellPortfolioSelection({
    unitOfWork,
    ids,
    now: { epochMs: now.epochMs + 5 },
    projectId: project.projectId,
    ownerAppUserId: owner,
    title: 'Druhý',
    childPrivateModeActive: true,
  });

  const renamed = await renameChildShellPortfolioCard({
    unitOfWork,
    portfolioItemId: asEntityId(b.portfolioItemId),
    ownerAppUserId: owner,
    title: 'Druhý — upravený',
    description: 'Jen moje poznámka',
    childPrivateModeActive: true,
  });
  assert.equal(renamed.title, 'Druhý — upravený');
  assert.equal(renamed.description, 'Jen moje poznámka');

  const moved = await moveChildShellPortfolioCardEarlier({
    unitOfWork,
    portfolioItemId: asEntityId(b.portfolioItemId),
    ownerAppUserId: owner,
    childPrivateModeActive: true,
  });
  assert.deepEqual(
    moved.map((card) => card.title),
    ['Druhý — upravený', 'První'],
  );
  assert.ok(moved.every((card) => card.visibilityLabel === 'Soukromé'));
  assert.equal(a.title, 'První');
});
