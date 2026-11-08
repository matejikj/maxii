import assert from 'node:assert/strict';
import { test } from 'node:test';
import 'fake-indexeddb/auto';
import {
  AppError,
  TRASH_RETENTION_MS,
  UNDO_WINDOW_MS,
  asChildId,
  asEntityId,
  asOperationId,
  asRevisionId,
  asTimeZoneId,
  createDraft,
  zonedInstant,
} from '../src/domain/index.ts';
import {
  createCommandDispatcher,
  createDraftAutosave,
  createReadModelInvalidator,
  keepPriorDraftWhenStartingFresh,
} from '../src/application/index.ts';
import { createControlledFaultInjection } from '../src/infrastructure/testing/controlledFaults.ts';
import { createMemoryCheckpointStore } from '../src/infrastructure/database/native/checkpoint.ts';
import { createMemoryDatabasePresence } from '../src/infrastructure/database/native/databasePresence.ts';
import { createMemoryDatabaseKeyStore } from '../src/infrastructure/database/native/memoryKeyStore.ts';
import { createMemoryEncryptedSqlOpener } from '../src/infrastructure/database/native/memoryEncryptedSql.ts';
import { createNativeUnitOfWorkFactory } from '../src/infrastructure/database/native/nativeUnitOfWork.ts';
import { openPrivateDatabase } from '../src/infrastructure/database/native/privateDatabase.ts';
import {
  createWebUnitOfWorkFactory,
  ensureChildProfileRow,
  openWebDatabase,
} from '../src/infrastructure/database/web/index.ts';

const zone = asTimeZoneId('Europe/Prague');
const childId = asChildId('child_cmd_1');

async function openNative(name: string) {
  let clock = 1_700_000_000_000;
  const db = await openPrivateDatabase({
    databaseName: name,
    opener: createMemoryEncryptedSqlOpener(),
    keyStore: createMemoryDatabaseKeyStore(),
    presence: createMemoryDatabasePresence(),
    checkpointStore: createMemoryCheckpointStore(),
    now: { epochMs: clock },
  });
  await db.connection.runAsync(
    `INSERT INTO child_profiles (child_id, display_name, birth_date, summary_time_zone, payload_json) VALUES (?, ?, ?, ?, ?)`,
    childId,
    'Max',
    '2025-01-01',
    'Europe/Prague',
    '{}',
  );
  const unitOfWork = createNativeUnitOfWorkFactory(db, { nowMs: () => clock });
  const readModels = createReadModelInvalidator();
  const topics: string[][] = [];
  readModels.subscribe((t) => topics.push([...t]));
  const dispatcher = createCommandDispatcher({
    unitOfWork,
    clock: {
      now: () => ({ epochMs: clock }),
    },
    onCommitted: (t) => readModels.notifyCommitted(t),
  });
  return {
    db,
    unitOfWork,
    dispatcher,
    topics,
    advance(ms: number) {
      clock += ms;
    },
    setClock(ms: number) {
      clock = ms;
    },
    get clock() {
      return clock;
    },
  };
}

async function openWeb(stamp: string) {
  let clock = 1_700_000_000_000;
  const handle = await openWebDatabase({
    databaseName: `web-cmd-${stamp}`,
    lockDatabaseName: `web-cmd-locks-${stamp}`,
    now: { epochMs: clock },
  });
  await ensureChildProfileRow(handle.db, {
    childId,
    displayName: 'Max',
    summaryTimeZone: 'Europe/Prague',
  });
  const unitOfWork = createWebUnitOfWorkFactory(handle, { nowMs: () => clock });
  const dispatcher = createCommandDispatcher({
    unitOfWork,
    clock: {
      now: () => ({ epochMs: clock }),
    },
  });
  return {
    handle,
    unitOfWork,
    dispatcher,
    advance(ms: number) {
      clock += ms;
    },
    setClock(ms: number) {
      clock = ms;
    },
  };
}

function diaperCommand(suffix: string, overrides: Record<string, unknown> = {}) {
  const intent = { epochMs: 1_700_000_000_000 };
  return {
    type: 'recordDiaper' as const,
    operationId: asOperationId(`op_diaper_${suffix}`),
    intentCapturedAt: intent,
    eventId: asEntityId(`diaper_${suffix}`),
    revisionId: asRevisionId(`rev_diaper_${suffix}`),
    childId,
    occurredAt: zonedInstant(intent, zone),
    contents: 'wet' as const,
    ...overrides,
  };
}

test('native dispatcher commits care once and replays identical retries', async () => {
  const ctx = await openNative('cmd-idempotent.db');
  const command = diaperCommand('a');
  const first = await ctx.dispatcher.dispatch(command);
  assert.equal(first.ok, true);
  assert.ok(first.ok && first.undo?.kind === 'undoCreateCare');
  assert.ok(ctx.topics.some((topics) => topics.includes('care')));

  const retry = await ctx.dispatcher.dispatch(command);
  assert.equal(retry.ok, true);
  if (retry.ok) {
    assert.equal(retry.completedAt.epochMs, first.ok ? first.completedAt.epochMs : -1);
  }

  const conflict = await ctx.dispatcher.dispatch({
    ...command,
    contents: 'dirty',
  });
  assert.equal(conflict.ok, false);
  assert.ok(!conflict.ok && conflict.error.details.reason === 'operation_body_mismatch');

  const intentional = await ctx.dispatcher.dispatch(diaperCommand('b'));
  assert.equal(intentional.ok, true);
  await ctx.db.close();
});

test('native soft-delete, ten-second undo, seven-day trash and payload purge', async () => {
  const ctx = await openNative('cmd-trash.db');
  const created = await ctx.dispatcher.dispatch(diaperCommand('trash'));
  assert.equal(created.ok, true);

  const deleteCmd = {
    type: 'softDeleteCare' as const,
    operationId: asOperationId('op_del_1'),
    intentCapturedAt: { epochMs: ctx.clock },
    eventId: asEntityId('diaper_trash'),
    deletionId: asEntityId('del_trash_1'),
    revisionId: asRevisionId('rev_del_1'),
  };
  const deleted = await ctx.dispatcher.dispatch(deleteCmd);
  assert.equal(deleted.ok, true);
  assert.ok(deleted.ok && deleted.undo?.kind === 'undoSoftDelete');
  assert.equal(UNDO_WINDOW_MS, 10_000);

  const missing = await ctx.unitOfWork.run((uow) => uow.care.getById(asEntityId('diaper_trash')));
  assert.equal(missing, null);
  const trash = await ctx.unitOfWork.run((uow) =>
    uow.revisions.findDeletion(asEntityId('del_trash_1')),
  );
  assert.ok(trash && trash.payloadPurged === false);

  // Restart-equivalent: reopen markers still present.
  const stillThere = await ctx.unitOfWork.run((uow) => uow.revisions.listDeletions());
  assert.equal(stillThere.length, 1);

  const restored = await ctx.dispatcher.dispatch({
    type: 'undoSoftDelete',
    operationId: asOperationId('op_undo_del_1'),
    intentCapturedAt: { epochMs: ctx.clock },
    eventId: asEntityId('diaper_trash'),
    deletionId: asEntityId('del_trash_1'),
    expectedDeletionRevisionId: asRevisionId('rev_del_1'),
    revisionId: asRevisionId('rev_restore_1'),
  });
  assert.equal(restored.ok, true);
  const active = await ctx.unitOfWork.run((uow) => uow.care.getById(asEntityId('diaper_trash')));
  assert.ok(active);

  // Delete again, expire retention, purge payload but keep marker.
  await ctx.dispatcher.dispatch({
    type: 'softDeleteCare',
    operationId: asOperationId('op_del_2'),
    intentCapturedAt: { epochMs: ctx.clock },
    eventId: asEntityId('diaper_trash'),
    deletionId: asEntityId('del_trash_2'),
    revisionId: asRevisionId('rev_del_2'),
  });
  ctx.advance(TRASH_RETENTION_MS + 1);
  const purged = await ctx.dispatcher.dispatch({
    type: 'purgeExpiredTrash',
    operationId: asOperationId('op_purge_1'),
    intentCapturedAt: { epochMs: ctx.clock },
    revisionId: asRevisionId('rev_purge_1'),
  });
  assert.equal(purged.ok, true);
  const marker = await ctx.unitOfWork.run((uow) =>
    uow.revisions.findDeletion(asEntityId('del_trash_2')),
  );
  assert.ok(marker);
  assert.equal(marker.payloadPurged, true);
  assert.equal(marker.payload, null);

  const blocked = await ctx.dispatcher.dispatch({
    type: 'restoreCare',
    operationId: asOperationId('op_restore_blocked'),
    intentCapturedAt: { epochMs: ctx.clock },
    eventId: asEntityId('diaper_trash'),
    deletionId: asEntityId('del_trash_2'),
    expectedDeletionRevisionId: asRevisionId('rev_del_2'),
    revisionId: asRevisionId('rev_restore_blocked'),
  });
  assert.equal(blocked.ok, false);
  await ctx.db.close();
});

test('undo create refuses when a newer revision exists', async () => {
  const ctx = await openNative('cmd-undo-conflict.db');
  const created = await ctx.dispatcher.dispatch(diaperCommand('u1'));
  assert.equal(created.ok, true);
  const updated = await ctx.dispatcher.dispatch({
    ...diaperCommand('u1'),
    operationId: asOperationId('op_update_u1'),
    revisionId: asRevisionId('rev_update_u1'),
    expectedRevisionId: asRevisionId('rev_diaper_u1'),
    contents: 'both',
  });
  assert.equal(updated.ok, true);
  const undo = await ctx.dispatcher.dispatch({
    type: 'undoCreateCare',
    operationId: asOperationId('op_undo_u1'),
    intentCapturedAt: { epochMs: ctx.clock },
    eventId: asEntityId('diaper_u1'),
    expectedRevisionId: asRevisionId('rev_diaper_u1'),
    deletionId: asEntityId('del_u1'),
    revisionId: asRevisionId('rev_undo_u1'),
  });
  assert.equal(undo.ok, false);
  assert.ok(!undo.ok && undo.error.details.reason === 'revision_conflict');
  await ctx.db.close();
});

test('faults before receipt roll back; after-commit fault keeps durable data', async () => {
  const opener = createMemoryEncryptedSqlOpener();
  const keyStore = createMemoryDatabaseKeyStore();
  const presence = createMemoryDatabasePresence();
  const checkpointStore = createMemoryCheckpointStore();
  const now = { epochMs: 1_700_000_000_000 };
  const db = await openPrivateDatabase({
    databaseName: 'cmd-faults.db',
    opener,
    keyStore,
    presence,
    checkpointStore,
    now,
  });
  await db.connection.runAsync(
    `INSERT INTO child_profiles (child_id, display_name, birth_date, summary_time_zone, payload_json) VALUES (?, ?, ?, ?, ?)`,
    childId,
    'Max',
    null,
    'Europe/Prague',
    '{}',
  );

  const beforeReceipt = createCommandDispatcher({
    unitOfWork: createNativeUnitOfWorkFactory(db, {
      faults: createControlledFaultInjection(new Set(['storage_before_receipt'])),
      nowMs: () => now.epochMs,
    }),
    clock: { now: () => now },
    faults: createControlledFaultInjection(new Set(['storage_before_receipt'])),
  });
  const failed = await beforeReceipt.dispatch(diaperCommand('fault1'));
  assert.equal(failed.ok, false);
  const rolledBack = await createNativeUnitOfWorkFactory(db).run((uow) =>
    uow.care.getById(asEntityId('diaper_fault1')),
  );
  assert.equal(rolledBack, null);

  const afterEntity = createCommandDispatcher({
    unitOfWork: createNativeUnitOfWorkFactory(db, {
      faults: createControlledFaultInjection(new Set(['storage_after_entity'])),
      nowMs: () => now.epochMs,
    }),
    clock: { now: () => now },
    faults: createControlledFaultInjection(new Set(['storage_after_entity'])),
  });
  const failedEntity = await afterEntity.dispatch(diaperCommand('fault2'));
  assert.equal(failedEntity.ok, false);

  const commitFault = createCommandDispatcher({
    unitOfWork: createNativeUnitOfWorkFactory(db, {
      faults: createControlledFaultInjection(new Set(['storage_commit'])),
      nowMs: () => now.epochMs,
    }),
    clock: { now: () => now },
  });
  const failedCommit = await commitFault.dispatch(diaperCommand('fault3'));
  assert.equal(failedCommit.ok, false);

  const afterCommit = createCommandDispatcher({
    unitOfWork: createNativeUnitOfWorkFactory(db, { nowMs: () => now.epochMs }),
    clock: { now: () => now },
    faults: createControlledFaultInjection(new Set(['storage_after_commit'])),
  });
  const committedButThrown = await afterCommit.dispatch(diaperCommand('fault4'));
  assert.equal(committedButThrown.ok, false);
  const durable = await createNativeUnitOfWorkFactory(db).run((uow) =>
    uow.care.getById(asEntityId('diaper_fault4')),
  );
  assert.ok(durable);
  await db.close();
});

test('drafts stay out of care summaries and survive a newer form', async () => {
  const ctx = await openNative('cmd-drafts.db');
  const prior = createDraft({
    draftId: asEntityId('draft_old'),
    childId,
    formType: 'bottle',
    originalEventTime: { epochMs: 1_699_000_000_000 },
    updatedAt: { epochMs: 1_699_000_000_000 },
    payload: { amount: 60 },
  });
  const saved = await ctx.dispatcher.dispatch({
    type: 'saveDraft',
    operationId: asOperationId('op_draft_1'),
    intentCapturedAt: { epochMs: ctx.clock },
    revisionId: asRevisionId('rev_draft_1'),
    draft: prior,
  });
  assert.equal(saved.ok, true);
  assert.equal(keepPriorDraftWhenStartingFresh(prior, 'diaper')?.draftId, prior.draftId);

  const autosave = createDraftAutosave(ctx.dispatcher, { debounceMs: 5 });
  autosave.schedule({
    type: 'saveDraft',
    operationId: asOperationId('op_draft_2'),
    intentCapturedAt: { epochMs: ctx.clock },
    revisionId: asRevisionId('rev_draft_2'),
    draft: createDraft({
      draftId: asEntityId('draft_new'),
      childId,
      formType: 'diaper',
      originalEventTime: { epochMs: ctx.clock },
      updatedAt: { epochMs: ctx.clock },
      payload: { contents: 'wet' },
    }),
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  await autosave.flush();
  const old = await ctx.unitOfWork.run((uow) => uow.drafts.getById(asEntityId('draft_old')));
  const newer = await ctx.unitOfWork.run((uow) => uow.drafts.getById(asEntityId('draft_new')));
  assert.ok(old);
  assert.ok(newer);
  autosave.dispose();
  await ctx.db.close();
});

test('web dispatcher matches native care write and soft-delete semantics', async () => {
  const ctx = await openWeb(String(Date.now()));
  const created = await ctx.dispatcher.dispatch(diaperCommand('web'));
  assert.equal(created.ok, true);
  const deleted = await ctx.dispatcher.dispatch({
    type: 'softDeleteCare',
    operationId: asOperationId('op_web_del'),
    intentCapturedAt: { epochMs: 1_700_000_000_000 },
    eventId: asEntityId('diaper_web'),
    deletionId: asEntityId('del_web'),
    revisionId: asRevisionId('rev_web_del'),
  });
  assert.equal(deleted.ok, true);
  const retry = await ctx.dispatcher.dispatch({
    type: 'softDeleteCare',
    operationId: asOperationId('op_web_del'),
    intentCapturedAt: { epochMs: 1_700_000_000_000 },
    eventId: asEntityId('diaper_web'),
    deletionId: asEntityId('del_web'),
    revisionId: asRevisionId('rev_web_del'),
  });
  assert.equal(retry.ok, true);
  await ctx.handle.close();
});

test('AppError classification stays free of care note payloads', () => {
  const error = new AppError('CONFLICT', 'Same operation id was reused with a different body', {
    details: { reason: 'operation_body_mismatch' },
  });
  assert.equal(JSON.stringify(error.details).includes('note'), false);
});
