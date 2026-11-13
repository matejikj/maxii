import assert from 'node:assert/strict';
import { test } from 'node:test';
import 'fake-indexeddb/auto';
import {
  asChildId,
  asEntityId,
  asOperationId,
  asRevisionId,
  asTimeZoneId,
  createNoteEvent,
  createSleepEvent,
  zonedInstant,
} from '../src/domain/index.ts';
import {
  careEventFromTrashMarker,
  createCommandDispatcher,
  createReadModelInvalidator,
  loadHistoryDay,
  loadHistoryPage,
  loadRestorableTrash,
  rebuildSearchIndex,
} from '../src/application/index.ts';
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
import { buildEditCareCommand } from '../src/features/history/buildEditCareCommand.ts';
import {
  clearHistoryFilters,
  createInitialHistoryTabState,
  historyFiltersActive,
  showTodayRecords,
} from '../src/app/navigation/historyTabState.ts';

const zone = asTimeZoneId('Europe/Prague');
const childId = asChildId('child_history_1');

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
  const dispatcher = createCommandDispatcher({
    unitOfWork,
    clock: { now: () => ({ epochMs: clock }) },
    onCommitted: (topics) => readModels.notifyCommitted(topics),
  });
  return {
    db,
    unitOfWork,
    dispatcher,
    advance(ms: number) {
      clock += ms;
    },
    get clock() {
      return clock;
    },
  };
}

async function openWeb(stamp: string) {
  const clock = 1_700_000_000_000;
  const handle = await openWebDatabase({
    databaseName: `web-hist-${stamp}`,
    lockDatabaseName: `web-hist-locks-${stamp}`,
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
    clock: { now: () => ({ epochMs: clock }) },
  });
  return {
    handle,
    unitOfWork,
    dispatcher,
    clock,
  };
}

function noteCommand(suffix: string, occurredAtMs: number, body: string) {
  return {
    type: 'recordNote' as const,
    operationId: asOperationId(`op_note_${suffix}`),
    intentCapturedAt: { epochMs: 1_700_000_000_000 },
    eventId: asEntityId(`note_${suffix}`),
    revisionId: asRevisionId(`rev_note_${suffix}`),
    childId,
    occurredAt: zonedInstant({ epochMs: occurredAtMs }, zone),
    body,
  };
}

test('native history pages stay stable when a newer event is inserted mid-scroll', async () => {
  const ctx = await openNative('hist-page.db');
  for (let i = 0; i < 12; i += 1) {
    const saved = await ctx.dispatcher.dispatch(
      noteCommand(`p${i}`, 1_700_000_000_000 - i * 60_000, `poznámka ${i}`),
    );
    assert.equal(saved.ok, true);
  }

  const first = await ctx.unitOfWork.run((uow) =>
    loadHistoryPage(uow, {
      childId,
      bucket: 'all',
      careSubtype: null,
      searchQuery: '',
      limit: 5,
      before: null,
    }),
  );
  assert.equal(first.events.length, 5);
  assert.ok(first.nextCursor);

  const insert = await ctx.dispatcher.dispatch(
    noteCommand('new_top', 1_700_000_000_000 + 60_000, 'nový zápis nahoře'),
  );
  assert.equal(insert.ok, true);

  const second = await ctx.unitOfWork.run((uow) =>
    loadHistoryPage(uow, {
      childId,
      bucket: 'all',
      careSubtype: null,
      searchQuery: '',
      limit: 5,
      before: first.nextCursor,
    }),
  );
  const overlap = second.events.some((event) =>
    first.events.some((seen) => seen.eventId === event.eventId),
  );
  assert.equal(overlap, false);
  assert.equal(
    second.events.some((event) => event.eventId === 'note_new_top'),
    false,
  );
  await ctx.db.close();
});

test('native search index rebuild recovers after document wipe without deleting care', async () => {
  const ctx = await openNative('hist-search.db');
  const yesterdayMs = 1_700_000_000_000 - 86_400_000;
  const created = await ctx.dispatcher.dispatch(
    noteCommand('search', yesterdayMs, 'Hledaná aktivita u babičky'),
  );
  assert.equal(created.ok, true);

  const hit = await ctx.unitOfWork.run((uow) => uow.search.search(childId, 'babicky', 10, null));
  assert.equal(hit.events.length, 1);

  await ctx.unitOfWork.run(async (uow) => {
    await uow.search.remove(asEntityId('note_search'));
  });
  const missing = await ctx.unitOfWork.run((uow) =>
    uow.search.search(childId, 'babicky', 10, null),
  );
  assert.equal(missing.events.length, 0);

  const rebuilt = await ctx.unitOfWork.run((uow) => rebuildSearchIndex(uow, childId));
  assert.equal(rebuilt, 1);
  const restored = await ctx.unitOfWork.run((uow) =>
    uow.search.search(childId, 'babicky', 10, null),
  );
  assert.equal(restored.events.length, 1);
  const stillThere = await ctx.unitOfWork.run((uow) => uow.care.getById(asEntityId('note_search')));
  assert.ok(stillThere);

  const day = await ctx.unitOfWork.run((uow) =>
    loadHistoryDay(uow, {
      childId,
      fromSortAtMsInclusive: yesterdayMs - 1_000,
      toSortAtMsExclusive: yesterdayMs + 1_000,
      bucket: 'notes',
      careSubtype: null,
      searchQuery: 'babicky',
    }),
  );
  assert.equal(day.length, 1);
  await ctx.db.close();
});

test('edit and soft-delete keep today/history/trash consistent on native', async () => {
  const ctx = await openNative('hist-edit.db');
  const created = await ctx.dispatcher.dispatch(
    noteCommand('edit', 1_700_000_000_000, 'původní text'),
  );
  assert.equal(created.ok, true);
  const live = await ctx.unitOfWork.run((uow) => uow.care.getById(asEntityId('note_edit')));
  assert.ok(live);

  const edited = await ctx.dispatcher.dispatch(
    buildEditCareCommand({
      event: live,
      expectedRevisionId: live.revisionId,
      operationId: asOperationId('op_edit_1'),
      revisionId: asRevisionId('rev_edit_1'),
      intentCapturedAtMs: ctx.clock,
      patch: { body: 'opravený text' },
    }),
  );
  assert.equal(edited.ok, true);
  const afterEdit = await ctx.unitOfWork.run((uow) => uow.care.getById(asEntityId('note_edit')));
  assert.equal(afterEdit && afterEdit.type === 'note' ? afterEdit.body : null, 'opravený text');

  const deleted = await ctx.dispatcher.dispatch({
    type: 'softDeleteCare',
    operationId: asOperationId('op_del_edit'),
    intentCapturedAt: { epochMs: ctx.clock },
    eventId: asEntityId('note_edit'),
    deletionId: asEntityId('del_edit'),
    revisionId: asRevisionId('rev_del_edit'),
  });
  assert.equal(deleted.ok, true);
  const gone = await ctx.unitOfWork.run((uow) => uow.care.getById(asEntityId('note_edit')));
  assert.equal(gone, null);
  const trash = await ctx.unitOfWork.run((uow) => loadRestorableTrash(uow, ctx.clock));
  assert.equal(trash.length, 1);
  assert.ok(careEventFromTrashMarker(trash[0]!));

  const restored = await ctx.dispatcher.dispatch({
    type: 'restoreCare',
    operationId: asOperationId('op_restore_edit'),
    intentCapturedAt: { epochMs: ctx.clock },
    eventId: asEntityId('note_edit'),
    deletionId: asEntityId('del_edit'),
    revisionId: asRevisionId('rev_restore_edit'),
    expectedDeletionRevisionId: asRevisionId('rev_del_edit'),
  });
  assert.equal(restored.ok, true);
  const back = await ctx.unitOfWork.run((uow) => uow.care.getById(asEntityId('note_edit')));
  assert.ok(back);
  await ctx.db.close();
});

test('web search and paging work offline without network', async () => {
  const ctx = await openWeb(`${Date.now()}`);
  for (let i = 0; i < 8; i += 1) {
    const saved = await ctx.dispatcher.dispatch(
      noteCommand(`w${i}`, 1_700_000_000_000 - i * 120_000, `web poznámka ${i}`),
    );
    assert.equal(saved.ok, true);
  }
  const page = await ctx.unitOfWork.run((uow) =>
    loadHistoryPage(uow, {
      childId,
      bucket: 'notes',
      careSubtype: null,
      searchQuery: 'poznamka 3',
      limit: 10,
      before: null,
    }),
  );
  assert.equal(page.events.length, 1);
  assert.equal(page.events[0]?.eventId, 'note_w3');

  const rebuilt = await ctx.unitOfWork.run((uow) => rebuildSearchIndex(uow, childId));
  assert.equal(rebuilt, 8);
  await ctx.handle.close();
});

test('dense synthetic history pages without skipping rows', async () => {
  const ctx = await openNative('hist-dense.db');
  // Three years of daily notes in one transaction exercises paging + search rebuild.
  const days = 365 * 3;
  const base = 1_600_000_000_000;
  await ctx.unitOfWork.run(async (uow) => {
    for (let i = 0; i < days; i += 1) {
      const event = createNoteEvent({
        eventId: asEntityId(`dense_${String(i).padStart(5, '0')}`),
        childId,
        revisionId: asRevisionId(`rev_dense_${i}`),
        occurredAt: zonedInstant({ epochMs: base + i * 86_400_000 }, zone),
        body: `denní záznam číslo ${i}`,
        createdAt: zonedInstant({ epochMs: base + i * 86_400_000 + 1 }, zone),
      });
      await uow.care.save(event);
    }
  });

  const seen = new Set<string>();
  let cursor = null as Awaited<ReturnType<typeof loadHistoryPage>>['nextCursor'];
  let pages = 0;
  while (pages < 50) {
    const page = await ctx.unitOfWork.run((uow) =>
      loadHistoryPage(uow, {
        childId,
        bucket: 'all',
        careSubtype: null,
        searchQuery: '',
        limit: 50,
        before: cursor,
      }),
    );
    for (const event of page.events) {
      assert.equal(seen.has(event.eventId), false);
      seen.add(event.eventId);
    }
    pages += 1;
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  assert.equal(seen.size, days);

  const rebuilt = await ctx.unitOfWork.run((uow) => rebuildSearchIndex(uow, childId));
  assert.equal(rebuilt, days);
  const markerBody = 'unikatni marker xyzzy pro hustou historii';
  await ctx.unitOfWork.run(async (uow) => {
    const existing = await uow.care.getById(asEntityId('dense_00100'));
    assert.ok(existing && existing.type === 'note');
    await uow.care.save({ ...existing, body: markerBody });
  });
  const sample = await ctx.unitOfWork.run((uow) =>
    uow.search.search(childId, 'unikatni marker xyzzy', 5, null),
  );
  assert.equal(sample.events.length, 1);
  assert.equal(sample.events[0]?.eventId, 'dense_00100');
  await ctx.db.close();
});

test('history tab helpers clear filters without wiping section memory', () => {
  const focused = showTodayRecords('2026-11-08');
  assert.equal(focused.focusDate, '2026-11-08');
  assert.equal(historyFiltersActive(focused), true);
  const withSection = {
    ...focused,
    section: 'trash' as const,
    searchQuery: 'x',
  };
  const cleared = clearHistoryFilters(withSection);
  assert.equal(cleared.filter, 'all');
  assert.equal(cleared.searchQuery, '');
  assert.equal(cleared.focusDate, null);
  assert.equal(cleared.section, 'trash');
  assert.equal(historyFiltersActive(createInitialHistoryTabState()), false);
});

test('trash for the selected child excludes deleted care belonging to another child', async () => {
  const ctx = await openNative('hist-child-trash.db');
  const otherChild = asChildId('child_history_other');
  try {
    await ctx.db.connection.runAsync(
      'INSERT INTO child_profiles (child_id, display_name, birth_date, summary_time_zone, payload_json) VALUES (?, ?, ?, ?, ?)',
      otherChild,
      'Druhé dítě',
      '2025-01-01',
      'Europe/Prague',
      '{}',
    );
    for (const [suffix, selectedChild] of [
      ['trash_first', childId],
      ['trash_other', otherChild],
    ] as const) {
      const saved = await ctx.dispatcher.dispatch({
        ...noteCommand(suffix, ctx.clock, 'Poznámka dítěte'),
        childId: selectedChild,
      });
      assert.equal(saved.ok, true);
      const deleted = await ctx.dispatcher.dispatch({
        type: 'softDeleteCare',
        operationId: asOperationId(`op_delete_${suffix}`),
        intentCapturedAt: { epochMs: ctx.clock },
        eventId: asEntityId(`note_${suffix}`),
        deletionId: asEntityId(`del_${suffix}`),
        revisionId: asRevisionId(`rev_delete_${suffix}`),
      });
      assert.equal(deleted.ok, true);
    }
    const firstTrash = await ctx.unitOfWork.run((uow) =>
      loadRestorableTrash(uow, ctx.clock, childId),
    );
    const otherTrash = await ctx.unitOfWork.run((uow) =>
      loadRestorableTrash(uow, ctx.clock, otherChild),
    );
    const allTrash = await ctx.unitOfWork.run((uow) => loadRestorableTrash(uow, ctx.clock));
    assert.deepEqual(
      firstTrash.map((marker) => marker.entityId),
      ['note_trash_first'],
    );
    assert.deepEqual(
      otherTrash.map((marker) => marker.entityId),
      ['note_trash_other'],
    );
    assert.equal(allTrash.length, 2);
  } finally {
    await ctx.db.close();
  }
});

test('a sparse sleep filter scans past long runs of newer notes and keeps a stable visible cursor', async () => {
  const ctx = await openNative('hist-sparse-filter.db');
  try {
    await ctx.unitOfWork.run(async (uow) => {
      for (let i = 0; i < 200; i++) {
        await uow.care.save(
          createNoteEvent({
            eventId: asEntityId(`sparse_note_${i}`),
            childId,
            revisionId: asRevisionId(`rev_sparse_note_${i}`),
            occurredAt: zonedInstant({ epochMs: ctx.clock + i * 1000 }, zone),
            body: 'společný marker',
            createdAt: zonedInstant({ epochMs: ctx.clock }, zone),
          }),
        );
      }
      for (let i = 0; i < 3; i++) {
        const observedAt = zonedInstant({ epochMs: ctx.clock - (i + 1) * 1000 }, zone);
        await uow.care.save(
          createSleepEvent({
            eventId: asEntityId(`sparse_sleep_${i}`),
            childId,
            revisionId: asRevisionId(`rev_sparse_sleep_${i}`),
            occurrence: { kind: 'unknownDuration', observedAt },
            note: 'společný marker',
            createdAt: observedAt,
          }),
        );
      }
      await rebuildSearchIndex(uow, childId);
    });
    for (const searchQuery of ['', 'spolecny marker']) {
      const first = await ctx.unitOfWork.run((uow) =>
        loadHistoryPage(uow, {
          childId,
          bucket: 'care',
          careSubtype: 'sleep',
          searchQuery,
          limit: 2,
          before: null,
        }),
      );
      assert.deepEqual(
        first.events.map((event) => event.eventId),
        ['sparse_sleep_0', 'sparse_sleep_1'],
      );
      assert.ok(first.nextCursor);
      const second = await ctx.unitOfWork.run((uow) =>
        loadHistoryPage(uow, {
          childId,
          bucket: 'care',
          careSubtype: 'sleep',
          searchQuery,
          limit: 2,
          before: first.nextCursor,
        }),
      );
      assert.deepEqual(
        second.events.map((event) => event.eventId),
        ['sparse_sleep_2'],
      );
      assert.equal(second.nextCursor, null);
    }
  } finally {
    await ctx.db.close();
  }
});

test('day search finds matching older days even behind more than five hundred newer matches', async () => {
  const ctx = await openNative('hist-day-search-depth.db');
  const dayStart = Date.UTC(2026, 0, 1, 23);
  try {
    await ctx.unitOfWork.run(async (uow) => {
      for (let i = 0; i < 510; i++) {
        const occurredAt = zonedInstant({ epochMs: dayStart + 2 * 86_400_000 + i * 1000 }, zone);
        await uow.care.save(
          createNoteEvent({
            eventId: asEntityId(`day_newer_${i}`),
            childId,
            revisionId: asRevisionId(`rev_day_newer_${i}`),
            body: 'hledaná vzpomínka',
            occurredAt,
            createdAt: occurredAt,
          }),
        );
      }
      const occurredAt = zonedInstant({ epochMs: dayStart + 12 * 3_600_000 }, zone);
      await uow.care.save(
        createNoteEvent({
          eventId: asEntityId('day_older_hit'),
          childId,
          revisionId: asRevisionId('rev_day_older_hit'),
          body: 'hledaná vzpomínka',
          occurredAt,
          createdAt: occurredAt,
        }),
      );
      await rebuildSearchIndex(uow, childId);
    });
    const rows = await ctx.unitOfWork.run((uow) =>
      loadHistoryDay(uow, {
        childId,
        bucket: 'all',
        careSubtype: null,
        searchQuery: 'hledana vzpominka',
        fromSortAtMsInclusive: dayStart,
        toSortAtMsExclusive: dayStart + 86_400_000,
      }),
    );
    assert.deepEqual(
      rows.map((event) => event.eventId),
      ['day_older_hit'],
    );
  } finally {
    await ctx.db.close();
  }
});
