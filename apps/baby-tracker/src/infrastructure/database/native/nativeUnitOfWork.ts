import type {
  ActiveSession,
  CareEvent,
  CareRepository,
  ChildId,
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
  DeletionMarker,
} from '../../../domain';
import { AppError } from '../../../domain/errors';
import type { ChangeTopic } from './changeFeed';
import type { PrivateDatabase } from './privateDatabase';
import type { SqlConnection } from './sqlConnection';
import {
  careEventFromRow,
  careEventToRow,
  deletionToRow,
  draftFromRow,
  draftToRow,
  receiptFromRow,
  receiptToRow,
  revisionToRow,
  sessionFromRow,
  sessionToRow,
  type CareEventRow,
} from './serialization';

export function createNativeUnitOfWorkFactory(
  database: PrivateDatabase,
  options: { faults?: FaultInjection; nowMs?: () => number } = {},
): UnitOfWorkFactory {
  return {
    async run<T>(work: (uow: UnitOfWork) => Promise<T>): Promise<T> {
      return database.writeQueue.run(async () => {
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

        const topics = new Set<ChangeTopic>();
        let result: T | undefined;
        await database.connection.withExclusiveTransactionAsync(async (txn) => {
          const uow = createRepositories(txn, topics);
          result = await work(uow);
          if (options.faults?.shouldFail('storage_commit')) {
            throw new AppError('STORAGE', 'Injected commit failure', {
              details: { reason: 'storage_commit' },
              retryable: true,
            });
          }
          if (topics.size > 0) {
            const publishedAtMs = options.nowMs?.() ?? Date.now();
            await txn.runAsync(
              `INSERT INTO change_notifications (published_at_ms, topics_json) VALUES (?, ?)`,
              publishedAtMs,
              JSON.stringify([...topics]),
            );
          }
        });

        if (topics.size > 0) {
          await database.changeFeed.publish([...topics], options.nowMs?.() ?? Date.now());
        }
        return result as T;
      });
    },
  };
}

function createRepositories(txn: SqlConnection, topics: Set<ChangeTopic>): UnitOfWork {
  const care: CareRepository = {
    async getById(eventId) {
      const row = await txn.getFirstAsync<CareEventRow>(
        'SELECT event_id, child_id, event_type, revision_id, sort_at_ms, payload_json FROM care_events WHERE event_id = ?',
        eventId,
      );
      return row ? careEventFromRow(row) : null;
    },
    async save(event: CareEvent) {
      const row = careEventToRow(event);
      await txn.runAsync('DELETE FROM care_events WHERE event_id = ?', row.event_id);
      await txn.runAsync(
        `INSERT INTO care_events (event_id, child_id, event_type, revision_id, sort_at_ms, payload_json) VALUES (?, ?, ?, ?, ?, ?)`,
        row.event_id,
        row.child_id,
        row.event_type,
        row.revision_id,
        row.sort_at_ms,
        row.payload_json,
      );
      topics.add('care');
    },
  };

  const sessions: SessionRepository = {
    async getActive(childId: ChildId, kind: SessionKind) {
      const row = await txn.getFirstAsync<{ payload_json: string }>(
        `SELECT payload_json FROM sessions WHERE child_id = ? AND kind = ? AND status IN ('running', 'paused')`,
        childId,
        kind,
      );
      return row ? (sessionFromRow(row) as ActiveSession) : null;
    },
    async save(session: SessionRecord) {
      const row = sessionToRow(session);
      await txn.runAsync('DELETE FROM sessions WHERE session_id = ?', row.session_id);
      await txn.runAsync(
        `INSERT INTO sessions (session_id, child_id, kind, status, payload_json) VALUES (?, ?, ?, ?, ?)`,
        row.session_id,
        row.child_id,
        row.kind,
        row.status,
        row.payload_json,
      );
      topics.add('sessions');
    },
  };

  const drafts: DraftRepository = {
    async getById(draftId: EntityId) {
      const row = await txn.getFirstAsync<{ payload_json: string }>(
        'SELECT payload_json FROM drafts WHERE draft_id = ?',
        draftId,
      );
      return row ? draftFromRow(row) : null;
    },
    async save(draft: Draft) {
      const row = draftToRow(draft);
      await txn.runAsync('DELETE FROM drafts WHERE draft_id = ?', row.draft_id);
      await txn.runAsync(
        `INSERT INTO drafts (draft_id, child_id, form_type, original_event_time_ms, updated_at_ms, payload_json) VALUES (?, ?, ?, ?, ?, ?)`,
        row.draft_id,
        row.child_id,
        row.form_type,
        row.original_event_time_ms,
        row.updated_at_ms,
        row.payload_json,
      );
      topics.add('drafts');
    },
    async delete(draftId: EntityId) {
      await txn.runAsync('DELETE FROM drafts WHERE draft_id = ?', draftId);
      topics.add('drafts');
    },
  };

  const revisions: RevisionRepository = {
    async saveRevision(revision: Revision) {
      const row = revisionToRow(revision);
      await txn.runAsync(
        `INSERT INTO revisions (
          revision_id, entity_id, operation_id, parent_revision_ids_json, command_type,
          created_at_ms, device_id, actor_id, state_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.revision_id,
        row.entity_id,
        row.operation_id,
        row.parent_revision_ids_json,
        row.command_type,
        row.created_at_ms,
        row.device_id,
        row.actor_id,
        row.state_json,
      );
      topics.add('revisions');
    },
    async saveReceipt(receipt: OperationReceipt) {
      const row = receiptToRow(receipt);
      await txn.runAsync(
        `INSERT INTO operation_receipts (
          operation_id, command_type, intent_captured_at_ms, completed_at_ms,
          entity_ids_json, revision_ids_json, result_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        row.operation_id,
        row.command_type,
        row.intent_captured_at_ms,
        row.completed_at_ms,
        row.entity_ids_json,
        row.revision_ids_json,
        row.result_code,
      );
      topics.add('revisions');
    },
    async findReceipt(operationId: OperationId) {
      const row = await txn.getFirstAsync<{
        operation_id: string;
        command_type: string;
        intent_captured_at_ms: number;
        completed_at_ms: number;
        entity_ids_json: string;
        revision_ids_json: string;
        result_code: 'savedLocally';
      }>('SELECT * FROM operation_receipts WHERE operation_id = ?', operationId);
      return row ? receiptFromRow(row) : null;
    },
    async saveDeletion(marker: DeletionMarker) {
      const row = deletionToRow(marker);
      await txn.runAsync(
        `INSERT INTO deletion_markers (
          deletion_id, entity_id, entity_type, deleted_at_ms, revision_id, retain_until_ms
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        row.deletion_id,
        row.entity_id,
        row.entity_type,
        row.deleted_at_ms,
        row.revision_id,
        row.retain_until_ms,
      );
      topics.add('revisions');
    },
  };

  return { care, sessions, drafts, revisions };
}
