import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asActorId,
  asChildId,
  asEntityId,
  asOperationId,
  asRevisionId,
  commitChildPrivatePullPage,
  createEmptyChildPrivateSyncState,
  createMemoryChildPrivateSyncStateStore,
  enqueueChildPrivateOutbox,
  pendingChildPrivateInbox,
  pendingChildPrivateOutbox,
  type PortfolioItem,
  type Project,
  type ShareSnapshot,
  type UnitOfWorkFactory,
} from '../../src/domain/index.ts';
import { applyChildPrivateInboxToWorkspace } from '../../src/application/applyChildPrivateInbox.ts';
import { createChildPrivateSyncSessionBinding } from '../../src/application/bindChildPrivateSyncSession.ts';
import { runChildPrivateSyncTickWithStore } from '../../src/application/childPrivateSyncLoop.ts';
import type { FamilyAuthSession } from '../../src/infrastructure/family/familyAuthPort.ts';

const NOW = { epochMs: Date.parse('2026-11-11T01:00:00.000Z') };
const owner = asActorId('child-owner-1');
const parent = asActorId('parent-1');

function session(): FamilyAuthSession {
  return {
    appUserId: 'child-owner-1',
    accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
    transport: 'bearer',
    accessToken: 'bearer-token',
    csrfToken: null,
  };
}

function memoryWorkspace(): {
  unitOfWork: UnitOfWorkFactory;
  projects: Map<string, Project>;
  portfolio: Map<string, PortfolioItem>;
  shares: Map<string, ShareSnapshot>;
} {
  const projects = new Map<string, Project>();
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
          delete: async (id) => {
            projects.delete(id);
          },
          listAll: async () => [...projects.values()],
          listByChild: async (childId) =>
            [...projects.values()].filter((row) => row.childId === childId),
          deleteByChild: async () => 0,
          clearAll: async () => projects.clear(),
        },
        portfolio: {
          getById: async (id) => portfolio.get(id) ?? null,
          save: async (item) => {
            portfolio.set(item.portfolioItemId, item);
          },
          delete: async (id) => {
            portfolio.delete(id);
          },
          listByChild: async (childId) =>
            [...portfolio.values()].filter((row) => row.childId === childId),
          listByProject: async (projectId) =>
            [...portfolio.values()].filter((row) => row.projectId === projectId),
          listAll: async () => [...portfolio.values()],
          deleteByChild: async () => 0,
          clearAll: async () => portfolio.clear(),
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
          revokeAllForProject: async () => 0,
          clearAll: async () => shares.clear(),
        },
      } as never),
  };
  return { unitOfWork, projects, portfolio, shares };
}

test('pulled inbox rows start unapplied and materialize into the local workspace', async () => {
  let state = createEmptyChildPrivateSyncState();
  state = {
    ...state,
    ownerAppUserId: 'child-owner-1',
  };
  state = commitChildPrivatePullPage(state, {
    entries: [
      {
        changelogSeq: 1,
        operationId: 'op-proj',
        revisionId: 'rev-remote-1',
        entityId: 'project-1',
        kind: 'child_private.project.upsert',
        payloadHash: 'a'.repeat(64),
        payload: {
          projectId: 'project-1',
          childId: 'child-1',
          title: 'Most',
          intent: 'Stavím',
          status: 'active',
          reflection: 'jen pro mě',
          steps: [{ stepId: 'step-1', order: 0, text: 'Začít', status: 'pending' }],
          variantNotes: null,
          sourceNotes: null,
          templateRevisionId: null,
        },
      },
      {
        changelogSeq: 2,
        operationId: 'op-port',
        revisionId: 'port-1',
        entityId: 'port-1',
        kind: 'child_private.portfolio.upsert',
        payloadHash: 'b'.repeat(64),
        payload: {
          portfolioItemId: 'port-1',
          projectId: 'project-1',
          childId: 'child-1',
          title: 'Výběr',
          description: null,
          visibility: 'private',
          sortIndex: 0,
        },
      },
      {
        changelogSeq: 3,
        operationId: 'op-share',
        revisionId: 'rev-share',
        entityId: 'share-1',
        kind: 'child_private.share.publish',
        payloadHash: 'c'.repeat(64),
        payload: {
          shareId: 'share-1',
          sourceProjectId: 'project-1',
          sourceRevisionId: 'rev-remote-1',
          ownerAppUserId: 'child-owner-1',
          publishedTitle: 'Ukázka',
          publishedBody: 'Jen tato věta.',
          audienceAppUserIds: ['parent-1'],
          commentsEnabled: false,
        },
      },
    ],
    nextCursor: 'c1',
    epoch: 1,
    syncedAt: NOW,
  });
  assert.equal(pendingChildPrivateInbox(state).length, 3);

  const { unitOfWork, projects, portfolio, shares } = memoryWorkspace();
  const applied = await applyChildPrivateInboxToWorkspace({
    state,
    unitOfWork,
    now: NOW,
    sessionAppUserId: 'child-owner-1',
  });

  assert.equal(applied.appliedUpserts, 2);
  assert.equal(applied.appliedShares, 1);
  assert.equal(applied.rejected, 0);
  assert.equal(pendingChildPrivateInbox(applied.state).length, 0);
  assert.equal(projects.get('project-1')?.reflection, 'jen pro mě');
  assert.equal(projects.get('project-1')?.scope, 'childPrivate');
  assert.equal(portfolio.get('port-1')?.title, 'Výběr');
  assert.equal(shares.get('share-1')?.publishedBody, 'Jen tato věta.');
  assert.equal(shares.get('share-1')?.ownerAppUserId, owner);
  assert.equal('reflection' in (shares.get('share-1') as object), false);
});

test('share revoke and deletes apply; poison payloads are rejected without blocking later rows', async () => {
  const { unitOfWork, projects, portfolio, shares } = memoryWorkspace();
  await unitOfWork.run(async (uow) => {
    await uow.projects.save({
      projectId: asEntityId('project-del'),
      revisionId: asRevisionId('rev-del'),
      scope: 'childPrivate',
      childId: asChildId('child-1'),
      ownerAppUserId: owner,
      creatorAppUserId: owner,
      familyId: null,
      templateRevisionId: null,
      title: 'Smazat',
      intent: 'x',
      status: 'active',
      steps: [],
      reflection: null,
      variantNotes: null,
      sourceNotes: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
    await uow.portfolio.save({
      portfolioItemId: asEntityId('port-del'),
      projectId: asEntityId('project-del'),
      childId: asChildId('child-1'),
      ownerAppUserId: owner,
      title: 'Kartu smazat',
      description: null,
      visibility: 'private',
      createdAt: NOW,
    });
    await uow.shares.save({
      shareId: asEntityId('share-rev'),
      sourceProjectId: asEntityId('project-del'),
      sourceRevisionId: asRevisionId('rev-del'),
      ownerAppUserId: owner,
      publishedTitle: 'Ukázka',
      publishedBody: 'Text',
      audienceAppUserIds: [parent],
      commentsEnabled: false,
      revokedAt: null,
      createdAt: NOW,
    });
  });

  let state = createEmptyChildPrivateSyncState();
  state = { ...state, ownerAppUserId: 'child-owner-1' };
  state = commitChildPrivatePullPage(state, {
    entries: [
      {
        changelogSeq: 1,
        operationId: 'op-bad',
        revisionId: 'rev-bad',
        entityId: 'bad',
        kind: 'child_private.project.upsert',
        payloadHash: 'd'.repeat(64),
        payload: { title: 'chybí povinná pole' },
      },
      {
        changelogSeq: 2,
        operationId: 'op-del-proj',
        revisionId: 'rev-del-2',
        entityId: 'project-del',
        kind: 'child_private.project.delete',
        payloadHash: 'e'.repeat(64),
        payload: { projectId: 'project-del' },
      },
      {
        changelogSeq: 3,
        operationId: 'op-del-port',
        revisionId: 'rev-del-port',
        entityId: 'port-del',
        kind: 'child_private.portfolio.delete',
        payloadHash: 'f'.repeat(64),
        payload: { portfolioItemId: 'port-del' },
      },
      {
        changelogSeq: 4,
        operationId: 'op-revoke',
        revisionId: 'share-rev:revoke',
        entityId: 'share-rev',
        kind: 'child_private.share.revoke',
        payloadHash: 'g'.repeat(64),
        payload: {
          shareId: 'share-rev',
          sourceProjectId: 'project-del',
          ownerAppUserId: 'child-owner-1',
          revokedAt: { epochMs: NOW.epochMs + 5 },
        },
      },
    ],
    nextCursor: 'c2',
    epoch: 2,
    syncedAt: NOW,
  });

  const applied = await applyChildPrivateInboxToWorkspace({
    state,
    unitOfWork,
    now: { epochMs: NOW.epochMs + 5 },
    sessionAppUserId: 'child-owner-1',
  });
  assert.equal(applied.rejected, 1);
  assert.equal(applied.appliedDeletes, 2);
  assert.equal(applied.appliedShares, 1);
  assert.equal(pendingChildPrivateInbox(applied.state).length, 0);
  assert.equal(projects.has('project-del'), false);
  assert.equal(portfolio.has('port-del'), false);
  assert.equal(shares.get('share-rev')?.revokedAt?.epochMs, NOW.epochMs + 5);
});

test('sync loop materializes pulled project into UoW after HTTP tick', async () => {
  const store = createMemoryChildPrivateSyncStateStore();
  const { unitOfWork, projects } = memoryWorkspace();
  let state = createEmptyChildPrivateSyncState();
  state = enqueueChildPrivateOutbox(state, {
    ownerAppUserId: 'child-owner-1',
    operationId: asOperationId('cp-apply-net'),
    commandType: 'child_private.project.upsert',
    entityId: 'project-net',
    revisionId: 'rev-local',
    payload: {
      projectId: 'project-net',
      childId: 'child-1',
      title: 'Lokální',
      intent: 'x',
      status: 'active',
      reflection: null,
      steps: [],
    },
    enqueuedAt: NOW,
  });
  await store.save(state);

  const binding = createChildPrivateSyncSessionBinding({
    boundary: {
      apiBaseUrl: 'https://api.example.test',
      syncConfigured: true,
    },
    deviceId: 'device-apply',
    fetchImpl: async (url, _init) => {
      if (String(url).endsWith('/push')) {
        return new Response(
          JSON.stringify({
            ownerAppUserId: 'child-owner-1',
            attemptId: 'a-apply',
            epoch: 3,
            receipts: [{ operationId: 'cp-apply-net', status: 'accepted' }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          ownerAppUserId: 'child-owner-1',
          epoch: 3,
          entries: [
            {
              changelogSeq: 10,
              operationId: 'cp-remote-proj',
              revisionId: 'rev-remote',
              entityId: 'project-remote',
              kind: 'child_private.project.upsert',
              payloadHash: 'h'.repeat(64),
              payload: {
                projectId: 'project-remote',
                childId: 'child-1',
                title: 'Z druhého zařízení',
                intent: 'Sync',
                status: 'active',
                reflection: 'přeneseno',
                steps: [{ stepId: 's1', order: 0, text: 'Krok', status: 'tried' }],
                variantNotes: null,
                sourceNotes: null,
                templateRevisionId: null,
              },
            },
          ],
          nextCursor: 'c-apply',
          resyncRequired: false,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
  });
  binding.bindAuthSession(session());

  const result = await runChildPrivateSyncTickWithStore({
    binding,
    store,
    attemptId: 'a-apply',
    nowIso: '2026-11-11T01:05:00.000Z',
    unitOfWork,
    sessionAppUserId: 'child-owner-1',
  });

  assert.equal(result.personalCold, false);
  assert.equal(result.pulled, 1);
  assert.equal(result.inboxApply?.appliedUpserts, 1);
  assert.equal(pendingChildPrivateInbox(result.state).length, 0);
  assert.equal(pendingChildPrivateOutbox(result.state).length, 0);
  assert.equal(projects.get('project-remote')?.title, 'Z druhého zařízení');
  assert.equal(projects.get('project-remote')?.reflection, 'přeneseno');
});
