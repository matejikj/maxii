import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asActorId,
  asChildId,
  asEntityId,
  asRevisionId,
  confirmOfflineShareProposal,
  createChildPrivateProject,
  networkBecameOnlineMustNotAutoPublish,
  planOfflineShareProposal,
  presentShareToRecipient,
  restoreMustNotRepublishShare,
  type ProjectTemplateRevision,
  type ShareSnapshot,
  type UnitOfWorkFactory,
} from '../../src/domain/index.ts';
import {
  confirmAndPublishChildShellShare,
  listChildShellShareCards,
  prepareChildShellShareProposal,
  revokeChildShellShare,
} from '../../src/application/childShellShares.ts';
import { PROJECT_TEMPLATES_PUBLISHED } from '../../src/content/catalog/projectTemplatesPublished.ts';

const template = PROJECT_TEMPLATES_PUBLISHED[0]! as ProjectTemplateRevision;
const now = { epochMs: 1_700_000_300_000 };
const childOwner = asActorId('child_share_owner');
const parentNamed = asActorId('parent_named_share');
const stranger = asActorId('stranger_adult');

function privateProject() {
  return createChildPrivateProject({
    projectId: asEntityId('proj_share_shell'),
    revisionId: asRevisionId('rev_share_shell_1'),
    childId: asChildId('child_share'),
    ownerAppUserId: childOwner,
    template,
    title: template.title,
    intent: 'Původní záměr',
    now,
    createStepId: (index) => asEntityId(`ss_${index}`),
    childPrivateModeActive: true,
  });
}

function memorySharesUow(project = privateProject()): {
  unitOfWork: UnitOfWorkFactory;
  shares: Map<string, ShareSnapshot>;
  setProject: (next: typeof project) => void;
} {
  const shares = new Map<string, ShareSnapshot>();
  let current = project;
  const unitOfWork: UnitOfWorkFactory = {
    run: async (work) =>
      work({
        projects: {
          getById: async (id) => (id === current.projectId ? current : null),
          save: async () => undefined,
          listAll: async () => [current],
          listByChild: async () => [current],
        },
        shares: {
          getById: async (id) => shares.get(id) ?? null,
          save: async (share) => {
            shares.set(share.shareId, share);
          },
          listByOwner: async (owner) =>
            [...shares.values()].filter((row) => row.ownerAppUserId === owner),
          listBySourceProject: async (projectId) =>
            [...shares.values()].filter((row) => row.sourceProjectId === projectId),
          listAll: async () => [...shares.values()],
        },
      } as never),
  };
  return {
    unitOfWork,
    shares,
    setProject: (next) => {
      current = next;
    },
  };
}

test('offline share proposal stays unpublished until explicit confirm', () => {
  const project = privateProject();
  const proposal = planOfflineShareProposal({
    proposalId: asEntityId('prop_1'),
    project,
    ownerAppUserId: childOwner,
    publishedTitle: 'Ukázka mostu',
    publishedBody: 'Jen tato věta.',
    audienceAppUserIds: [parentNamed],
    now,
    childPrivateModeActive: true,
  });
  assert.equal(proposal.awaitingExplicitConfirm, true);
  assert.equal(networkBecameOnlineMustNotAutoPublish(proposal), false);
  assert.throws(
    () =>
      confirmOfflineShareProposal({
        proposal,
        project,
        explicitConfirm: false,
        childPrivateModeActive: true,
      }),
    /explicit confirmation/,
  );
  const draft = confirmOfflineShareProposal({
    proposal,
    project,
    explicitConfirm: true,
    childPrivateModeActive: true,
  });
  assert.equal(draft.publishedBody, 'Jen tato věta.');
});

test('child shell publish after reconnect still needs confirm; later edits stay private', async () => {
  const { unitOfWork, setProject } = memorySharesUow();
  const project = privateProject();
  const proposal = prepareChildShellShareProposal({
    project,
    ownerAppUserId: childOwner,
    publishedTitle: 'Ukázka',
    publishedBody: 'Zmrazené tělo',
    audienceAppUserIds: [parentNamed],
    now,
    childPrivateModeActive: true,
  });

  await assert.rejects(
    () =>
      confirmAndPublishChildShellShare({
        unitOfWork,
        ids: { createId: (prefix) => `${prefix}_auto` },
        now,
        proposal,
        ownerAppUserId: childOwner,
        explicitConfirm: false,
        networkBecameOnline: true,
        childPrivateModeActive: true,
      }),
    /explicit confirmation/,
  );

  const share = await confirmAndPublishChildShellShare({
    unitOfWork,
    ids: { createId: (prefix) => `${prefix}_ok` },
    now: { epochMs: now.epochMs + 1 },
    proposal,
    ownerAppUserId: childOwner,
    explicitConfirm: true,
    networkBecameOnline: true,
    childPrivateModeActive: true,
  });

  setProject({
    ...project,
    intent: 'Tajná reflexe po publikaci',
    revisionId: asRevisionId('rev_share_shell_2'),
  });
  const presented = presentShareToRecipient(share, {
    ...project,
    intent: 'Tajná reflexe po publikaci',
  });
  assert.equal(presented.body, 'Zmrazené tělo');
  assert.doesNotMatch(presented.body, /Tajná/);
});

test('child shell revoke blocks recipient and restore does not republish', async () => {
  const { unitOfWork } = memorySharesUow();
  const project = privateProject();
  const proposal = prepareChildShellShareProposal({
    project,
    ownerAppUserId: childOwner,
    publishedTitle: 'Dočasná',
    publishedBody: 'Tělo',
    audienceAppUserIds: [parentNamed],
    now,
    childPrivateModeActive: true,
  });
  const share = await confirmAndPublishChildShellShare({
    unitOfWork,
    ids: { createId: (prefix) => `${prefix}_rev` },
    now,
    proposal,
    ownerAppUserId: childOwner,
    explicitConfirm: true,
    childPrivateModeActive: true,
  });
  const revoked = await revokeChildShellShare({
    unitOfWork,
    now: { epochMs: now.epochMs + 2 },
    shareId: share.shareId,
    ownerAppUserId: childOwner,
    childPrivateModeActive: true,
  });
  assert.ok(revoked.revokedAt);
  assert.throws(() => presentShareToRecipient(revoked, project), /revoked/);
  assert.equal(restoreMustNotRepublishShare(), true);

  const cards = await listChildShellShareCards({
    unitOfWork,
    ownerAppUserId: childOwner,
    childPrivateModeActive: true,
  });
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.statusLabel, 'Odvoláno');
});

test('inactive child mode refuses share prepare and stranger cannot confirm', async () => {
  const project = privateProject();
  assert.throws(
    () =>
      prepareChildShellShareProposal({
        project,
        ownerAppUserId: childOwner,
        publishedTitle: 'X',
        publishedBody: 'y',
        audienceAppUserIds: [parentNamed],
        now,
        childPrivateModeActive: false,
      }),
    /not activated/,
  );
  const { unitOfWork } = memorySharesUow(project);
  const proposal = prepareChildShellShareProposal({
    project,
    ownerAppUserId: childOwner,
    publishedTitle: 'X',
    publishedBody: 'y',
    audienceAppUserIds: [parentNamed],
    now,
    childPrivateModeActive: true,
  });
  await assert.rejects(
    () =>
      confirmAndPublishChildShellShare({
        unitOfWork,
        ids: { createId: (prefix) => `${prefix}_stranger` },
        now,
        proposal,
        ownerAppUserId: stranger,
        explicitConfirm: true,
        childPrivateModeActive: true,
      }),
    /share owner/,
  );
});

test('cold personal mode lists no child shell shares', async () => {
  const { unitOfWork } = memorySharesUow();
  const cards = await listChildShellShareCards({
    unitOfWork,
    ownerAppUserId: childOwner,
    childPrivateModeActive: false,
  });
  assert.deepEqual(cards, []);
});
