import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asActorId,
  asChildId,
  asEntityId,
  asOperationId,
  asRevisionId,
  createChildPrivateProject,
  createMemoryChildPrivateSyncStateStore,
  pendingChildPrivateOutbox,
  type PortfolioItem,
  type Project,
  type ShareSnapshot,
  type UnitOfWorkFactory,
} from '../../src/domain/index.ts';
import { createChildShellBlankProject } from '../../src/application/childShell.ts';
import { continueChildShellProject } from '../../src/application/childShellProjectDetail.ts';
import {
  addChildShellPortfolioSelection,
  renameChildShellPortfolioCard,
} from '../../src/application/childShellPortfolio.ts';
import {
  confirmAndPublishChildShellShare,
  prepareChildShellShareProposal,
  revokeChildShellShare,
} from '../../src/application/childShellShares.ts';
import { createChildPrivateSyncStoreFromRuntime } from '../../src/application/createChildPrivateSyncStoreFromRuntime.ts';
import { PROJECT_TEMPLATES_PUBLISHED } from '../../src/content/catalog/projectTemplatesPublished.ts';

const now = { epochMs: 1_700_000_900_000 };
const childId = asChildId('child_enq');
const owner = asActorId('child_owner_enq');
const parent = asActorId('parent_enq');
const template = PROJECT_TEMPLATES_PUBLISHED[0]!;
const ids = {
  createId: (() => {
    let n = 0;
    return (prefix: string) => `${prefix}_${++n}`;
  })(),
};

function memoryWorkspace(seed?: { project?: Project }): {
  unitOfWork: UnitOfWorkFactory;
  projects: Map<string, Project>;
  portfolio: Map<string, PortfolioItem>;
  shares: Map<string, ShareSnapshot>;
} {
  const projects = new Map<string, Project>();
  if (seed?.project) projects.set(seed.project.projectId, seed.project);
  const portfolio = new Map<string, PortfolioItem>();
  const shares = new Map<string, ShareSnapshot>();
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
        },
        portfolio: {
          getById: async (id) => portfolio.get(id) ?? null,
          save: async (item) => {
            portfolio.set(item.portfolioItemId, item);
          },
          listByChild: async (id) => [...portfolio.values()].filter((row) => row.childId === id),
          listByOwner: async (ownerId) =>
            [...portfolio.values()].filter((row) => row.ownerAppUserId === ownerId),
          listAll: async () => [...portfolio.values()],
        },
        shares: {
          getById: async (id) => shares.get(id) ?? null,
          save: async (share) => {
            shares.set(share.shareId, share);
          },
          listByOwner: async (ownerId) =>
            [...shares.values()].filter((row) => row.ownerAppUserId === ownerId),
          listBySourceProject: async (projectId) =>
            [...shares.values()].filter((row) => row.sourceProjectId === projectId),
          listAll: async () => [...shares.values()],
        },
      } as never),
  };
  return { unitOfWork, projects, portfolio, shares };
}

test('shell create still saves when sync enqueue is omitted (personal cold UI tests)', async () => {
  const { unitOfWork, projects } = memoryWorkspace();
  const project = await createChildShellBlankProject({
    unitOfWork,
    childId,
    ownerAppUserId: owner,
    title: 'Bez outboxu',
    intent: 'Jen lokálně.',
    now,
    childPrivateModeActive: true,
  });
  assert.equal(projects.get(project.projectId)?.title, 'Bez outboxu');
});

test('shell project/portfolio/share writes enqueue onto a bound local sync store', async () => {
  const store = createMemoryChildPrivateSyncStateStore();
  const syncEnqueue = { store };
  const { unitOfWork } = memoryWorkspace();

  const created = await createChildShellBlankProject({
    unitOfWork,
    childId,
    ownerAppUserId: owner,
    title: 'Most',
    intent: 'Stavím.',
    now,
    childPrivateModeActive: true,
    syncEnqueue,
    operationId: asOperationId('op_create_shell'),
  });
  assert.equal(pendingChildPrivateOutbox(await store.load()).length, 1);

  await continueChildShellProject({
    unitOfWork,
    ids,
    now: { epochMs: now.epochMs + 1 },
    projectId: created.projectId,
    ownerAppUserId: owner,
    childPrivateModeActive: true,
    syncEnqueue,
    operationId: asOperationId('op_continue_shell'),
  });
  assert.equal(pendingChildPrivateOutbox(await store.load()).length, 2);

  const card = await addChildShellPortfolioSelection({
    unitOfWork,
    ids,
    now: { epochMs: now.epochMs + 2 },
    projectId: created.projectId,
    ownerAppUserId: owner,
    title: 'Výběr',
    childPrivateModeActive: true,
    syncEnqueue,
    operationId: asOperationId('op_port_shell'),
  });
  assert.equal(pendingChildPrivateOutbox(await store.load()).length, 3);

  await renameChildShellPortfolioCard({
    unitOfWork,
    portfolioItemId: asEntityId(card.portfolioItemId),
    ownerAppUserId: owner,
    title: 'Výběr 2',
    childPrivateModeActive: true,
    now: { epochMs: now.epochMs + 3 },
    syncEnqueue,
    operationId: asOperationId('op_port_rename_shell'),
  });
  assert.equal(pendingChildPrivateOutbox(await store.load()).length, 4);

  const proposal = prepareChildShellShareProposal({
    project: created,
    ownerAppUserId: owner,
    publishedTitle: 'Ukázka',
    publishedBody: 'Jen tato věta.',
    audienceAppUserIds: [parent],
    now: { epochMs: now.epochMs + 4 },
    childPrivateModeActive: true,
  });
  const share = await confirmAndPublishChildShellShare({
    unitOfWork,
    ids,
    now: { epochMs: now.epochMs + 5 },
    proposal,
    ownerAppUserId: owner,
    explicitConfirm: true,
    childPrivateModeActive: true,
    syncEnqueue,
    operationId: asOperationId('op_share_shell'),
  });
  assert.equal(pendingChildPrivateOutbox(await store.load()).length, 5);

  await revokeChildShellShare({
    unitOfWork,
    now: { epochMs: now.epochMs + 6 },
    shareId: share.shareId,
    ownerAppUserId: owner,
    childPrivateModeActive: true,
    syncEnqueue,
    operationId: asOperationId('op_revoke_shell'),
  });

  const pending = pendingChildPrivateOutbox(await store.load());
  assert.equal(pending.length, 6);
  assert.equal(
    pending.some((row) => row.commandType === 'child_private.project.upsert'),
    true,
  );
  assert.equal(
    pending.some((row) => row.commandType === 'child_private.portfolio.upsert'),
    true,
  );
  assert.equal(
    pending.some((row) => row.commandType === 'child_private.share.publish'),
    true,
  );
  assert.equal(
    pending.some((row) => row.commandType === 'child_private.share.revoke'),
    true,
  );
  // Local enqueue does not require a sync backend.
  assert.equal((await store.load()).ownerAppUserId, owner);
});

test('runtime store factory falls back to memory without a platform diary handle', async () => {
  const store = createChildPrivateSyncStoreFromRuntime({});
  const seeded = createChildPrivateProject({
    projectId: asEntityId('proj_mem'),
    revisionId: asRevisionId('rev_mem'),
    childId,
    ownerAppUserId: owner,
    template,
    title: 'Paměť',
    intent: 'Test',
    now,
    createStepId: (index) => asEntityId(`mem_${index}`),
    childPrivateModeActive: true,
  });
  const { unitOfWork } = memoryWorkspace({ project: seeded });
  await continueChildShellProject({
    unitOfWork,
    ids,
    now,
    projectId: seeded.projectId,
    ownerAppUserId: owner,
    childPrivateModeActive: true,
    syncEnqueue: { store },
    operationId: asOperationId('op_mem_runtime'),
  });
  assert.equal(pendingChildPrivateOutbox(await store.load()).length, 1);
});
