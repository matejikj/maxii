import { createHash, randomUUID } from 'node:crypto';
import {
  LUMI_API_PROTOCOL_VERSION,
  type AppUserId,
  type FamilyId,
} from '@lumi/contracts';
import { loadApiConfig } from '../config/env.ts';
import { createFamilyApi } from '../http/createServer.ts';
import { resolveAttachmentObjectStore } from './resolveAttachmentObjectStore.ts';
import { LOCAL_S3_COMPATIBLE_ATTACHMENT_DRILL_DEFAULTS } from './attachmentS3CompatibleDrill.ts';

export type AttachmentHttpS3CompatibleDrillCase = {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type AttachmentHttpS3CompatibleDrillResult = {
  readonly ok: boolean;
  readonly provider: 'memory' | 'r2';
  readonly endpoint: string;
  readonly cases: readonly AttachmentHttpS3CompatibleDrillCase[];
};

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Boots the family API against a real S3-compatible object store and exercises
 * the authenticated HTTP attachment path. Default personal boots stay on memory;
 * this drill needs explicit store credentials (local Compose S3Mock).
 */
export async function runAttachmentHttpS3CompatibleDrill(input: {
  readonly endpoint: string;
  readonly region?: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}): Promise<AttachmentHttpS3CompatibleDrillResult> {
  const cases: AttachmentHttpS3CompatibleDrillCase[] = [];
  const env = {
    LUMI_TEST_HS256_SECRET: 'local-s3-http-drill-hs256',
    LUMI_OIDC_ISSUER: 'http://test.invalid/realms/lumi',
    LUMI_ATTACHMENT_STORE: 'r2',
    LUMI_R2_ENDPOINT: input.endpoint,
    LUMI_R2_REGION: input.region ?? 'us-east-1',
    LUMI_R2_BUCKET: input.bucket,
    LUMI_R2_ACCESS_KEY_ID: input.accessKeyId,
    LUMI_R2_SECRET_ACCESS_KEY: input.secretAccessKey,
  } as NodeJS.ProcessEnv;

  const resolved = resolveAttachmentObjectStore(loadApiConfig(env));
  cases.push({
    name: 'object_store_provider',
    ok: resolved.provider === 'r2',
    detail:
      resolved.provider === 'r2'
        ? 'API resolved S3-compatible object store'
        : `expected r2, got ${resolved.provider}`,
  });
  if (resolved.provider !== 'r2') {
    return {
      ok: false,
      provider: resolved.provider,
      endpoint: input.endpoint,
      cases,
    };
  }

  const { app, tokens, attachmentObjectProvider } = await createFamilyApi(loadApiConfig(env));
  cases.push({
    name: 'api_wired_provider',
    ok: attachmentObjectProvider === 'r2',
    detail:
      attachmentObjectProvider === 'r2'
        ? 'createFamilyApi uses S3-compatible store'
        : `wired ${attachmentObjectProvider}`,
  });

  try {
    const adminId = randomUUID() as AppUserId;
    const token = await tokens.mintTestToken({
      subject: `s3-http-${adminId}`,
      appUserId: adminId,
    });
    const created = await app.inject({
      method: 'POST',
      url: '/v1/families',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        protocolVersion: LUMI_API_PROTOCOL_VERSION,
        idempotencyKey: `fam-s3-http-${adminId}`,
        displayName: 'S3 HTTP drill family',
      },
    });
    const familyOk = created.statusCode === 201;
    cases.push({
      name: 'create_family',
      ok: familyOk,
      detail: familyOk ? 'family created' : `status ${created.statusCode}`,
    });
    if (!familyOk) {
      return { ok: false, provider: 'r2', endpoint: input.endpoint, cases };
    }
    const familyId = created.json().familyId as FamilyId;

    const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9, 34, 2, 10]);
    const digest = sha256Hex(bytes);
    const attachmentId = randomUUID();

    const intent = await app.inject({
      method: 'POST',
      url: `/v1/families/${familyId}/attachments/intents`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        protocolVersion: LUMI_API_PROTOCOL_VERSION,
        idempotencyKey: `up-s3-http-${attachmentId}`,
        attachmentId,
        childId: 'child_drill',
        eventId: 'note_drill',
        role: 'display',
        expectedBytes: bytes.byteLength,
        expectedSha256: digest,
        contentType: 'image/jpeg',
      },
    });
    const intentOk = intent.statusCode === 201;
    cases.push({
      name: 'create_intent',
      ok: intentOk,
      detail: intentOk ? 'intent reserved' : `status ${intent.statusCode}`,
    });
    if (!intentOk) {
      return { ok: false, provider: 'r2', endpoint: input.endpoint, cases };
    }
    const intentId = intent.json().intentId as string;

    const uploaded = await app.inject({
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
        uploaded.statusCode === 200
          ? 'staging upload accepted'
          : `status ${uploaded.statusCode}`,
    });

    const finalized = await app.inject({
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
    const finalizeOk =
      finalized.statusCode === 200 && finalized.json().activated === true;
    cases.push({
      name: 'finalize_activate',
      ok: finalizeOk,
      detail: finalizeOk ? 'activated from S3-compatible store' : `status ${finalized.statusCode}`,
    });

    const read = await app.inject({
      method: 'GET',
      url: `/v1/families/${familyId}/attachments/${attachmentId}/display`,
      headers: { authorization: `Bearer ${token}` },
    });
    const readDigest =
      read.statusCode === 200
        ? createHash('sha256').update(read.rawPayload).digest('hex')
        : null;
    const readOk =
      read.statusCode === 200 &&
      read.headers['cache-control'] === 'private, no-store' &&
      readDigest === digest;
    cases.push({
      name: 'authorized_read',
      ok: readOk,
      detail: readOk ? 'display bytes match digest' : `status ${read.statusCode}`,
    });

    const erased = await app.inject({
      method: 'POST',
      url: `/v1/families/${familyId}/attachments/${attachmentId}/tombstone`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        protocolVersion: LUMI_API_PROTOCOL_VERSION,
        eraseGeneration: 1,
      },
    });
    const after = await app.inject({
      method: 'GET',
      url: `/v1/families/${familyId}/attachments/${attachmentId}/display`,
      headers: { authorization: `Bearer ${token}` },
    });
    const tombOk =
      erased.statusCode === 200 &&
      Number(erased.json().removed ?? 0) >= 1 &&
      after.statusCode === 404;
    cases.push({
      name: 'tombstone',
      ok: tombOk,
      detail: tombOk ? 'object erased; read denied' : 'tombstone left readable bytes',
    });
  } finally {
    await app.close();
  }

  return {
    ok: cases.every((row) => row.ok),
    provider: 'r2',
    endpoint: input.endpoint,
    cases,
  };
}

/** Defaults match Compose S3Mock — never used by personal cold boots. */
export const LOCAL_HTTP_S3_ATTACHMENT_DRILL_DEFAULTS =
  LOCAL_S3_COMPATIBLE_ATTACHMENT_DRILL_DEFAULTS;
