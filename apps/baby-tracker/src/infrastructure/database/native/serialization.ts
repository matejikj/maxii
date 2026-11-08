import type {
  ActiveSession,
  CareEvent,
  ChildProfile,
  DeletionMarker,
  Draft,
  OperationReceipt,
  Revision,
  SessionRecord,
} from '../../../domain';

export function encodeJson(value: unknown): string {
  return JSON.stringify(value);
}

export function decodeJson<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

export function careSortAtMs(event: CareEvent): number {
  switch (event.type) {
    case 'sleep':
    case 'nursing':
      return event.occurrence.kind === 'known'
        ? event.occurrence.start.instant.epochMs
        : event.occurrence.observedAt.instant.epochMs;
    case 'bottle':
    case 'food':
    case 'diaper':
    case 'note':
    case 'experience':
    case 'milestone':
      return event.occurredAt.instant.epochMs;
    case 'growth':
      return event.measuredOn.instant.epochMs;
  }
}

export type CareEventRow = {
  event_id: string;
  child_id: string;
  event_type: string;
  revision_id: string;
  sort_at_ms: number;
  payload_json: string;
};

export function careEventToRow(event: CareEvent): CareEventRow {
  return {
    event_id: event.eventId,
    child_id: event.childId,
    event_type: event.type,
    revision_id: event.revisionId,
    sort_at_ms: careSortAtMs(event),
    payload_json: encodeJson(event),
  };
}

export function careEventFromRow(row: CareEventRow): CareEvent {
  return decodeJson<CareEvent>(row.payload_json);
}

export function profileToRow(profile: ChildProfile) {
  return {
    child_id: profile.childId,
    display_name: profile.displayName,
    birth_date: profile.birthDate
      ? `${String(profile.birthDate.year).padStart(4, '0')}-${String(profile.birthDate.month).padStart(2, '0')}-${String(profile.birthDate.day).padStart(2, '0')}`
      : null,
    summary_time_zone: profile.settings.summaryTimeZone,
    payload_json: encodeJson(profile),
  };
}

export function profileFromRow(row: { payload_json: string }): ChildProfile {
  return decodeJson<ChildProfile>(row.payload_json);
}

export function sessionToRow(session: SessionRecord | ActiveSession) {
  return {
    session_id: session.sessionId,
    child_id: session.childId,
    kind: session.kind,
    status: session.status,
    payload_json: encodeJson(session),
  };
}

export function sessionFromRow(row: { payload_json: string }): SessionRecord {
  return decodeJson<SessionRecord>(row.payload_json);
}

export function draftToRow(draft: Draft) {
  return {
    draft_id: draft.draftId,
    child_id: draft.childId,
    form_type: draft.formType,
    original_event_time_ms: draft.originalEventTime.epochMs,
    updated_at_ms: draft.updatedAt.epochMs,
    payload_json: encodeJson(draft),
  };
}

export function draftFromRow(row: { payload_json: string }): Draft {
  return decodeJson<Draft>(row.payload_json);
}

export function revisionToRow(revision: Revision) {
  return {
    revision_id: revision.revisionId,
    entity_id: revision.entityId,
    operation_id: revision.operationId,
    parent_revision_ids_json: encodeJson(revision.parentRevisionIds),
    command_type: revision.commandType,
    created_at_ms: revision.createdAt.epochMs,
    device_id: revision.deviceId,
    actor_id: revision.actorId,
    state_json: encodeJson(revision.state),
  };
}

export function revisionFromRow(row: {
  revision_id: string;
  entity_id: string;
  operation_id: string;
  parent_revision_ids_json: string;
  command_type: string;
  created_at_ms: number;
  device_id: string | null;
  actor_id: string | null;
  state_json: string;
}): Revision {
  return {
    revisionId: row.revision_id as Revision['revisionId'],
    entityId: row.entity_id as Revision['entityId'],
    operationId: row.operation_id as Revision['operationId'],
    parentRevisionIds: decodeJson(row.parent_revision_ids_json),
    commandType: row.command_type,
    createdAt: { epochMs: row.created_at_ms },
    deviceId: row.device_id as Revision['deviceId'],
    actorId: row.actor_id as Revision['actorId'],
    state: decodeJson(row.state_json),
  };
}

export function receiptToRow(receipt: OperationReceipt) {
  return {
    operation_id: receipt.operationId,
    command_type: receipt.commandType,
    intent_captured_at_ms: receipt.intentCapturedAt.epochMs,
    completed_at_ms: receipt.completedAt.epochMs,
    entity_ids_json: encodeJson(receipt.entityIds),
    revision_ids_json: encodeJson(receipt.revisionIds),
    result_code: receipt.resultCode,
  };
}

export function receiptFromRow(row: {
  operation_id: string;
  command_type: string;
  intent_captured_at_ms: number;
  completed_at_ms: number;
  entity_ids_json: string;
  revision_ids_json: string;
  result_code: 'savedLocally';
}): OperationReceipt {
  return {
    operationId: row.operation_id as OperationReceipt['operationId'],
    commandType: row.command_type,
    intentCapturedAt: { epochMs: row.intent_captured_at_ms },
    completedAt: { epochMs: row.completed_at_ms },
    entityIds: decodeJson(row.entity_ids_json),
    revisionIds: decodeJson(row.revision_ids_json),
    resultCode: row.result_code,
  };
}

export function deletionToRow(marker: DeletionMarker) {
  return {
    deletion_id: marker.deletionId,
    entity_id: marker.entityId,
    entity_type: marker.entityType,
    deleted_at_ms: marker.deletedAt.epochMs,
    revision_id: marker.revisionId,
    retain_until_ms: marker.retainUntil.epochMs,
    payload_json: marker.payload == null ? null : encodeJson(marker.payload),
    payload_purged: marker.payloadPurged ? 1 : 0,
  };
}

export function deletionFromRow(row: {
  deletion_id: string;
  entity_id: string;
  entity_type: string;
  deleted_at_ms: number;
  revision_id: string;
  retain_until_ms: number;
  payload_json?: string | null;
  payload_purged?: number | null;
}): DeletionMarker {
  return {
    deletionId: row.deletion_id as DeletionMarker['deletionId'],
    entityId: row.entity_id as DeletionMarker['entityId'],
    entityType: row.entity_type,
    deletedAt: { epochMs: row.deleted_at_ms },
    revisionId: row.revision_id as DeletionMarker['revisionId'],
    retainUntil: { epochMs: row.retain_until_ms },
    payload: row.payload_json ? decodeJson(row.payload_json) : null,
    payloadPurged: row.payload_purged === 1,
  };
}
