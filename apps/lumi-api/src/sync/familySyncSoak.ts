import { randomUUID } from 'node:crypto';
import type { AppUserId, FamilyId, SyncOperation } from '@lumi/contracts';
import { LUMI_API_PROTOCOL_VERSION } from '@lumi/contracts';
import { hashSyncPayload } from './syncStore.ts';

/**
 * Software multi-replica sync soak. Logical "devices" exercise push/pull,
 * conflicts, revoke, and epoch cut-over against the family API. This never
 * substitutes for two physical offline phones — it only proves the protocol
 * converges (or surfaces explainable conflicts) under fault injection.
 */

export type SoakHttpResponse = {
  readonly statusCode: number;
  json(): unknown;
};

export type SoakHttpClient = {
  inject(input: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    payload?: unknown;
  }): Promise<SoakHttpResponse>;
};

export type SoakDevice = {
  readonly label: string;
  readonly appUserId: AppUserId;
  readonly deviceId: string;
  token: string;
  cursor: string | null;
  readonly acceptedOperationIds: Set<string>;
  online: boolean;
  readonly pending: SyncOperation[];
};

export type FamilySyncSoakReport = {
  readonly format: 'lumi.family-sync-soak.v1';
  readonly rounds: number;
  readonly devices: readonly string[];
  readonly acceptedCount: number;
  readonly conflictCount: number;
  readonly revokedPushDenied: boolean;
  readonly staleCursorResyncRequired: boolean;
  readonly tombstoneRejectedStaleCreate: boolean;
  readonly convergedOrExplainable: boolean;
  readonly physicalPhonesClaimed: false;
  readonly findings: readonly string[];
};

export type FamilySyncSoakDeps = {
  readonly app: SoakHttpClient;
  readonly familyId: FamilyId;
  readonly admin: SoakDevice;
  readonly caregiver: SoakDevice;
  /** Long-disconnected third replica that reconnects after epoch cut-over. */
  readonly replica: SoakDevice;
  readonly rotateEpoch: () => void;
  readonly materializeTombstone: (entityId: string, revisionId: string) => void;
  readonly revokeMembership: (membershipId: string) => Promise<void>;
  readonly caregiverMembershipId: string;
  readonly rounds?: number;
};

function buildOp(input: {
  actor: SoakDevice;
  entityId: string;
  revisionId: string;
  parentRevisionIds?: string[];
  kind?: SyncOperation['kind'];
  payload: Record<string, unknown>;
}): SyncOperation {
  return {
    schemaVersion: LUMI_API_PROTOCOL_VERSION,
    operationId: randomUUID(),
    deviceId: input.actor.deviceId,
    actorAppUserId: input.actor.appUserId,
    kind: input.kind ?? 'care.record',
    entityId: input.entityId,
    revisionId: input.revisionId,
    parentRevisionIds: input.parentRevisionIds ?? [],
    payloadHash: hashSyncPayload(input.payload),
    payload: input.payload,
  };
}

async function pushOps(
  deps: FamilySyncSoakDeps,
  device: SoakDevice,
  operations: SyncOperation[],
): Promise<{
  statusCode: number;
  receipts: Array<{ operationId: string; status: string; reason?: string }>;
}> {
  if (operations.length === 0) {
    return { statusCode: 200, receipts: [] };
  }
  const response = await deps.app.inject({
    method: 'POST',
    url: `/v1/families/${deps.familyId}/sync/push`,
    headers: { authorization: `Bearer ${device.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations,
    },
  });
  const body = response.json() as {
    receipts?: Array<{ operationId: string; status: string; reason?: string }>;
  };
  return {
    statusCode: response.statusCode,
    receipts: Array.isArray(body.receipts) ? body.receipts : [],
  };
}

function recordReceipts(
  device: SoakDevice,
  receipts: Array<{ operationId: string; status: string }>,
  counters: { acceptedCount: number; conflictCount: number },
): void {
  for (const receipt of receipts) {
    if (receipt.status === 'accepted_with_conflict') {
      counters.conflictCount += 1;
      device.acceptedOperationIds.add(receipt.operationId);
      counters.acceptedCount += 1;
      continue;
    }
    if (receipt.status === 'accepted') {
      device.acceptedOperationIds.add(receipt.operationId);
      counters.acceptedCount += 1;
    }
  }
}

async function pullDevice(
  deps: FamilySyncSoakDeps,
  device: SoakDevice,
): Promise<{ statusCode: number; resyncRequired: boolean; operationIds: string[] }> {
  const query =
    device.cursor == null ? '?limit=200' : `?cursor=${encodeURIComponent(device.cursor)}&limit=200`;
  const response = await deps.app.inject({
    method: 'GET',
    url: `/v1/families/${deps.familyId}/sync/pull${query}`,
    headers: { authorization: `Bearer ${device.token}` },
  });
  const body = response.json() as {
    error?: { code?: string };
    sync?: {
      resyncRequired?: boolean;
      nextCursor?: string | null;
      entries?: Array<{ operationId: string }>;
    };
    nextCursor?: string | null;
    entries?: Array<{ operationId: string }>;
    resyncRequired?: boolean;
  };
  if (response.statusCode === 409 || body.error?.code === 'resync_required') {
    return { statusCode: response.statusCode, resyncRequired: true, operationIds: [] };
  }
  const entries = Array.isArray(body.entries)
    ? body.entries
    : Array.isArray(body.sync?.entries)
      ? body.sync.entries
      : [];
  const next = body.nextCursor ?? body.sync?.nextCursor ?? null;
  if (typeof next === 'string') device.cursor = next;
  return {
    statusCode: response.statusCode,
    resyncRequired: Boolean(body.sync?.resyncRequired ?? body.resyncRequired),
    operationIds: entries.map((entry) => entry.operationId),
  };
}

/**
 * Run a deterministic software soak: two online caregivers diverge once, keep
 * writing independent creates, a third replica stays offline through cut-over,
 * membership revoke is denied, and a tombstone blocks stale create.
 */
export async function runFamilySyncSoak(deps: FamilySyncSoakDeps): Promise<FamilySyncSoakReport> {
  const rounds = Math.max(3, deps.rounds ?? 6);
  const findings: string[] = [];
  const counters = { acceptedCount: 0, conflictCount: 0 };
  let staleCursorResyncRequired = false;

  const sharedEntity = randomUUID();
  const root = buildOp({
    actor: deps.admin,
    entityId: sharedEntity,
    revisionId: 'soak-root',
    payload: { revisionKind: 'create', text: 'shared-root' },
  });
  recordReceipts(deps.admin, (await pushOps(deps, deps.admin, [root])).receipts, counters);

  // Single divergence: both heads retained without auto-merge.
  const branchA = buildOp({
    actor: deps.admin,
    entityId: sharedEntity,
    revisionId: 'soak-admin-head',
    parentRevisionIds: ['soak-root'],
    kind: 'care.update',
    payload: { revisionKind: 'update', text: 'admin-head' },
  });
  const branchB = buildOp({
    actor: deps.caregiver,
    entityId: sharedEntity,
    revisionId: 'soak-care-head',
    parentRevisionIds: ['soak-root'],
    kind: 'care.update',
    payload: { revisionKind: 'update', text: 'care-head' },
  });
  recordReceipts(deps.admin, (await pushOps(deps, deps.admin, [branchA])).receipts, counters);
  recordReceipts(
    deps.caregiver,
    (await pushOps(deps, deps.caregiver, [branchB])).receipts,
    counters,
  );
  await pullDevice(deps, deps.admin);
  await pullDevice(deps, deps.caregiver);

  deps.replica.online = false;
  for (let round = 0; round < rounds; round += 1) {
    const adminCreate = buildOp({
      actor: deps.admin,
      entityId: randomUUID(),
      revisionId: `soak-admin-create-${round}`,
      payload: { revisionKind: 'create', text: `admin-${round}` },
    });
    const careCreate = buildOp({
      actor: deps.caregiver,
      entityId: randomUUID(),
      revisionId: `soak-care-create-${round}`,
      payload: { revisionKind: 'create', text: `care-${round}` },
    });
    recordReceipts(deps.admin, (await pushOps(deps, deps.admin, [adminCreate])).receipts, counters);
    recordReceipts(
      deps.caregiver,
      (await pushOps(deps, deps.caregiver, [careCreate])).receipts,
      counters,
    );
    await pullDevice(deps, deps.admin);
    await pullDevice(deps, deps.caregiver);

    deps.replica.pending.push(
      buildOp({
        actor: deps.replica,
        entityId: randomUUID(),
        revisionId: `soak-replica-${round}`,
        payload: { revisionKind: 'create', text: `offline-${round}` },
      }),
    );
  }

  const staleCursor = deps.admin.cursor;
  deps.rotateEpoch();
  if (staleCursor) {
    deps.admin.cursor = staleCursor;
    const resync = await pullDevice(deps, deps.admin);
    staleCursorResyncRequired = resync.resyncRequired || resync.statusCode === 409;
    if (staleCursorResyncRequired) {
      findings.push('stale_cursor_demands_resync_after_epoch_cutover');
      deps.admin.cursor = null;
      await pullDevice(deps, deps.admin);
    }
  }

  deps.replica.online = true;
  recordReceipts(
    deps.replica,
    (await pushOps(deps, deps.replica, deps.replica.pending.splice(0))).receipts,
    counters,
  );
  deps.replica.cursor = null;
  await pullDevice(deps, deps.replica);
  await pullDevice(deps, deps.caregiver);

  const doomed = randomUUID();
  const createDoomed = buildOp({
    actor: deps.admin,
    entityId: doomed,
    revisionId: 'soak-doomed-create',
    payload: { revisionKind: 'create', text: 'doomed' },
  });
  recordReceipts(deps.admin, (await pushOps(deps, deps.admin, [createDoomed])).receipts, counters);
  const del = buildOp({
    actor: deps.admin,
    entityId: doomed,
    revisionId: 'soak-doomed-delete',
    parentRevisionIds: ['soak-doomed-create'],
    kind: 'care.delete',
    payload: { revisionKind: 'delete' },
  });
  recordReceipts(deps.admin, (await pushOps(deps, deps.admin, [del])).receipts, counters);
  deps.materializeTombstone(doomed, 'soak-doomed-delete');

  const staleCreate = buildOp({
    actor: deps.caregiver,
    entityId: doomed,
    revisionId: 'soak-doomed-stale-create',
    payload: { revisionKind: 'create', text: 'resurrect' },
  });
  const stalePush = await pushOps(deps, deps.caregiver, [staleCreate]);
  const tombstoneRejectedStaleCreate = stalePush.receipts.some(
    (receipt) => receipt.status === 'rejected' && receipt.reason === 'tombstoned',
  );
  if (tombstoneRejectedStaleCreate) findings.push('tombstone_blocked_stale_create');

  await deps.revokeMembership(deps.caregiverMembershipId);
  const afterRevoke = buildOp({
    actor: deps.caregiver,
    entityId: randomUUID(),
    revisionId: 'soak-after-revoke',
    payload: { revisionKind: 'create', text: 'should-fail' },
  });
  const denied = await pushOps(deps, deps.caregiver, [afterRevoke]);
  const revokedPushDenied = denied.statusCode === 403 || denied.statusCode === 401;
  if (revokedPushDenied) findings.push('revoked_member_push_denied');

  deps.admin.cursor = null;
  deps.replica.cursor = null;
  const adminFinal = await pullDevice(deps, deps.admin);
  const replicaFinal = await pullDevice(deps, deps.replica);
  const seen = new Set([...adminFinal.operationIds, ...replicaFinal.operationIds]);
  let missingAccepted = 0;
  for (const id of [...deps.admin.acceptedOperationIds, ...deps.replica.acceptedOperationIds]) {
    if (!seen.has(id)) missingAccepted += 1;
  }

  const convergedOrExplainable =
    missingAccepted === 0 &&
    counters.conflictCount >= 1 &&
    revokedPushDenied &&
    staleCursorResyncRequired &&
    tombstoneRejectedStaleCreate;

  if (missingAccepted === 0) {
    findings.push('authorized_devices_retain_accepted_operations');
  } else {
    findings.push(`missing_accepted_operations:${missingAccepted}`);
  }
  if (counters.conflictCount >= 1) {
    findings.push('explainable_conflict_heads_retained');
  }
  findings.push('physical_two_phone_proof_not_claimed');

  return {
    format: 'lumi.family-sync-soak.v1',
    rounds,
    devices: [deps.admin.label, deps.caregiver.label, deps.replica.label],
    acceptedCount: counters.acceptedCount,
    conflictCount: counters.conflictCount,
    revokedPushDenied,
    staleCursorResyncRequired,
    tombstoneRejectedStaleCreate,
    convergedOrExplainable,
    physicalPhonesClaimed: false,
    findings,
  };
}

export function createSoakDevice(input: {
  label: string;
  appUserId: AppUserId;
  deviceId: string;
  token: string;
}): SoakDevice {
  return {
    label: input.label,
    appUserId: input.appUserId,
    deviceId: input.deviceId,
    token: input.token,
    cursor: null,
    acceptedOperationIds: new Set(),
    online: true,
    pending: [],
  };
}
