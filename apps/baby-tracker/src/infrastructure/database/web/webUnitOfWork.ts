import type {
  ActiveSession,
  CareEvent,
  CareRepository,
  ChildId,
  DeletionMarker,
  Draft,
  DraftRepository,
  EntityId,
  FaultInjection,
  OperationId,
  OperationReceipt,
  Revision,
  RevisionRepository,
  SessionKind,
  SessionRecord,
  SessionRepository,
  UnitOfWork,
  UnitOfWorkFactory,
} from '../../../domain';
import { AppError } from '../../../domain/errors';
import type { ChangeTopic } from '../native/changeFeed';
import {
  careEventFromRow,
  careSortAtMs,
  deletionToRow,
  draftFromRow,
  draftToRow,
  encodeJson,
  receiptFromRow,
  receiptToRow,
  revisionToRow,
  sessionFromRow,
  sessionToRow,
} from '../native/serialization';
import type { LumiWebDatabase } from './lumiWebDatabase';
import type { TabLeaseCoordinator } from './tabLease';
import type { WebChangeFeed } from './webChangeFeed';

export type WebDiaryRuntime = {
  db: LumiWebDatabase;
  lease: TabLeaseCoordinator;
  changeFeed: WebChangeFeed;
  getDataVersion(): Promise<number>;
  bumpDataVersion(txnDb: LumiWebDatabase): Promise<number>;
};

/**
 * Dexie UnitOfWork. All repository awaits stay inside one IndexedDB transaction
 * so the browser cannot auto-commit mid-operation on a dangling Promise.
 */
export function createWebUnitOfWorkFactory(
  runtime: WebDiaryRuntime,
  options: { faults?: FaultInjection; nowMs?: () => number } = {},
): UnitOfWorkFactory {
  return {
    async run<T>(work: (uow: UnitOfWork) => Promise<T>): Promise<T> {
      if (options.faults?.shouldFail('storage_busy')) {
        throw new AppError('STORAGE', 'Database is busy or locked', {
          details: { reason: 'storage_busy' },
          retryable: true,
        });
      }
      if (options.faults?.shouldFail('storage_full')) {
        throw new AppError('STORAGE', 'Device storage is full', {
          details: { reason: 'storage_full' },
          retryable: true,
        });
      }

      await runtime.lease.reclaimExpired(options.nowMs?.() ?? Date.now());
      await runtime.lease.acquire('write');
      const topics = new Set<ChangeTopic>();
      let result: T | undefined;
      let dataVersion = 0;

      try {
        await runtime.db.transaction(
          'rw',
          [
            runtime.db.childProfiles,
            runtime.db.careEvents,
            runtime.db.sessions,
            runtime.db.drafts,
            runtime.db.revisions,
            runtime.db.operationReceipts,
            runtime.db.deletionMarkers,
            runtime.db.meta,
            runtime.db.changeNotifications,
          ],
          async () => {
            const uow = createRepositories(runtime.db, topics);
            result = await work(uow);
            if (options.faults?.shouldFail('storage_commit')) {
              throw new AppError('STORAGE', 'Injected commit failure', {
                details: { reason: 'storage_commit' },
                retryable: true,
              });
            }
            if (topics.size > 0) {
              dataVersion = await runtime.bumpDataVersion(runtime.db);
              const publishedAtMs = options.nowMs?.() ?? Date.now();
              await runtime.db.changeNotifications.add({
                publishedAtMs,
                topicsJson: JSON.stringify([...topics]),
                dataVersion,
              });
            }
          },
        );
      } catch (error) {
        mapQuotaError(error);
        throw error;
      } finally {
        await runtime.lease.release('write');
      }

      if (topics.size > 0) {
        await runtime.changeFeed.publish(
          [...topics],
          options.nowMs?.() ?? Date.now(),
          dataVersion,
        );
      }
      return result as T;
    },
  };
}

function createRepositories(db: LumiWebDatabase, topics: Set<ChangeTopic>): UnitOfWork {
  const care: CareRepository = {
    async getById(eventId) {
      const row = await db.careEvents.get(eventId);
      if (!row) return null;
      return careEventFromRow({
        event_id: row.eventId,
        child_id: row.childId,
        event_type: row.eventType,
        revision_id: row.revisionId,
        sort_at_ms: row.sortAtMs,
        payload_json: row.payloadJson,
      });
    },
    async save(event: CareEvent) {
      await db.careEvents.put({
        eventId: event.eventId,
        childId: event.childId,
        eventType: event.type,
        revisionId: event.revisionId,
        sortAtMs: careSortAtMs(event),
        payloadJson: encodeJson(event),
      });
      topics.add('care');
    },
  };

  const sessions: SessionRepository = {
    async getActive(childId: ChildId, kind: SessionKind) {
      const row = await db.sessions
        .where('[childId+kind]')
        .equals([childId, kind])
        .filter((item) => item.status === 'running' || item.status === 'paused')
        .first();
      return row ? (sessionFromRow({ payload_json: row.payloadJson }) as ActiveSession) : null;
    },
    async save(session: SessionRecord) {
      // Enforce one local active session per kind inside the same transaction.
      if (session.status === 'running' || session.status === 'paused') {
        const clash = await db.sessions
          .where('[childId+kind]')
          .equals([session.childId, session.kind])
          .filter(
            (item) =>
              item.sessionId !== session.sessionId &&
              (item.status === 'running' || item.status === 'paused'),
          )
          .first();
        if (clash) {
          throw new AppError('CONFLICT', 'A local active session of this type already exists', {
            details: { reason: 'active_session_exists', kind: session.kind },
          });
        }
      }
      const row = sessionToRow(session);
      await db.sessions.put({
        sessionId: row.session_id,
        childId: row.child_id,
        kind: row.kind,
        status: row.status,
        payloadJson: row.payload_json,
      });
      topics.add('sessions');
    },
  };

  const drafts: DraftRepository = {
    async getById(draftId: EntityId) {
      const row = await db.drafts.get(draftId);
      return row ? draftFromRow({ payload_json: row.payloadJson }) : null;
    },
    async save(draft: Draft) {
      const row = draftToRow(draft);
      await db.drafts.put({
        draftId: row.draft_id,
        childId: row.child_id,
        formType: row.form_type,
        originalEventTimeMs: row.original_event_time_ms,
        updatedAtMs: row.updated_at_ms,
        payloadJson: row.payload_json,
      });
      topics.add('drafts');
    },
    async delete(draftId: EntityId) {
      await db.drafts.delete(draftId);
      topics.add('drafts');
    },
  };

  const revisions: RevisionRepository = {
    async saveRevision(revision: Revision) {
      const row = revisionToRow(revision);
      await db.revisions.put({
        revisionId: row.revision_id,
        entityId: row.entity_id,
        operationId: row.operation_id,
        parentRevisionIdsJson: row.parent_revision_ids_json,
        commandType: row.command_type,
        createdAtMs: row.created_at_ms,
        deviceId: row.device_id == null ? null : String(row.device_id),
        actorId: row.actor_id == null ? null : String(row.actor_id),
        stateJson: row.state_json,
      });
      topics.add('revisions');
    },
    async saveReceipt(receipt: OperationReceipt) {
      const row = receiptToRow(receipt);
      await db.operationReceipts.put({
        operationId: row.operation_id,
        commandType: row.command_type,
        intentCapturedAtMs: row.intent_captured_at_ms,
        completedAtMs: row.completed_at_ms,
        entityIdsJson: row.entity_ids_json,
        revisionIdsJson: row.revision_ids_json,
        resultCode: row.result_code,
      });
      topics.add('revisions');
    },
    async findReceipt(operationId: OperationId) {
      const row = await db.operationReceipts.get(operationId);
      if (!row) return null;
      return receiptFromRow({
        operation_id: row.operationId,
        command_type: row.commandType,
        intent_captured_at_ms: row.intentCapturedAtMs,
        completed_at_ms: row.completedAtMs,
        entity_ids_json: row.entityIdsJson,
        revision_ids_json: row.revisionIdsJson,
        result_code: row.resultCode as 'savedLocally',
      });
    },
    async saveDeletion(marker: DeletionMarker) {
      const row = deletionToRow(marker);
      await db.deletionMarkers.put({
        deletionId: row.deletion_id,
        entityId: row.entity_id,
        entityType: row.entity_type,
        deletedAtMs: row.deleted_at_ms,
        revisionId: row.revision_id,
        retainUntilMs: row.retain_until_ms,
      });
      topics.add('revisions');
    },
  };

  return { care, sessions, drafts, revisions };
}

function mapQuotaError(error: unknown): void {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  if (name === 'QuotaExceededError' || /quota/i.test(message)) {
    throw new AppError('STORAGE', 'Browser storage quota was exceeded', {
      details: { reason: 'storage_full' },
      retryable: true,
      cause: error,
    });
  }
}

export async function ensureChildProfileRow(
  db: LumiWebDatabase,
  input: {
    childId: string;
    displayName: string;
    birthDate?: string | null;
    summaryTimeZone: string;
    payloadJson?: string;
  },
): Promise<void> {
  await db.childProfiles.put({
    childId: input.childId,
    displayName: input.displayName,
    birthDate: input.birthDate ?? null,
    summaryTimeZone: input.summaryTimeZone,
    payloadJson: input.payloadJson ?? encodeJson({ childId: input.childId }),
  });
}
