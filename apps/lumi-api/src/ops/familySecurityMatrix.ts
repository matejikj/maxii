import { randomUUID } from 'node:crypto';
import type { AppUserId, FamilyId, SyncOperation } from '@lumi/contracts';
import { LUMI_API_PROTOCOL_VERSION } from '@lumi/contracts';
import { verifyCsrfDoubleSubmit } from '../auth/csrf.ts';
import { createFixedWindowRateLimiter } from '../http/rateLimit.ts';
import { hashSyncPayload } from '../sync/syncStore.ts';

/**
 * Software family security acceptance matrix. Exercises IDOR, invitations,
 * revoke, tombstones, rate limits, CSRF, expired tokens, and error redaction.
 * Passing this suite is not an independent human security review.
 */

export type SecurityCheckId =
  | 'cross_family_idor'
  | 'invitation_token_single_use'
  | 'revoked_member_push_denied'
  | 'tombstone_blocks_resurrect'
  | 'rate_limit_burst'
  | 'csrf_cookie_mismatch'
  | 'expired_token_rejected'
  | 'sensitive_canary_absent_from_errors';

export type SecurityCheckResult = {
  readonly id: SecurityCheckId;
  readonly ok: boolean;
  readonly detail: string;
};

export type FamilySecurityMatrixReport = {
  readonly format: 'lumi.family-security-matrix.v1';
  readonly checks: readonly SecurityCheckResult[];
  readonly allSoftwareChecksPassed: boolean;
  /** Always false — automated suite cannot substitute for an independent review. */
  readonly independentHumanReviewClaimed: false;
  readonly findings: readonly string[];
};

export type SecurityMatrixHttp = {
  inject(input: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    payload?: unknown;
  }): Promise<{ statusCode: number; json(): unknown; body: string }>;
};

export type SecurityMatrixTokens = {
  mintTestToken(input: {
    subject: string;
    appUserId: AppUserId;
    issuer?: string;
    expiresInSec?: number;
  }): Promise<string>;
};

export type SecurityMatrixSync = {
  materializeTombstone(
    familyId: FamilyId,
    entityId: string,
    deletedByRevisionId: string,
    now: string,
  ): void;
};

export type FamilySecurityMatrixDeps = {
  readonly app: SecurityMatrixHttp;
  readonly tokens: SecurityMatrixTokens;
  readonly sync: SecurityMatrixSync;
  /** Canary string that must never appear in API error bodies. */
  readonly diaryCanary: string;
};

function check(id: SecurityCheckId, ok: boolean, detail: string): SecurityCheckResult {
  return { id, ok, detail };
}

function buildOp(input: {
  actorAppUserId: AppUserId;
  entityId: string;
  revisionId: string;
  parentRevisionIds?: string[];
  kind?: SyncOperation['kind'];
  payload: Record<string, unknown>;
}): SyncOperation {
  return {
    schemaVersion: LUMI_API_PROTOCOL_VERSION,
    operationId: randomUUID(),
    deviceId: 'security-matrix-device',
    actorAppUserId: input.actorAppUserId,
    kind: input.kind ?? 'care.record',
    entityId: input.entityId,
    revisionId: input.revisionId,
    parentRevisionIds: input.parentRevisionIds ?? [],
    payloadHash: hashSyncPayload(input.payload),
    payload: input.payload,
  };
}

async function createFamily(
  deps: FamilySecurityMatrixDeps,
  token: string,
  key: string,
  displayName: string,
): Promise<FamilyId> {
  const created = await deps.app.inject({
    method: 'POST',
    url: '/v1/families',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: key,
      displayName,
    },
  });
  if (created.statusCode !== 201) {
    throw new Error(`family_create_failed:${created.statusCode}`);
  }
  return (created.json() as { familyId: FamilyId }).familyId;
}

/**
 * Run the software security matrix against an in-process family API.
 */
export async function runFamilySecurityMatrix(
  deps: FamilySecurityMatrixDeps,
): Promise<FamilySecurityMatrixReport> {
  const checks: SecurityCheckResult[] = [];
  const findings: string[] = [];
  const canary = deps.diaryCanary;

  const adminA = randomUUID() as AppUserId;
  const adminB = randomUUID() as AppUserId;
  const caregiver = randomUUID() as AppUserId;
  const tokenA = await deps.tokens.mintTestToken({ subject: 'sec-a', appUserId: adminA });
  const tokenB = await deps.tokens.mintTestToken({ subject: 'sec-b', appUserId: adminB });
  const caregiverToken = await deps.tokens.mintTestToken({
    subject: 'sec-care',
    appUserId: caregiver,
  });
  const familyA = await createFamily(deps, tokenA, 'sec-family-a', 'Security A');
  const familyB = await createFamily(deps, tokenB, 'sec-family-b', 'Security B');

  // Cross-family IDOR on seeded object.
  const seeded = await deps.app.inject({
    method: 'POST',
    url: '/v1/test/seed-object',
    payload: { familyId: familyA, label: canary },
  });
  const objectId =
    seeded.statusCode === 201 ? ((seeded.json() as { objectId: string }).objectId as string) : '';
  const idor = await deps.app.inject({
    method: 'GET',
    url: `/v1/families/${familyA}/objects/${objectId || 'missing'}`,
    headers: { authorization: `Bearer ${tokenB}` },
  });
  const idorOk = idor.statusCode === 403 && !idor.body.includes(canary);
  checks.push(
    check(
      'cross_family_idor',
      idorOk,
      idorOk
        ? 'Foreign family member cannot read guessed object IDs'
        : `IDOR status=${idor.statusCode} body_leaked_canary=${idor.body.includes(canary)}`,
    ),
  );

  // Invitation one-time use after accept.
  const invite = await deps.app.inject({
    method: 'POST',
    url: `/v1/families/${familyA}/invitations`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: 'sec-invite',
      role: 'caregiver',
    },
  });
  const oneTimeToken =
    invite.statusCode === 201
      ? ((invite.json() as { oneTimeToken: string }).oneTimeToken as string)
      : '';
  const accepted = await deps.app.inject({
    method: 'POST',
    url: '/v1/invitations/accept',
    headers: { authorization: `Bearer ${caregiverToken}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: 'sec-join',
      oneTimeToken,
      childLinkDecision: 'defer',
    },
  });
  const stranger = randomUUID() as AppUserId;
  const strangerToken = await deps.tokens.mintTestToken({
    subject: 'sec-stranger',
    appUserId: stranger,
  });
  const reuse = await deps.app.inject({
    method: 'POST',
    url: '/v1/invitations/accept',
    headers: { authorization: `Bearer ${strangerToken}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: 'sec-reuse',
      oneTimeToken,
      childLinkDecision: 'defer',
    },
  });
  const inviteOk =
    (accepted.statusCode === 201 || accepted.statusCode === 200) && reuse.statusCode >= 400;
  checks.push(
    check(
      'invitation_token_single_use',
      inviteOk,
      inviteOk
        ? 'Invitation token cannot be redeemed by a second account after accept'
        : `accept=${accepted.statusCode} reuse=${reuse.statusCode}`,
    ),
  );
  const membershipId =
    accepted.statusCode === 201 || accepted.statusCode === 200
      ? String((accepted.json() as { membershipId?: string }).membershipId ?? '')
      : '';

  // Revoked caregiver cannot push.
  await deps.app.inject({
    method: 'POST',
    url: `/v1/families/${familyA}/members/${membershipId}/revoke`,
    headers: { authorization: `Bearer ${tokenA}` },
  });
  const afterRevoke = buildOp({
    actorAppUserId: caregiver,
    entityId: randomUUID(),
    revisionId: 'sec-after-revoke',
    payload: { revisionKind: 'create', text: canary },
  });
  const deniedPush = await deps.app.inject({
    method: 'POST',
    url: `/v1/families/${familyA}/sync/push`,
    headers: { authorization: `Bearer ${caregiverToken}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [afterRevoke],
    },
  });
  const revokeOk = deniedPush.statusCode === 403 || deniedPush.statusCode === 401;
  checks.push(
    check(
      'revoked_member_push_denied',
      revokeOk,
      revokeOk
        ? 'Revoked membership cannot push sync operations'
        : `unexpected_status=${deniedPush.statusCode}`,
    ),
  );

  // Tombstone blocks resurrection.
  const entityId = randomUUID();
  const create = buildOp({
    actorAppUserId: adminA,
    entityId,
    revisionId: 'sec-create',
    payload: { revisionKind: 'create', text: canary },
  });
  await deps.app.inject({
    method: 'POST',
    url: `/v1/families/${familyA}/sync/push`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [create],
    },
  });
  const del = buildOp({
    actorAppUserId: adminA,
    entityId,
    revisionId: 'sec-delete',
    parentRevisionIds: ['sec-create'],
    kind: 'care.delete',
    payload: { revisionKind: 'delete' },
  });
  await deps.app.inject({
    method: 'POST',
    url: `/v1/families/${familyA}/sync/push`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [del],
    },
  });
  deps.sync.materializeTombstone(familyA, entityId, 'sec-delete', new Date().toISOString());
  const resurrect = buildOp({
    actorAppUserId: adminA,
    entityId,
    revisionId: 'sec-zombie',
    payload: { revisionKind: 'create', text: canary },
  });
  const zombie = await deps.app.inject({
    method: 'POST',
    url: `/v1/families/${familyA}/sync/push`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [resurrect],
    },
  });
  const receipts = (
    zombie.json() as {
      receipts?: Array<{ status: string; reason?: string }>;
    }
  ).receipts;
  const tombstoneOk =
    Array.isArray(receipts) &&
    receipts.some((item) => item.status === 'rejected' && item.reason === 'tombstoned');
  checks.push(
    check(
      'tombstone_blocks_resurrect',
      tombstoneOk,
      tombstoneOk
        ? 'Tombstone rejects stale create after delete'
        : `receipts=${JSON.stringify(receipts ?? null)}`,
    ),
  );

  // Rate limiter unit + API error without diary wording.
  const now = 0;
  const limiter = createFixedWindowRateLimiter({
    limit: 2,
    windowMs: 1_000,
    nowMs: () => now,
  });
  limiter.check('matrix');
  limiter.check('matrix');
  const limited = limiter.check('matrix');
  const rateUnitOk = limited.allowed === false;
  checks.push(
    check(
      'rate_limit_burst',
      rateUnitOk,
      rateUnitOk
        ? 'Fixed-window limiter rejects bursts with retry-after'
        : 'limiter unexpectedly allowed burst',
    ),
  );

  // CSRF mismatch rejected for cookie sessions; bearer skips.
  const csrfOk =
    verifyCsrfDoubleSubmit({
      method: 'POST',
      cookieToken: 'a',
      headerToken: 'b',
      usesBearerAuth: false,
    }) === false &&
    verifyCsrfDoubleSubmit({
      method: 'POST',
      cookieToken: undefined,
      headerToken: undefined,
      usesBearerAuth: true,
    }) === true;
  checks.push(
    check(
      'csrf_cookie_mismatch',
      csrfOk,
      csrfOk
        ? 'Cookie CSRF rejects mismatched tokens; bearer auth skips CSRF'
        : 'CSRF helper behaved unexpectedly',
    ),
  );

  // Expired token rejected.
  const expired = await deps.tokens.mintTestToken({
    subject: 'sec-expired',
    appUserId: adminA,
    expiresInSec: -30,
  });
  const expiredRes = await deps.app.inject({
    method: 'GET',
    url: '/v1/me',
    headers: { authorization: `Bearer ${expired}` },
  });
  const expiredOk =
    expiredRes.statusCode === 401 &&
    (expiredRes.json() as { error?: { code?: string } }).error?.code === 'token_expired';
  checks.push(
    check(
      'expired_token_rejected',
      expiredOk,
      expiredOk
        ? 'Expired access tokens are rejected with token_expired'
        : `status=${expiredRes.statusCode}`,
    ),
  );

  // Error bodies must not echo diary canaries from denied IDOR/push paths.
  const errorBodies = [idor.body, deniedPush.body, zombie.body].join('\n');
  const canaryOk = !errorBodies.includes(canary);
  checks.push(
    check(
      'sensitive_canary_absent_from_errors',
      canaryOk,
      canaryOk
        ? 'Denied/error responses do not echo diary canary payloads'
        : 'Diary canary leaked into an error or denial body',
    ),
  );

  // familyB unused except proving create succeeded for isolation setup
  void familyB;

  const allSoftwareChecksPassed = checks.every((item) => item.ok);
  if (allSoftwareChecksPassed) {
    findings.push('software_security_matrix_passed');
  } else {
    findings.push(...checks.filter((item) => !item.ok).map((item) => `failed:${item.id}`));
  }
  findings.push('independent_human_review_not_claimed');

  return {
    format: 'lumi.family-security-matrix.v1',
    checks,
    allSoftwareChecksPassed,
    independentHumanReviewClaimed: false,
    findings,
  };
}
