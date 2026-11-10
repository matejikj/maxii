import { createHash, randomUUID } from 'node:crypto';
import {
  FAMILY_ATTACHMENT_QUOTA,
  LUMI_API_PROTOCOL_VERSION,
  type AppUserId,
  type FamilyId,
  type SyncChangelogEntry,
} from '@lumi/contracts';
import { loadApiConfig } from '../config/env.ts';
import { createAppDbPool } from '../db/pool.ts';
import { createFamilyApi, type CreatedApi } from '../http/createServer.ts';
import { hashSyncPayload } from '../sync/syncStore.ts';
import { ensureAttachmentQuotaMigration } from './ensureAttachmentQuotaMigration.ts';
import { LOCAL_ATTACHMENT_POSTGRES_METADATA_DRILL_DEFAULTS } from './attachmentPostgresMetadataDrill.ts';
import { LOCAL_S3_COMPATIBLE_ATTACHMENT_DRILL_DEFAULTS } from './attachmentS3CompatibleDrill.ts';
import { createPostgresAttachmentMetadataStoreFromUrl } from './postgresAttachmentMetadataStore.ts';
import { createPostgresFamilyAttachmentQuotaLedger } from './postgresQuotaLedger.ts';
import { resolveAttachmentObjectStore } from './resolveAttachmentObjectStore.ts';
import { seedFamilyAttachmentTenant } from './seedFamilyAttachmentTenant.ts';

export type AttachmentAcceptanceDrillCase = {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type AttachmentAcceptanceDrillResult = {
  readonly ok: boolean;
  /** Software acceptance on local Compose only. */
  readonly softwareReady: boolean;
  /** Local Compose never claims live readiness. */
  readonly liveReady: false;
  /** S3Mock is not Cloudflare R2. */
  readonly cloudflareR2Ready: false;
  readonly cases: readonly AttachmentAcceptanceDrillCase[];
};

/** Tiny pending-reservation budget so a handful of parallel intents must conflict. */
const PENDING_BUDGET_BYTES = 20;
const INTENT_BYTES = 8;

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function jpegBytes(marker: number): Uint8Array {
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xd9, 34, 2, marker & 0xff, (marker >> 8) & 0xff]);
}

/**
 * Compose acceptance for 34.2 software: durable Postgres quota under parallel
 * HTTP intents, expired-intent GC, membership revoke before finalize, IDOR,
 * and finalize → sync changelog fan-out. Uses PG + S3Mock only; never claims
 * liveReady or cloudflareR2Ready.
 */
export async function runAttachmentAcceptanceDrill(input: {
  readonly databaseUrl: string;
  readonly adminDatabaseUrl: string;
  readonly endpoint: string;
  readonly region?: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}): Promise<AttachmentAcceptanceDrillResult> {
  const cases: AttachmentAcceptanceDrillCase[] = [];
  const finish = (): AttachmentAcceptanceDrillResult => {
    const ok = cases.every((row) => row.ok);
    return {
      ok,
      softwareReady: ok,
      liveReady: false,
      cloudflareR2Ready: false,
      cases,
    };
  };

  const personal = resolveAttachmentObjectStore(
    loadApiConfig({
      LUMI_TEST_HS256_SECRET: 'acceptance-personal-cold',
    } as NodeJS.ProcessEnv),
  );
  cases.push({
    name: 'personal_cold_memory_default',
    ok: personal.provider === 'memory',
    detail:
      personal.provider === 'memory'
        ? 'unset attachment store stays memory for personal boots'
        : `expected memory, got ${personal.provider}`,
  });

  await ensureAttachmentQuotaMigration(input.adminDatabaseUrl);
  const quotaPool = createAppDbPool(input.databaseUrl);
  const verifyPool = createAppDbPool(input.databaseUrl);
  const quota = createPostgresFamilyAttachmentQuotaLedger(quotaPool, {
    pendingReservationBudgetBytes: PENDING_BUDGET_BYTES,
  });
  // Separate pool + ledger instance: proves usage is read back from Postgres.
  const verifyQuota = createPostgresFamilyAttachmentQuotaLedger(verifyPool, {
    pendingReservationBudgetBytes: PENDING_BUDGET_BYTES,
  });
  const metadata = createPostgresAttachmentMetadataStoreFromUrl(input.databaseUrl);

  const env = {
    LUMI_TEST_HS256_SECRET: 'local-acceptance-hs256',
    LUMI_OIDC_ISSUER: 'http://test.invalid/realms/lumi',
    LUMI_ATTACHMENT_STORE: 'r2',
    LUMI_R2_ENDPOINT: input.endpoint,
    LUMI_R2_REGION: input.region ?? 'us-east-1',
    LUMI_R2_BUCKET: input.bucket,
    LUMI_R2_ACCESS_KEY_ID: input.accessKeyId,
    LUMI_R2_SECRET_ACCESS_KEY: input.secretAccessKey,
  } as NodeJS.ProcessEnv;
  const api = await createFamilyApi(loadApiConfig(env), {
    attachmentMetadata: metadata,
    attachmentMetadataProvider: 'postgres',
    quota,
  });

  try {
    const wired =
      api.attachmentObjectProvider === 'r2' && api.attachmentMetadataProvider === 'postgres';
    cases.push({
      name: 'api_wired_postgres_quota_and_metadata',
      ok: wired,
      detail: wired
        ? 'createFamilyApi uses S3Mock store + Postgres metadata + Postgres quota'
        : `object=${api.attachmentObjectProvider} metadata=${api.attachmentMetadataProvider}`,
    });
    if (!wired) return finish();

    await runCases({ input, api, quota, verifyQuota, metadata, cases });
  } catch (error) {
    cases.push({
      name: 'acceptance_drill_threw',
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await api.app.close();
    await quotaPool.end();
    await verifyPool.end();
  }

  cases.push({
    name: 'live_flags_stay_false',
    ok: true,
    detail: 'softwareReady is Compose-only; liveReady=false cloudflareR2Ready=false',
  });
  return finish();
}

type DrillContext = {
  readonly input: Parameters<typeof runAttachmentAcceptanceDrill>[0];
  readonly api: CreatedApi;
  readonly quota: ReturnType<typeof createPostgresFamilyAttachmentQuotaLedger>;
  readonly verifyQuota: ReturnType<typeof createPostgresFamilyAttachmentQuotaLedger>;
  readonly metadata: ReturnType<typeof createPostgresAttachmentMetadataStoreFromUrl>;
  readonly cases: AttachmentAcceptanceDrillCase[];
};

type Principal = { readonly appUserId: AppUserId; readonly token: string };

async function runCases(ctx: DrillContext): Promise<void> {
  const { api, cases } = ctx;
  const auth = (principal: Principal) => ({ authorization: `Bearer ${principal.token}` });

  async function newPrincipal(label: string): Promise<Principal> {
    const appUserId = randomUUID() as AppUserId;
    const token = await api.tokens.mintTestToken({
      subject: `acceptance-${label}-${appUserId}`,
      appUserId,
    });
    return { appUserId, token };
  }

  async function createFamily(admin: Principal, label: string): Promise<FamilyId> {
    const created = await api.app.inject({
      method: 'POST',
      url: '/v1/families',
      headers: auth(admin),
      payload: {
        protocolVersion: LUMI_API_PROTOCOL_VERSION,
        idempotencyKey: `fam-acceptance-${label}-${admin.appUserId}`,
        displayName: `Acceptance ${label}`,
      },
    });
    if (created.statusCode !== 201) throw new Error(`create family ${label}: ${created.statusCode}`);
    const familyId = created.json().familyId as FamilyId;
    await seedFamilyAttachmentTenant({
      adminDatabaseUrl: ctx.input.adminDatabaseUrl,
      appUserId: admin.appUserId,
      familyId,
      role: 'admin',
      displayName: `Acceptance ${label}`,
    });
    return familyId;
  }

  async function addCaregiver(
    admin: Principal,
    familyId: FamilyId,
    label: string,
  ): Promise<Principal & { readonly membershipId: string }> {
    const invite = await api.app.inject({
      method: 'POST',
      url: `/v1/families/${familyId}/invitations`,
      headers: auth(admin),
      payload: {
        protocolVersion: LUMI_API_PROTOCOL_VERSION,
        idempotencyKey: `invite-acceptance-${label}-${familyId}`,
        role: 'caregiver',
      },
    });
    if (invite.statusCode !== 201) throw new Error(`invite ${label}: ${invite.statusCode}`);
    const caregiver = await newPrincipal(`${label}-caregiver`);
    const accepted = await api.app.inject({
      method: 'POST',
      url: '/v1/invitations/accept',
      headers: auth(caregiver),
      payload: {
        protocolVersion: LUMI_API_PROTOCOL_VERSION,
        idempotencyKey: `accept-acceptance-${label}-${caregiver.appUserId}`,
        oneTimeToken: invite.json().oneTimeToken,
        childLinkDecision: 'defer',
      },
    });
    if (accepted.statusCode !== 200 && accepted.statusCode !== 201) {
      throw new Error(`accept ${label}: ${accepted.statusCode}`);
    }
    await seedFamilyAttachmentTenant({
      adminDatabaseUrl: ctx.input.adminDatabaseUrl,
      appUserId: caregiver.appUserId,
      familyId,
      role: 'caregiver',
      displayName: `Acceptance ${label}`,
    });
    return { ...caregiver, membershipId: accepted.json().membershipId as string };
  }

  function intentPayload(attachmentId: string, bytes: Uint8Array, key: string) {
    return {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: key,
      attachmentId,
      childId: 'child_acceptance',
      eventId: 'note_acceptance',
      role: 'display',
      expectedBytes: bytes.byteLength,
      expectedSha256: sha256Hex(bytes),
      contentType: 'image/jpeg',
    };
  }

  async function createIntent(
    who: Principal,
    familyId: FamilyId,
    attachmentId: string,
    bytes: Uint8Array,
    key = `up-${attachmentId}`,
  ) {
    return api.app.inject({
      method: 'POST',
      url: `/v1/families/${familyId}/attachments/intents`,
      headers: auth(who),
      payload: intentPayload(attachmentId, bytes, key),
    });
  }

  function upload(who: Principal, familyId: FamilyId, intentId: string, bytes: Uint8Array) {
    return api.app.inject({
      method: 'PUT',
      url: `/v1/families/${familyId}/attachments/intents/${intentId}`,
      headers: { ...auth(who), 'content-type': 'application/octet-stream' },
      payload: Buffer.from(bytes),
    });
  }

  function finalize(who: Principal, familyId: FamilyId, intentId: string, bytes: Uint8Array) {
    return api.app.inject({
      method: 'POST',
      url: `/v1/families/${familyId}/attachments/intents/${intentId}/finalize`,
      headers: auth(who),
      payload: {
        protocolVersion: LUMI_API_PROTOCOL_VERSION,
        intentId,
        sha256: sha256Hex(bytes),
        byteLength: bytes.byteLength,
      },
    });
  }

  function read(who: Principal, familyId: FamilyId, attachmentId: string) {
    return api.app.inject({
      method: 'GET',
      url: `/v1/families/${familyId}/attachments/${attachmentId}/display`,
      headers: auth(who),
    });
  }

  async function pull(who: Principal, familyId: FamilyId): Promise<SyncChangelogEntry[]> {
    const response = await api.app.inject({
      method: 'GET',
      url: `/v1/families/${familyId}/sync/pull?limit=100`,
      headers: auth(who),
    });
    if (response.statusCode !== 200) throw new Error(`pull: ${response.statusCode}`);
    return response.json().entries as SyncChangelogEntry[];
  }

  const afterIntentTtl = () => Date.now() + FAMILY_ATTACHMENT_QUOTA.intentTtlMs + 1_000;

  // 2. Concurrent HTTP intents against a 20-byte pending budget (8 bytes each).
  {
    const admin = await newPrincipal('quota-admin');
    const familyId = await createFamily(admin, 'quota');
    const attempts = 6;
    const responses = await Promise.all(
      Array.from({ length: attempts }, (_, index) =>
        createIntent(admin, familyId, randomUUID(), jpegBytes(index + 1), `par-${index}-${familyId}`),
      ),
    );
    const accepted = responses.filter((row) => row.statusCode === 201).length;
    const conflicts = responses.filter((row) => row.statusCode === 409).length;
    const maxFit = Math.floor(PENDING_BUDGET_BYTES / INTENT_BYTES);
    const view = await ctx.verifyQuota.view(familyId);
    const ok =
      accepted === maxFit &&
      conflicts === attempts - maxFit &&
      view.reservedBytes === accepted * INTENT_BYTES &&
      view.reservedBytes <= PENDING_BUDGET_BYTES;
    cases.push({
      name: 'concurrent_quota_http',
      ok,
      detail: ok
        ? `${accepted}/${attempts} intents reserved ${view.reservedBytes}B in Postgres; ${conflicts} conflicted (no double-spend)`
        : `accepted=${accepted} conflicts=${conflicts} reserved=${view.reservedBytes}`,
    });

    // 3. Expired-intent GC releases those reservations in Postgres.
    const reservedBefore = (await ctx.verifyQuota.view(familyId)).reservedBytes;
    const firstIntentId = responses.find((row) => row.statusCode === 201)?.json().intentId as
      | string
      | undefined;
    const cleaned = await api.attachments.cleanupExpiredIntents(afterIntentTtl());
    const reservedAfter = (await ctx.verifyQuota.view(familyId)).reservedBytes;
    const stale = firstIntentId
      ? await upload(admin, familyId, firstIntentId, jpegBytes(1))
      : null;
    const gcOk =
      cleaned >= maxFit &&
      reservedBefore > 0 &&
      reservedAfter === 0 &&
      stale?.statusCode === 404;
    cases.push({
      name: 'expired_intent_gc',
      ok: gcOk,
      detail: gcOk
        ? `GC cleaned ${cleaned} intents; reserved ${reservedBefore}B -> 0B; stale upload 404`
        : `cleaned=${cleaned} before=${reservedBefore} after=${reservedAfter} stale=${stale?.statusCode}`,
    });
  }

  // 4. Revoke membership between upload and finalize.
  {
    const admin = await newPrincipal('revoke-admin');
    const familyId = await createFamily(admin, 'revoke');
    const caregiver = await addCaregiver(admin, familyId, 'revoke');
    const attachmentId = randomUUID();
    const bytes = jpegBytes(900);
    const intent = await createIntent(caregiver, familyId, attachmentId, bytes);
    const intentId = intent.json().intentId as string;
    const uploaded = await upload(caregiver, familyId, intentId, bytes);
    const revoked = api.store.revokeMembership(
      admin.appUserId,
      familyId,
      caregiver.membershipId as never,
    );
    const finalized = await finalize(caregiver, familyId, intentId, bytes);
    const caregiverRead = await read(caregiver, familyId, attachmentId);
    const adminRead = await read(admin, familyId, attachmentId);
    const locator = await ctx.metadata.getObject({
      appUserId: admin.appUserId,
      familyId,
      attachmentId,
      role: 'display',
    });
    const entries = await pull(admin, familyId);
    const emitted = entries.some((row) => row.entityId === attachmentId);
    const reservedHeld = (await ctx.verifyQuota.view(familyId)).reservedBytes;
    await api.attachments.cleanupExpiredIntents(afterIntentTtl());
    const reservedAfterGc = (await ctx.verifyQuota.view(familyId)).reservedBytes;
    const ok =
      intent.statusCode === 201 &&
      uploaded.statusCode === 200 &&
      revoked.revoked &&
      finalized.statusCode === 403 &&
      caregiverRead.statusCode === 403 &&
      adminRead.statusCode === 404 &&
      locator == null &&
      !emitted &&
      reservedHeld === INTENT_BYTES &&
      reservedAfterGc === 0;
    cases.push({
      name: 'revoke_before_finalize',
      ok,
      detail: ok
        ? 'revoked caregiver finalize 403; nothing activated, no sync entry; GC returned reservation'
        : `intent=${intent.statusCode} upload=${uploaded.statusCode} revoked=${revoked.revoked} finalize=${finalized.statusCode} cgRead=${caregiverRead.statusCode} adminRead=${adminRead.statusCode} locator=${locator != null} emitted=${emitted} held=${reservedHeld} afterGc=${reservedAfterGc}`,
    });
  }

  // 5 + 6 + metadata fan-out: happy path, IDOR, and sync changelog.
  {
    const admin = await newPrincipal('happy-admin');
    const familyId = await createFamily(admin, 'happy');
    const caregiver = await addCaregiver(admin, familyId, 'happy');
    const attachmentId = randomUUID();
    const bytes = jpegBytes(1700);
    const digest = sha256Hex(bytes);
    const intent = await createIntent(admin, familyId, attachmentId, bytes);
    const intentId = intent.json().intentId as string;
    const uploaded = await upload(admin, familyId, intentId, bytes);
    const finalized = await finalize(admin, familyId, intentId, bytes);
    const finalizeOk = finalized.statusCode === 200 && finalized.json().activated === true;
    const usedView = await ctx.verifyQuota.view(familyId);
    cases.push({
      name: 'durable_quota_commit_after_finalize',
      ok:
        intent.statusCode === 201 &&
        uploaded.statusCode === 200 &&
        finalizeOk &&
        usedView.usedBytes === INTENT_BYTES &&
        usedView.reservedBytes === 0,
      detail: `finalize=${finalized.statusCode} used=${usedView.usedBytes} reserved=${usedView.reservedBytes}`,
    });

    const stranger = await newPrincipal('stranger');
    const strangerFamily = await createFamily(stranger, 'stranger');
    const stolenRead = await read(stranger, familyId, attachmentId);
    const stolenIntent = await createIntent(stranger, familyId, randomUUID(), bytes, `steal-${attachmentId}`);
    const idorOk = stolenRead.statusCode === 403 && stolenIntent.statusCode === 403 && Boolean(strangerFamily);
    cases.push({
      name: 'cross_family_idor_denied',
      ok: idorOk,
      detail: idorOk
        ? 'foreign membership cannot read or upload into another family'
        : `read=${stolenRead.statusCode} intent=${stolenIntent.statusCode}`,
    });

    const adminEntries = await pull(admin, familyId);
    const activation = adminEntries.find(
      (row) => row.kind === 'attachment.upsert' && row.entityId === attachmentId,
    );
    const renditions = (activation?.payload.renditions ?? []) as readonly {
      role?: string;
      sha256?: string;
      byteLength?: number;
    }[];
    const emitOk =
      activation != null &&
      activation.payload.attachmentId === attachmentId &&
      activation.payload.source === 'server_activation' &&
      renditions[0]?.role === 'display' &&
      renditions[0]?.sha256 === digest &&
      renditions[0]?.byteLength === bytes.byteLength &&
      !JSON.stringify(activation.payload).includes('fam/');
    cases.push({
      name: 'finalize_emits_sync_attachment_upsert',
      ok: emitOk,
      detail: emitOk
        ? `changelogSeq=${activation.changelogSeq} attachment.upsert carries digest, no object key`
        : `entries=${adminEntries.map((row) => `${row.kind}:${row.entityId}`).join(',') || 'none'}`,
    });

    // Uploader's outbox revision (what the baby-tracker enqueues after upload).
    const clientPayload = {
      attachmentId,
      childId: 'child_acceptance',
      eventId: 'note_acceptance',
      hostEventType: 'note',
      orderIndex: 0,
      caption: null,
      deletedAt: null,
      eraseGeneration: null,
      renditions: [
        {
          renditionId: `ren_${attachmentId}`,
          role: 'display',
          mime: 'image/jpeg',
          width: 8,
          height: 8,
          byteLength: bytes.byteLength,
          sha256: digest,
          normalizationVersion: 'v1',
        },
      ],
    };
    const operationId = `op-acceptance-${attachmentId}`;
    const push = await api.app.inject({
      method: 'POST',
      url: `/v1/families/${familyId}/sync/push`,
      headers: auth(admin),
      payload: {
        protocolVersion: LUMI_API_PROTOCOL_VERSION,
        attemptId: randomUUID(),
        operations: [
          {
            schemaVersion: LUMI_API_PROTOCOL_VERSION,
            operationId,
            deviceId: 'acceptance-phone-a',
            actorAppUserId: admin.appUserId,
            kind: 'attachment.upsert',
            entityId: attachmentId,
            revisionId: `rev-${operationId}`,
            parentRevisionIds: [],
            payloadHash: hashSyncPayload(clientPayload),
            payload: clientPayload,
          },
        ],
      },
    });
    const receiptStatus = push.statusCode === 200 ? push.json().receipts?.[0]?.status : null;
    const peerEntries = await pull(caregiver, familyId);
    const forAttachment = peerEntries.filter(
      (row) => row.kind === 'attachment.upsert' && row.entityId === attachmentId,
    );
    const hasServer = forAttachment.some((row) => row.payload.source === 'server_activation');
    const hasClient = forAttachment.some((row) => row.payload.hostEventType === 'note');
    const fanOutOk = receiptStatus === 'accepted' && hasServer && hasClient;
    cases.push({
      name: 'metadata_sync_fanout_round_trip',
      ok: fanOutOk,
      detail: fanOutOk
        ? 'peer caregiver pulled server activation + uploader outbox attachment.upsert'
        : `push=${push.statusCode}/${receiptStatus} server=${hasServer} client=${hasClient}`,
    });

    // Peer can download the activated bytes through the authenticated API.
    const peerRead = await read(caregiver, familyId, attachmentId);
    const peerDigest =
      peerRead.statusCode === 200
        ? createHash('sha256').update(peerRead.rawPayload).digest('hex')
        : null;
    cases.push({
      name: 'peer_read_matches_digest',
      ok: peerDigest === digest,
      detail: peerDigest === digest ? 'peer download matches activated digest' : `status ${peerRead.statusCode}`,
    });
  }
}

/** Defaults match Compose PG + S3Mock — never used by personal cold boots. */
export const LOCAL_ATTACHMENT_ACCEPTANCE_DRILL_DEFAULTS = {
  ...LOCAL_ATTACHMENT_POSTGRES_METADATA_DRILL_DEFAULTS,
  ...LOCAL_S3_COMPATIBLE_ATTACHMENT_DRILL_DEFAULTS,
} as const;
