import { createHash, randomUUID } from 'node:crypto';
import { LUMI_API_PROTOCOL_VERSION, type AppUserId, type FamilyId } from '@lumi/contracts';
import { loadApiConfig } from '../config/env.ts';
import { createFamilyApi } from '../http/createServer.ts';
import { createAppDbPool } from '../db/pool.ts';
import { createPostgresAttachmentMetadataStoreFromUrl } from './postgresAttachmentMetadataStore.ts';
import { createPostgresFamilyAttachmentQuotaLedger } from './postgresQuotaLedger.ts';
import { ensureAttachmentQuotaMigration } from './ensureAttachmentQuotaMigration.ts';
import type { FamilyAttachmentQuotaPort } from './quotaLedger.ts';
import { resolveAttachmentObjectStore } from './resolveAttachmentObjectStore.ts';
import { LOCAL_S3_COMPATIBLE_ATTACHMENT_DRILL_DEFAULTS } from './attachmentS3CompatibleDrill.ts';
import { LOCAL_ATTACHMENT_POSTGRES_METADATA_DRILL_DEFAULTS } from './attachmentPostgresMetadataDrill.ts';
import { seedFamilyAttachmentTenant } from './seedFamilyAttachmentTenant.ts';

export type AttachmentHttpPostgresMetadataDrillCase = {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type AttachmentHttpPostgresMetadataDrillResult = {
  readonly ok: boolean;
  readonly personalColdUnaffected: true;
  readonly cloudflareR2Ready: false;
  readonly cases: readonly AttachmentHttpPostgresMetadataDrillCase[];
};

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * HTTP attachment path with durable Postgres locators. A second API boot must
 * still read via metadata RLS — proving the locator is not only in-process.
 */
export async function runAttachmentHttpPostgresMetadataDrill(input: {
  readonly databaseUrl: string;
  readonly adminDatabaseUrl: string;
  readonly endpoint: string;
  readonly region?: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}): Promise<AttachmentHttpPostgresMetadataDrillResult> {
  await ensureAttachmentQuotaMigration(input.adminDatabaseUrl);
  const quotaPool = createAppDbPool(input.databaseUrl);
  try {
    return await runWithQuota(input, createPostgresFamilyAttachmentQuotaLedger(quotaPool));
  } finally {
    await quotaPool.end();
  }
}

async function runWithQuota(
  input: Parameters<typeof runAttachmentHttpPostgresMetadataDrill>[0],
  quota: FamilyAttachmentQuotaPort,
): Promise<AttachmentHttpPostgresMetadataDrillResult> {
  const cases: AttachmentHttpPostgresMetadataDrillCase[] = [];

  const personal = resolveAttachmentObjectStore(
    loadApiConfig({
      LUMI_TEST_HS256_SECRET: 'http-pg-meta-personal-cold',
    } as NodeJS.ProcessEnv),
  );
  cases.push({
    name: 'personal_cold_memory_default',
    ok: personal.provider === 'memory',
    detail:
      personal.provider === 'memory'
        ? 'personal boots still default to memory object store'
        : `expected memory, got ${personal.provider}`,
  });

  const env = {
    LUMI_TEST_HS256_SECRET: 'local-http-pg-meta-hs256',
    LUMI_OIDC_ISSUER: 'http://test.invalid/realms/lumi',
    LUMI_ATTACHMENT_STORE: 'r2',
    LUMI_R2_ENDPOINT: input.endpoint,
    LUMI_R2_REGION: input.region ?? 'us-east-1',
    LUMI_R2_BUCKET: input.bucket,
    LUMI_R2_ACCESS_KEY_ID: input.accessKeyId,
    LUMI_R2_SECRET_ACCESS_KEY: input.secretAccessKey,
  } as NodeJS.ProcessEnv;

  const metadata = createPostgresAttachmentMetadataStoreFromUrl(input.databaseUrl);
  const first = await createFamilyApi(loadApiConfig(env), {
    attachmentMetadata: metadata,
    attachmentMetadataProvider: 'postgres',
    quota,
  });
  cases.push({
    name: 'api_wired_postgres_metadata',
    ok: first.attachmentMetadataProvider === 'postgres',
    detail:
      first.attachmentMetadataProvider === 'postgres'
        ? 'createFamilyApi received Postgres metadata store'
        : `wired ${first.attachmentMetadataProvider}`,
  });

  const adminId = randomUUID() as AppUserId;
  let familyId: FamilyId;
  let attachmentId: string;
  let digest: string;
  const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9, 55, 4, 12]);

  try {
    const token = await first.tokens.mintTestToken({
      subject: `http-pg-${adminId}`,
      appUserId: adminId,
    });
    const created = await first.app.inject({
      method: 'POST',
      url: '/v1/families',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        protocolVersion: LUMI_API_PROTOCOL_VERSION,
        idempotencyKey: `fam-http-pg-${adminId}`,
        displayName: 'HTTP Postgres metadata family',
      },
    });
    const familyOk = created.statusCode === 201;
    cases.push({
      name: 'create_family',
      ok: familyOk,
      detail: familyOk ? 'family created in API store' : `status ${created.statusCode}`,
    });
    if (!familyOk) {
      return {
        ok: false,
        personalColdUnaffected: true,
        cloudflareR2Ready: false,
        cases,
      };
    }
    familyId = created.json().familyId as FamilyId;

    await seedFamilyAttachmentTenant({
      adminDatabaseUrl: input.adminDatabaseUrl,
      appUserId: adminId,
      familyId,
      role: 'admin',
      displayName: 'HTTP Postgres metadata family',
    });
    cases.push({
      name: 'seed_postgres_membership',
      ok: true,
      detail: 'API principal mirrored into Postgres membership for RLS',
    });

    digest = sha256Hex(bytes);
    attachmentId = randomUUID();
    const intent = await first.app.inject({
      method: 'POST',
      url: `/v1/families/${familyId}/attachments/intents`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        protocolVersion: LUMI_API_PROTOCOL_VERSION,
        idempotencyKey: `up-http-pg-${attachmentId}`,
        attachmentId,
        childId: 'child_pg',
        eventId: 'note_pg',
        role: 'display',
        expectedBytes: bytes.byteLength,
        expectedSha256: digest,
        contentType: 'image/jpeg',
      },
    });
    if (intent.statusCode !== 201) {
      cases.push({
        name: 'create_intent',
        ok: false,
        detail: `status ${intent.statusCode}`,
      });
      return {
        ok: false,
        personalColdUnaffected: true,
        cloudflareR2Ready: false,
        cases,
      };
    }
    const intentId = intent.json().intentId as string;
    cases.push({ name: 'create_intent', ok: true, detail: 'intent reserved' });

    const uploaded = await first.app.inject({
      method: 'PUT',
      url: `/v1/families/${familyId}/attachments/intents/${intentId}`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/octet-stream',
      },
      payload: Buffer.from(bytes),
    });
    cases.push({
      name: 'upload_bytes',
      ok: uploaded.statusCode === 200,
      detail:
        uploaded.statusCode === 200 ? 'staging upload accepted' : `status ${uploaded.statusCode}`,
    });

    const finalized = await first.app.inject({
      method: 'POST',
      url: `/v1/families/${familyId}/attachments/intents/${intentId}/finalize`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        protocolVersion: LUMI_API_PROTOCOL_VERSION,
        intentId,
        sha256: digest,
        byteLength: bytes.byteLength,
      },
    });
    const finalizeOk = finalized.statusCode === 200 && finalized.json().activated === true;
    cases.push({
      name: 'finalize_persists_metadata',
      ok: finalizeOk,
      detail: finalizeOk ? 'activated blob + Postgres locator' : `status ${finalized.statusCode}`,
    });

    const durable = await metadata.getObject({
      appUserId: adminId,
      familyId,
      attachmentId,
      role: 'display',
    });
    cases.push({
      name: 'postgres_locator_present',
      ok: durable?.sha256 === digest && durable.byteLength === bytes.byteLength,
      detail: durable
        ? 'family_attachment_object holds digest + length'
        : 'locator row missing after finalize',
    });
  } finally {
    await first.app.close();
  }

  if (!familyId || !attachmentId || !digest) {
    return {
      ok: false,
      personalColdUnaffected: true,
      cloudflareR2Ready: false,
      cases,
    };
  }

  // Fresh process map: locator must come from Postgres, bytes from S3Mock.
  const second = await createFamilyApi(loadApiConfig(env), {
    attachmentMetadata: createPostgresAttachmentMetadataStoreFromUrl(input.databaseUrl),
    attachmentMetadataProvider: 'postgres',
    quota,
  });
  try {
    const token = await second.tokens.mintTestToken({
      subject: `http-pg-reboot-${adminId}`,
      appUserId: adminId,
    });
    // New API process has an empty identity map; restore the same membership so
    // HTTP auth matches the durable Postgres locator row.
    second.store.ensureUser(adminId, new Date().toISOString());
    second.store.families.set(familyId, {
      familyId,
      displayName: 'HTTP Postgres metadata family',
      createdAt: new Date().toISOString(),
      createdBy: adminId,
      erasedAt: null,
    });
    second.store.memberships.push({
      membershipId: randomUUID() as never,
      familyId,
      appUserId: adminId,
      role: 'admin',
      status: 'active',
      joinedAt: new Date().toISOString(),
    });

    const read = await second.app.inject({
      method: 'GET',
      url: `/v1/families/${familyId}/attachments/${attachmentId}/display`,
      headers: { authorization: `Bearer ${token}` },
    });
    const readDigest =
      read.statusCode === 200 ? createHash('sha256').update(read.rawPayload).digest('hex') : null;
    const readOk =
      read.statusCode === 200 &&
      read.headers['cache-control'] === 'private, no-store' &&
      readDigest === digest;
    cases.push({
      name: 'read_after_api_reboot_via_postgres',
      ok: readOk,
      detail: readOk
        ? 'second boot resolved locator from Postgres metadata'
        : `status ${read.statusCode}`,
    });

    const erased = await second.app.inject({
      method: 'POST',
      url: `/v1/families/${familyId}/attachments/${attachmentId}/tombstone`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        protocolVersion: LUMI_API_PROTOCOL_VERSION,
        eraseGeneration: 1,
      },
    });
    const header = await createPostgresAttachmentMetadataStoreFromUrl(
      input.databaseUrl,
    ).getAttachment({
      appUserId: adminId,
      familyId,
      attachmentId,
    });
    const after = await second.app.inject({
      method: 'GET',
      url: `/v1/families/${familyId}/attachments/${attachmentId}/display`,
      headers: { authorization: `Bearer ${token}` },
    });
    const tombOk =
      erased.statusCode === 200 && after.statusCode === 404 && header?.eraseGeneration === 1;
    cases.push({
      name: 'tombstone_writes_erase_generation',
      ok: tombOk,
      detail: tombOk
        ? 'Postgres erase generation blocks reads'
        : `erase=${erased.statusCode} after=${after.statusCode} gen=${header?.eraseGeneration ?? 'null'}`,
    });
  } finally {
    await second.app.close();
  }

  return {
    ok: cases.every((row) => row.ok),
    personalColdUnaffected: true,
    cloudflareR2Ready: false,
    cases,
  };
}

export const LOCAL_HTTP_POSTGRES_METADATA_DRILL_DEFAULTS = {
  ...LOCAL_ATTACHMENT_POSTGRES_METADATA_DRILL_DEFAULTS,
  ...LOCAL_S3_COMPATIBLE_ATTACHMENT_DRILL_DEFAULTS,
} as const;
