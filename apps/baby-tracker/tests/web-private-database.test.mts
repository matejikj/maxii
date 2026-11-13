import assert from 'node:assert/strict';
import { test } from 'node:test';
import 'fake-indexeddb/auto';
import {
  AppError,
  asChildId,
  asEntityId,
  asOperationId,
  asRevisionId,
  asTimeZoneId,
  createDiaperEvent,
  createDraft,
  startSession,
  zonedInstant,
} from '../src/domain/index.ts';
import { createControlledFaultInjection } from '../src/infrastructure/testing/controlledFaults.ts';
import {
  WEB_STORAGE_LIMITS,
  assertNoSensitiveWebSideChannel,
  createTabLeaseCoordinator,
  createWebUnitOfWorkFactory,
  ensureChildProfileRow,
  openWebDatabase,
  probeWebStorageCapabilities,
} from '../src/infrastructure/database/web/index.ts';

const zone = asTimeZoneId('Europe/Prague');
const now = { epochMs: 1_700_000_000_000 };

test('web UnitOfWork commits care and receipt together on real IndexedDB', async () => {
  const handle = await openWebDatabase({
    databaseName: `web-care-${Date.now()}`,
    lockDatabaseName: `web-locks-care-${Date.now()}`,
    now,
  });
  const childId = asChildId('child_web_1');
  await ensureChildProfileRow(handle.db, {
    childId,
    displayName: 'Max',
    summaryTimeZone: 'Europe/Prague',
  });

  const unitOfWork = createWebUnitOfWorkFactory(handle, { nowMs: () => now.epochMs });
  const versions: number[] = [];
  handle.changeFeed.subscribe((message) => versions.push(message.dataVersion));

  const event = createDiaperEvent({
    eventId: asEntityId('diaper_web_1'),
    childId,
    revisionId: asRevisionId('rev_web_1'),
    occurredAt: zonedInstant(now, zone),
    contents: 'wet',
    createdAt: zonedInstant(now, zone),
  });

  await unitOfWork.run(async (uow) => {
    await uow.care.save(event);
    await uow.revisions.saveReceipt({
      operationId: asOperationId('op_web_1'),
      commandType: 'recordDiaper',
      intentCapturedAt: now,
      completedAt: now,
      entityIds: [event.eventId],
      revisionIds: [event.revisionId],
      resultCode: 'savedLocally',
    });
  });

  const loaded = await unitOfWork.run((uow) => uow.care.getById(event.eventId));
  assert.equal(loaded?.type, 'diaper');
  assert.equal(await handle.getDataVersion(), 1);
  assert.ok(versions.includes(1));
  assert.equal(WEB_STORAGE_LIMITS.encryptionClaim, false);
  await handle.close();
});

test('commit fault rolls back web care and receipt together', async () => {
  const handle = await openWebDatabase({
    databaseName: `web-rollback-${Date.now()}`,
    lockDatabaseName: `web-locks-rollback-${Date.now()}`,
    now,
  });
  const childId = asChildId('child_web_2');
  await ensureChildProfileRow(handle.db, {
    childId,
    displayName: 'Max',
    summaryTimeZone: 'Europe/Prague',
  });
  const faults = createControlledFaultInjection(new Set(['storage_commit']));
  const unitOfWork = createWebUnitOfWorkFactory(handle, { faults, nowMs: () => now.epochMs });
  const event = createDiaperEvent({
    eventId: asEntityId('diaper_web_2'),
    childId,
    revisionId: asRevisionId('rev_web_2'),
    occurredAt: zonedInstant(now, zone),
    contents: 'both',
    createdAt: zonedInstant(now, zone),
  });

  await assert.rejects(
    () =>
      unitOfWork.run(async (uow) => {
        await uow.care.save(event);
        await uow.revisions.saveReceipt({
          operationId: asOperationId('op_web_2'),
          commandType: 'recordDiaper',
          intentCapturedAt: now,
          completedAt: now,
          entityIds: [event.eventId],
          revisionIds: [event.revisionId],
          resultCode: 'savedLocally',
        });
      }),
    (error: unknown) => error instanceof AppError && error.details.reason === 'storage_commit',
  );

  const loaded = await createWebUnitOfWorkFactory(handle).run((uow) =>
    uow.care.getById(event.eventId),
  );
  const receipt = await createWebUnitOfWorkFactory(handle).run((uow) =>
    uow.revisions.findReceipt(asOperationId('op_web_2')),
  );
  assert.equal(loaded, null);
  assert.equal(receipt, null);
  await handle.close();
});

test('two tabs cannot hold the write lease or create two active sleep sessions', async () => {
  const stamp = Date.now();
  const diaryName = `web-tabs-${stamp}`;
  const lockName = `web-locks-tabs-${stamp}`;
  const tabA = await openWebDatabase({
    databaseName: diaryName,
    lockDatabaseName: lockName,
    tabId: 'tab_a',
    now,
  });
  const tabB = await openWebDatabase({
    databaseName: diaryName,
    lockDatabaseName: lockName,
    tabId: 'tab_b',
    now,
  });
  const childId = asChildId('child_web_3');
  await ensureChildProfileRow(tabA.db, {
    childId,
    displayName: 'Max',
    summaryTimeZone: 'Europe/Prague',
  });

  await tabA.lease.acquire('write');
  await assert.rejects(
    () => tabB.lease.acquire('write'),
    (error: unknown) => error instanceof AppError && error.details.reason === 'tab_lease_held',
  );
  await tabA.lease.release('write');

  const uowA = createWebUnitOfWorkFactory(tabA, { nowMs: () => now.epochMs });
  await uowA.run(async (uow) => {
    await uow.sessions.save(
      startSession({
        sessionId: asEntityId('sleep_a'),
        childId,
        kind: 'sleep',
        startedAt: zonedInstant(now, zone),
      }),
    );
  });

  const uowB = createWebUnitOfWorkFactory(tabB, { nowMs: () => now.epochMs });
  await assert.rejects(
    () =>
      uowB.run(async (uow) => {
        await uow.sessions.save(
          startSession({
            sessionId: asEntityId('sleep_b'),
            childId,
            kind: 'sleep',
            startedAt: zonedInstant(now, zone),
          }),
        );
      }),
    (error: unknown) =>
      error instanceof AppError && error.details.reason === 'active_session_exists',
  );

  await tabA.close();
  await tabB.close();
});

test('expired lease from a crashed tab is reclaimable without locking the diary forever', async () => {
  let clock = 1_700_000_000_000;
  const lockName = `web-locks-crash-${Date.now()}`;
  const crashed = createTabLeaseCoordinator({
    tabId: 'crashed_tab',
    lockDatabaseName: lockName,
    nowMs: () => clock,
  });
  await crashed.acquire('write', 1_000);
  clock += 5_000;
  const survivor = createTabLeaseCoordinator({
    tabId: 'survivor_tab',
    lockDatabaseName: lockName,
    nowMs: () => clock,
  });
  await survivor.reclaimExpired(clock);
  await survivor.acquire('write');
  await survivor.release('write');
  crashed.close();
  survivor.close();
});

test('web limits stay honest and drafts survive foreign commits as preserved state', async () => {
  const handle = await openWebDatabase({
    databaseName: `web-limits-${Date.now()}`,
    lockDatabaseName: `web-locks-limits-${Date.now()}`,
    now,
  });
  const childId = asChildId('child_web_4');
  await ensureChildProfileRow(handle.db, {
    childId,
    displayName: 'Max',
    summaryTimeZone: 'Europe/Prague',
  });
  const unitOfWork = createWebUnitOfWorkFactory(handle, { nowMs: () => now.epochMs });
  await unitOfWork.run(async (uow) => {
    await uow.drafts.save(
      createDraft({
        draftId: asEntityId('draft_web_1'),
        childId,
        formType: 'bottle',
        originalEventTime: now,
        updatedAt: now,
        payload: { amount: null },
      }),
    );
  });

  let preserved = false;
  handle.changeFeed.subscribe((message) => {
    preserved = message.preserveOpenDraft === true;
  });
  await unitOfWork.run(async (uow) => {
    await uow.care.save(
      createDiaperEvent({
        eventId: asEntityId('diaper_web_3'),
        childId,
        revisionId: asRevisionId('rev_web_3'),
        occurredAt: zonedInstant(now, zone),
        contents: 'dirty',
        createdAt: zonedInstant(now, zone),
      }),
    );
  });
  const draft = await unitOfWork.run((uow) => uow.drafts.getById(asEntityId('draft_web_1')));
  assert.ok(draft);
  assert.equal(preserved, true);

  const caps = await probeWebStorageCapabilities();
  assert.equal(caps.limits.encryptionClaim, false);
  assert.equal(caps.limits.persistenceGuarantee, false);
  assert.throws(() => assertNoSensitiveWebSideChannel('localStorage'));
  await handle.close();
});

test('quota and open failures fail closed without false success', async () => {
  await assert.rejects(
    () =>
      openWebDatabase({
        databaseName: `web-full-${Date.now()}`,
        lockDatabaseName: `web-locks-full-${Date.now()}`,
        faults: createControlledFaultInjection(new Set(['storage_full'])),
        now,
      }),
    (error: unknown) => error instanceof AppError && error.details.reason === 'storage_full',
  );
});

test('web UnitOfWork stores photo attachment metadata in diary IndexedDB', async () => {
  const handle = await openWebDatabase({
    databaseName: `web-photo-${Date.now()}`,
    lockDatabaseName: `web-locks-photo-${Date.now()}`,
    now,
  });
  try {
    const childId = asChildId('child_web_photo');
    const eventId = asEntityId('note_web_photo');
    await ensureChildProfileRow(handle.db, {
      childId,
      displayName: 'Max',
      summaryTimeZone: 'Europe/Prague',
    });
    const { asAttachmentId, asRenditionId, asAttachmentJobId } =
      await import('../src/domain/attachments/types.ts');
    const unitOfWork = createWebUnitOfWorkFactory(handle, { nowMs: () => now.epochMs });
    await unitOfWork.run(async (uow) => {
      await uow.attachments.save({
        attachmentId: asAttachmentId('att_web_1'),
        childId,
        eventId,
        hostEventType: 'milestone',
        orderIndex: 0,
        caption: null,
        recordedBy: null,
        createdAtMs: now.epochMs,
        deletedAtMs: null,
        retainUntilMs: null,
        offlinePinned: false,
        localOrigin: 'imported',
        renditions: [
          {
            renditionId: asRenditionId('rend_web_1'),
            attachmentId: asAttachmentId('att_web_1'),
            role: 'thumbnail',
            mime: 'image/jpeg',
            width: 320,
            height: 240,
            byteLength: 400,
            sha256: 'def',
            normalizationVersion: 'lumi.photo-normalize.v1',
            blobKey: 'att/att_web_1/thumb.jpe.sealed',
            availability: 'durable',
          },
        ],
      });
      await uow.attachments.saveJob({
        jobId: asAttachmentJobId('job_web_1'),
        attachmentId: asAttachmentId('att_web_1'),
        childId,
        eventId,
        state: 'linked',
        errorCode: null,
        sourceMime: 'image/png',
        createdAtMs: now.epochMs,
        updatedAtMs: now.epochMs,
      });
    });
    const listed = await unitOfWork.run((uow) => uow.attachments.listForEvent(eventId));
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.hostEventType, 'milestone');
    const job = await unitOfWork.run((uow) =>
      uow.attachments.getJob(asAttachmentJobId('job_web_1')),
    );
    assert.equal(job?.sourceMime, 'image/png');
  } finally {
    await handle.close();
  }
});
