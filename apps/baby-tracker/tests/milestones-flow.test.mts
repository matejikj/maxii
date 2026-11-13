import assert from 'node:assert/strict';
import { test } from 'node:test';
import 'fake-indexeddb/auto';
import {
  asChildId,
  asEntityId,
  asOperationId,
  asRevisionId,
  asTimeZoneId,
  createChildProfile,
  createNoteEvent,
  parseDiaryArchive,
  zonedInstant,
  DIARY_ARCHIVE_MAX_COMPAT,
} from '../src/domain/index.ts';
import { createCommandDispatcher } from '../src/application/index.ts';
import { buildEditCareCommand } from '../src/application/careEdit.ts';
import { listMilestoneMemories } from '../src/application/milestones.ts';
import { captureScopedDiaryArchive } from '../src/application/multiChildWorkspace.ts';
import { buildRecordMilestoneCommand } from '../src/features/today/recordMomentIntent.ts';
import { createMemoryCheckpointStore } from '../src/infrastructure/database/native/checkpoint.ts';
import { createMemoryDatabasePresence } from '../src/infrastructure/database/native/databasePresence.ts';
import { createMemoryDatabaseKeyStore } from '../src/infrastructure/database/native/memoryKeyStore.ts';
import { createMemoryEncryptedSqlOpener } from '../src/infrastructure/database/native/memoryEncryptedSql.ts';
import { createNativeUnitOfWorkFactory } from '../src/infrastructure/database/native/nativeUnitOfWork.ts';
import { openPrivateDatabase } from '../src/infrastructure/database/native/privateDatabase.ts';
import {
  createWebUnitOfWorkFactory,
  openWebDatabase,
} from '../src/infrastructure/database/web/index.ts';

const first = asChildId('milestone_first'),
  second = asChildId('milestone_second');
const zone = asTimeZoneId('Europe/Prague');
const now = 1_700_000_000_000;
async function fixture(kind: 'native' | 'web', suffix: string) {
  let unitOfWork, close;
  if (kind === 'native') {
    const db = await openPrivateDatabase({
      databaseName: `milestones-${suffix}.db`,
      opener: createMemoryEncryptedSqlOpener(),
      keyStore: createMemoryDatabaseKeyStore(),
      presence: createMemoryDatabasePresence(),
      checkpointStore: createMemoryCheckpointStore(),
      now: { epochMs: now },
    });
    unitOfWork = createNativeUnitOfWorkFactory(db, { nowMs: () => now });
    close = () => db.close();
  } else {
    const handle = await openWebDatabase({
      databaseName: `milestones-${suffix}`,
      lockDatabaseName: `milestones-locks-${suffix}`,
      now: { epochMs: now },
    });
    unitOfWork = createWebUnitOfWorkFactory(handle, { nowMs: () => now });
    close = () => handle.close();
  }
  await unitOfWork.run(async (tx) => {
    for (const childId of [first, second])
      await tx.profiles.save(
        createChildProfile({ childId, displayName: childId, summaryTimeZone: zone }),
      );
  });
  return {
    unitOfWork,
    close,
    commands: createCommandDispatcher({ unitOfWork, clock: { now: () => ({ epochMs: now }) } }),
  };
}
function command(suffix: string, milestoneKey?: string, childId = first) {
  return buildRecordMilestoneCommand({
    ids: {
      operationId: asOperationId(`op_${suffix}`),
      eventId: asEntityId(`evt_${suffix}`),
      revisionId: asRevisionId(`rev_${suffix}`),
    },
    childId,
    occurredAt: zonedInstant({ epochMs: now - 100_000 }, zone),
    body: 'První „ahoj“',
    note: 'Na procházce s tátou.',
    intentCapturedAtMs: now,
    ...(milestoneKey === undefined ? {} : { milestoneKey }),
  });
}
for (const kind of ['native', 'web'] as const) {
  test(`${kind}: linked and custom milestones survive edits, retries, older care and sibling isolation`, async (t) => {
    const ctx = await fixture(kind, `records-${kind}`);
    t.after(ctx.close);
    const linked = command('first_word', 'first-words');
    assert.equal((await ctx.commands.dispatch(linked)).ok, true);
    assert.equal((await ctx.commands.dispatch(linked)).ok, true);
    assert.equal((await ctx.commands.dispatch(command('custom'))).ok, true);
    assert.equal((await ctx.commands.dispatch(command('sibling', 'first-words', second))).ok, true);
    await ctx.unitOfWork.run(async (tx) => {
      for (let index = 0; index < 260; index++)
        await tx.care.save(
          createNoteEvent({
            eventId: asEntityId(`newer_${index}`),
            revisionId: asRevisionId(`newer_rev_${index}`),
            childId: first,
            body: 'Novější zápis',
            occurredAt: zonedInstant({ epochMs: now - index }, zone),
            createdAt: zonedInstant({ epochMs: now }, zone),
          }),
        );
    });
    const rows = await listMilestoneMemories(ctx.unitOfWork, first);
    assert.equal(rows.length, 2);
    assert.equal((await listMilestoneMemories(ctx.unitOfWork, second)).length, 1);
    assert.equal(rows.find((row) => row.eventId === 'evt_custom')?.milestoneKey, undefined);
    const event = rows.find((row) => row.milestoneKey === 'first-words')!;
    assert.equal(event.note, 'Na procházce s tátou.');
    const edited = buildEditCareCommand({
      event,
      expectedRevisionId: event.revisionId,
      operationId: asOperationId('op_edit'),
      revisionId: asRevisionId('rev_edit'),
      intentCapturedAtMs: now,
      patch: { body: 'První slůvko bylo „ahoj“' },
    });
    assert.equal((await ctx.commands.dispatch(edited)).ok, true);
    const updated = (await listMilestoneMemories(ctx.unitOfWork, first)).find(
      (row) => row.eventId === event.eventId,
    )!;
    assert.equal(updated.milestoneKey, 'first-words');
    assert.equal(updated.body, 'První slůvko bylo „ahoj“');
    const collision = await ctx.commands.dispatch({ ...linked, milestoneKey: 'first-steps' });
    assert.equal(
      collision.ok,
      false,
      'changing the atlas reference must not reuse an operation receipt',
    );
  });
  test(`${kind}: milestone references survive scoped JSON backup and soft delete/restore`, async (t) => {
    const ctx = await fixture(kind, `backup-${kind}`);
    t.after(ctx.close);
    const write = command('backup_word', 'first-words');
    assert.equal((await ctx.commands.dispatch(write)).ok, true);
    assert.equal(
      (await ctx.commands.dispatch(command('backup_sibling', 'first-steps', second))).ok,
      true,
    );
    const archive = await captureScopedDiaryArchive({
      unitOfWork: ctx.unitOfWork,
      nowMs: now,
      schemaCompatibility: DIARY_ARCHIVE_MAX_COMPAT,
      scope: { kind: 'one_child', childId: first },
    });
    const parsed = parseDiaryArchive(JSON.stringify(archive));
    assert.equal(parsed.careEvents.length, 1);
    const target = await fixture(kind, `restored-${kind}`);
    t.after(target.close);
    await target.unitOfWork.run((tx) => tx.diary.replace(parsed));
    assert.equal(
      (await listMilestoneMemories(target.unitOfWork, first))[0]?.milestoneKey,
      'first-words',
    );
    assert.deepEqual(await listMilestoneMemories(target.unitOfWork, second), []);
    const deletionId = asEntityId('delete_word'),
      revisionId = asRevisionId('rev_delete_word');
    assert.equal(
      (
        await ctx.commands.dispatch({
          type: 'softDeleteCare',
          operationId: asOperationId('op_delete_word'),
          intentCapturedAt: { epochMs: now },
          eventId: write.eventId,
          deletionId,
          revisionId,
        })
      ).ok,
      true,
    );
    assert.deepEqual(await listMilestoneMemories(ctx.unitOfWork, first), []);
    assert.equal(
      (
        await ctx.commands.dispatch({
          type: 'restoreCare',
          operationId: asOperationId('op_restore_word'),
          intentCapturedAt: { epochMs: now },
          eventId: write.eventId,
          deletionId,
          expectedDeletionRevisionId: revisionId,
          revisionId: asRevisionId('rev_restored_word'),
        })
      ).ok,
      true,
    );
    assert.equal(
      (await listMilestoneMemories(ctx.unitOfWork, first))[0]?.milestoneKey,
      'first-words',
    );
  });
}
