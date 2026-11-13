import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  asActorId,
  asChildId,
  asEntityId,
  asOperationId,
  asRevisionId,
  childPrivateSharePayloadIsSafe,
  createMemoryChildPrivateSyncStateStore,
  planChildPrivateProjectUpsert,
  planChildPrivateSharePublish,
  planChildPrivateShareRevoke,
  pendingChildPrivateOutbox,
  revokeShareSnapshot,
  type PortfolioItem,
  type Project,
  type ShareSnapshot,
} from '../../src/domain/index.ts';
import {
  enqueueChildPrivatePortfolioUpsert,
  enqueueChildPrivateProjectUpsert,
  enqueueChildPrivateSharePublish,
  enqueueChildPrivateShareRevoke,
} from '../../src/application/enqueueChildPrivateSyncChange.ts';

const NOW = { epochMs: Date.parse('2026-11-10T23:00:00.000Z') };

function privateProject(overrides?: Partial<Project>): Project {
  return {
    projectId: asEntityId('project-1'),
    revisionId: asRevisionId('rev-1'),
    scope: 'childPrivate',
    childId: asChildId('child-1'),
    ownerAppUserId: asActorId('child-owner-1'),
    creatorAppUserId: asActorId('child-owner-1'),
    familyId: null,
    templateRevisionId: null,
    title: 'Most',
    intent: 'Stavím',
    status: 'active',
    steps: [
      {
        stepId: asEntityId('step-1'),
        order: 0,
        text: 'Začít',
        status: 'pending',
      },
    ],
    reflection: 'jen lokálně',
    variantNotes: null,
    sourceNotes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function share(overrides?: Partial<ShareSnapshot>): ShareSnapshot {
  return {
    shareId: asEntityId('share-1'),
    sourceProjectId: asEntityId('project-1'),
    sourceRevisionId: asRevisionId('rev-1'),
    ownerAppUserId: asActorId('child-owner-1'),
    publishedTitle: 'Ukázka',
    publishedBody: 'Jen tato věta.',
    audienceAppUserIds: [asActorId('parent-1')],
    commentsEnabled: false,
    revokedAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

test('local project save enqueues a durable private outbox row without a server', async () => {
  const store = createMemoryChildPrivateSyncStateStore();
  const project = privateProject();
  const result = await enqueueChildPrivateProjectUpsert({
    store,
    project,
    operationId: asOperationId('op-project-1'),
    enqueuedAt: NOW,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(pendingChildPrivateOutbox(result.state).length, 1);
  const entry = pendingChildPrivateOutbox(result.state)[0]!;
  assert.equal(entry.commandType, 'child_private.project.upsert');
  assert.equal(entry.payload.reflection, 'jen lokálně');
  assert.equal(entry.payload.title, 'Most');

  // Store survives a later load — local durability without network.
  const reloaded = await store.load();
  assert.equal(pendingChildPrivateOutbox(reloaded).length, 1);
  assert.equal(reloaded.ownerAppUserId, 'child-owner-1');
});

test('familyGuided projects are not eligible for the child-private outbox', async () => {
  const store = createMemoryChildPrivateSyncStateStore();
  const guided = privateProject({
    scope: 'familyGuided',
    ownerAppUserId: null,
    familyId: 'family-1',
    creatorAppUserId: asActorId('parent-1'),
  });
  const plan = planChildPrivateProjectUpsert(guided);
  assert.equal(plan.ok, false);
  if (plan.ok) return;
  assert.equal(plan.reason, 'not_child_private');

  const result = await enqueueChildPrivateProjectUpsert({
    store,
    project: guided,
    operationId: asOperationId('op-guided'),
    enqueuedAt: NOW,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'not_child_private');
  assert.equal(pendingChildPrivateOutbox(result.state).length, 0);
});

test('share publish enqueue uses a frozen payload without live private fields', async () => {
  const store = createMemoryChildPrivateSyncStateStore();
  const published = share();
  const plan = planChildPrivateSharePublish(published);
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.equal(childPrivateSharePayloadIsSafe(plan.payload), true);
  assert.equal('reflection' in plan.payload, false);
  assert.equal('intent' in plan.payload, false);
  assert.equal('steps' in plan.payload, false);

  const result = await enqueueChildPrivateSharePublish({
    store,
    share: published,
    operationId: asOperationId('op-share-1'),
    enqueuedAt: NOW,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(
    pendingChildPrivateOutbox(result.state)[0]?.commandType,
    'child_private.share.publish',
  );
});

test('share revoke enqueue requires an applied local revoke timestamp', async () => {
  const store = createMemoryChildPrivateSyncStateStore();
  const active = share();
  const notYet = planChildPrivateShareRevoke(active);
  assert.equal(notYet.ok, false);
  if (notYet.ok) return;
  assert.equal(notYet.reason, 'not_revoked');

  const revoked = revokeShareSnapshot(active, {
    epochMs: NOW.epochMs + 1_000,
  });
  const result = await enqueueChildPrivateShareRevoke({
    store,
    share: revoked,
    operationId: asOperationId('op-revoke-1'),
    enqueuedAt: { epochMs: NOW.epochMs + 1_000 },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(
    pendingChildPrivateOutbox(result.state)[0]?.commandType,
    'child_private.share.revoke',
  );
  assert.deepEqual(pendingChildPrivateOutbox(result.state)[0]?.payload.revokedAt, {
    epochMs: NOW.epochMs + 1_000,
  });
});

test('portfolio upsert enqueues on the owner-scoped store', async () => {
  const store = createMemoryChildPrivateSyncStateStore();
  const item: PortfolioItem = {
    portfolioItemId: asEntityId('port-1'),
    projectId: asEntityId('project-1'),
    childId: asChildId('child-1'),
    ownerAppUserId: asActorId('child-owner-1'),
    title: 'Moje karta',
    description: null,
    visibility: 'private',
    sortIndex: 2,
    createdAt: NOW,
  };
  const result = await enqueueChildPrivatePortfolioUpsert({
    store,
    item,
    operationId: asOperationId('op-port-1'),
    enqueuedAt: NOW,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(
    pendingChildPrivateOutbox(result.state)[0]?.commandType,
    'child_private.portfolio.upsert',
  );
  assert.equal(pendingChildPrivateOutbox(result.state)[0]?.payload.sortIndex, 2);
});

test('sequential local saves accumulate durable outbox rows across store loads', async () => {
  const store = createMemoryChildPrivateSyncStateStore();
  await enqueueChildPrivateProjectUpsert({
    store,
    project: privateProject(),
    operationId: asOperationId('op-a'),
    enqueuedAt: NOW,
  });
  await enqueueChildPrivateSharePublish({
    store,
    share: share(),
    operationId: asOperationId('op-b'),
    enqueuedAt: { epochMs: NOW.epochMs + 10 },
  });
  const state = await store.load();
  assert.equal(pendingChildPrivateOutbox(state).length, 2);
  assert.deepEqual(
    pendingChildPrivateOutbox(state).map((row) => row.commandType),
    ['child_private.project.upsert', 'child_private.share.publish'],
  );
});
