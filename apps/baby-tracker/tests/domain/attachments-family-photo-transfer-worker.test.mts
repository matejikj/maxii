import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import {
  ATTACHMENT_LIMITS,
  asAttachmentId,
  asChildId,
  asEntityId,
  asRenditionId,
  createDisabledFamilyAttachmentTransferPort,
  planUploadJobsForLocalAttachments,
  runFamilyPhotoTransferTick,
  type FamilyAttachmentTransferPort,
  type FamilyPhotoBlobTransferJob,
  type PhotoAttachment,
} from '../../src/domain/index.ts';
import {
  createHttpFamilyAttachmentTransferClient,
  resolveFamilyAttachmentTransferPort,
} from '../../src/infrastructure/attachments/index.ts';

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function attachmentWithBytes(id: string, bytes: Uint8Array): PhotoAttachment {
  const digest = sha256Hex(bytes);
  return {
    attachmentId: asAttachmentId(id),
    childId: asChildId('child_a'),
    eventId: asEntityId('note_1'),
    hostEventType: 'note',
    orderIndex: 0,
    caption: null,
    recordedBy: null,
    createdAtMs: 1,
    deletedAtMs: null,
    retainUntilMs: null,
    offlinePinned: false,
    renditions: [
      {
        renditionId: asRenditionId(`ren_${id}`),
        attachmentId: asAttachmentId(id),
        role: 'display',
        mime: 'image/jpeg',
        width: 8,
        height: 8,
        byteLength: bytes.byteLength,
        sha256: digest,
        normalizationVersion: ATTACHMENT_LIMITS.normalizationVersion,
        blobKey: `blob_${id}`,
        availability: 'durable',
      },
    ],
  };
}

function mockUploadPort(options?: {
  readonly quota?: boolean;
  readonly store?: Map<string, Uint8Array>;
}): FamilyAttachmentTransferPort {
  const store = options?.store ?? new Map<string, Uint8Array>();
  const intents = new Map<string, { attachmentId: string; sha256: string; bytes: number }>();
  return {
    async getQuota() {
      return {
        ok: true,
        value: { remainingBytes: 1000, usedBytes: 0, reservedBytes: 0, budgetBytes: 1000 },
      };
    },
    async createUploadIntent(input) {
      if (options?.quota) {
        return { ok: false, code: 'quota', message: 'quota' };
      }
      const intentId = `intent_${input.idempotencyKey}`;
      intents.set(intentId, {
        attachmentId: input.attachmentId,
        sha256: input.expectedSha256,
        bytes: input.expectedBytes,
      });
      return {
        ok: true,
        value: {
          intentId,
          objectKey: `obj_${intentId}`,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          reservedBytes: input.expectedBytes,
        },
      };
    },
    async uploadRenditionBytes(input) {
      const intent = intents.get(input.intentId);
      if (!intent) return { ok: false, code: 'not_found', message: 'missing intent' };
      if (input.bytes.byteLength !== intent.bytes) {
        return { ok: false, code: 'validation', message: 'length' };
      }
      store.set(intent.attachmentId, input.bytes);
      return { ok: true, value: { ok: true } };
    },
    async finalizeUpload(input) {
      const intent = intents.get(input.intentId);
      if (!intent) return { ok: false, code: 'not_found', message: 'missing intent' };
      return { ok: true, value: { activated: true } };
    },
    async readRendition(input) {
      const bytes = store.get(input.attachmentId);
      if (!bytes) return { ok: false, code: 'not_found', message: 'missing' };
      return {
        ok: true,
        value: {
          bytes,
          sha256: sha256Hex(bytes),
          byteLength: bytes.byteLength,
        },
      };
    },
  };
}

test('personal mode transfer tick stays cold and never calls the API port', async () => {
  let called = false;
  const port: FamilyAttachmentTransferPort = {
    ...createDisabledFamilyAttachmentTransferPort(),
    async createUploadIntent() {
      called = true;
      return { ok: false, code: 'not_configured', message: 'nope' };
    },
  };
  const result = await runFamilyPhotoTransferTick({
    session: {
      familySyncConfigured: false,
      activeFamilyId: null,
      appUserId: null,
    },
    jobs: [
      {
        jobId: 'j1',
        familyId: 'fam',
        attachmentId: 'a1',
        renditionId: 'r1',
        role: 'display',
        kind: 'upload',
        sha256: 'a'.repeat(64),
        byteLength: 4,
        state: 'queued',
        attemptCount: 0,
        lastErrorCode: null,
      },
    ],
    resolveAttachment: () => null,
    readLocalBytes: async () => null,
    writeDownloadedBytes: async () => undefined,
    port,
  });
  assert.equal(result.personalCold, true);
  assert.equal(result.started, 0);
  assert.equal(called, false);
});

test('upload tick creates intent, uploads bytes, and finalizes without diary JSON', async () => {
  const bytes = Uint8Array.from([1, 2, 3, 4, 5]);
  const local = attachmentWithBytes('a1', bytes);
  const session = {
    familySyncConfigured: true,
    activeFamilyId: 'fam_1',
    appUserId: 'user_1',
  };
  const jobs = planUploadJobsForLocalAttachments({
    session,
    attachments: [local],
    existingJobs: [],
    createJobId: (seed) => seed,
  });
  const store = new Map<string, Uint8Array>();
  const result = await runFamilyPhotoTransferTick({
    session,
    jobs,
    resolveAttachment: (id) => (id === local.attachmentId ? local : null),
    readLocalBytes: async () => bytes,
    writeDownloadedBytes: async () => undefined,
    port: mockUploadPort({ store }),
  });
  assert.equal(result.personalCold, false);
  assert.equal(result.succeeded, 1);
  assert.equal(result.jobs[0]!.state, 'succeeded');
  assert.ok(store.has('a1'));
});

test('quota rejection holds the upload locally without deleting durable bytes', async () => {
  const bytes = Uint8Array.from([9, 8, 7]);
  const local = attachmentWithBytes('a_quota', bytes);
  const session = {
    familySyncConfigured: true,
    activeFamilyId: 'fam_1',
    appUserId: 'user_1',
  };
  const jobs = planUploadJobsForLocalAttachments({
    session,
    attachments: [local],
    existingJobs: [],
    createJobId: (seed) => seed,
  });
  const result = await runFamilyPhotoTransferTick({
    session,
    jobs,
    resolveAttachment: () => local,
    readLocalBytes: async () => bytes,
    writeDownloadedBytes: async () => undefined,
    port: mockUploadPort({ quota: true }),
  });
  assert.equal(result.jobs[0]!.state, 'quota_waiting');
  assert.equal(result.succeeded, 0);
});

test('download tick verifies digest before writing local bytes', async () => {
  const bytes = Uint8Array.from([4, 4, 4, 4]);
  const digest = sha256Hex(bytes);
  const store = new Map([['remote_a', bytes]]);
  const job: FamilyPhotoBlobTransferJob = {
    jobId: 'dl_1',
    familyId: 'fam_1',
    attachmentId: 'remote_a',
    renditionId: 'r1',
    role: 'display',
    kind: 'download',
    sha256: digest,
    byteLength: bytes.byteLength,
    state: 'queued',
    attemptCount: 0,
    lastErrorCode: null,
  };
  let written: Uint8Array | null = null;
  const ok = await runFamilyPhotoTransferTick({
    session: {
      familySyncConfigured: true,
      activeFamilyId: 'fam_1',
      appUserId: 'user_1',
    },
    jobs: [job],
    resolveAttachment: () => null,
    readLocalBytes: async () => null,
    writeDownloadedBytes: async (_job, payload) => {
      written = payload;
    },
    port: mockUploadPort({ store }),
  });
  assert.equal(ok.jobs[0]!.state, 'succeeded');
  assert.ok(written);

  const bad = await runFamilyPhotoTransferTick({
    session: {
      familySyncConfigured: true,
      activeFamilyId: 'fam_1',
      appUserId: 'user_1',
    },
    jobs: [{ ...job, jobId: 'dl_bad', sha256: 'c'.repeat(64), state: 'queued' }],
    resolveAttachment: () => null,
    readLocalBytes: async () => null,
    writeDownloadedBytes: async () => {
      throw new Error('should not write');
    },
    port: mockUploadPort({ store }),
  });
  assert.equal(bad.jobs[0]!.state, 'failed');
  assert.equal(bad.jobs[0]!.lastErrorCode, 'digest_mismatch');
});

test('HTTP transfer client maps quota conflicts and stays disabled without API URL', async () => {
  const disabled = resolveFamilyAttachmentTransferPort({
    apiBaseUrl: null,
    familySyncConfigured: false,
    getAccessCredentials: async () => ({ kind: 'bearer', accessToken: 'tok' }),
  });
  const blocked = await disabled.createUploadIntent({
    familyId: 'f',
    idempotencyKey: 'k',
    attachmentId: 'a',
    childId: 'c',
    eventId: 'e',
    role: 'display',
    expectedBytes: 1,
    expectedSha256: 'a'.repeat(64),
  });
  assert.equal(blocked.ok, false);
  if (blocked.ok) return;
  assert.equal(blocked.code, 'not_configured');

  const calls: Array<{ method: string; auth?: string; csrf?: string; credentials?: RequestCredentials }> =
    [];
  const client = createHttpFamilyAttachmentTransferClient({
    apiBaseUrl: 'https://api.example.test',
    getAccessCredentials: async () => ({ kind: 'bearer', accessToken: 'bearer-token' }),
    fetchImpl: async (url, init) => {
      const headers = new Headers(init?.headers);
      calls.push({
        method: `${init?.method ?? 'GET'} ${String(url)}`,
        auth: headers.get('authorization') ?? undefined,
        credentials: init?.credentials,
      });
      return new Response(
        JSON.stringify({
          error: {
            code: 'conflict',
            message: 'quota',
            details: { reason: 'quota_exceeded' },
          },
        }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      );
    },
  });
  const quota = await client.createUploadIntent({
    familyId: 'fam_1',
    idempotencyKey: 'job_1',
    attachmentId: 'a1',
    childId: 'c1',
    eventId: 'e1',
    role: 'display',
    expectedBytes: 10,
    expectedSha256: 'a'.repeat(64),
  });
  assert.equal(quota.ok, false);
  if (quota.ok) return;
  assert.equal(quota.code, 'quota');
  assert.match(calls[0]!.method, /POST .*\/attachments\/intents/);
  assert.equal(calls[0]!.auth, 'Bearer bearer-token');

  const cookieCalls: Array<{ csrf?: string | null; credentials?: RequestCredentials }> = [];
  const cookieClient = createHttpFamilyAttachmentTransferClient({
    apiBaseUrl: 'https://api.example.test',
    getAccessCredentials: async () => ({ kind: 'cookie', csrfToken: 'csrf-secret' }),
    fetchImpl: async (_url, init) => {
      const headers = new Headers(init?.headers);
      cookieCalls.push({
        csrf: headers.get('x-csrf-token'),
        credentials: init?.credentials,
      });
      return new Response(
        JSON.stringify({
          remainingBytes: 1,
          usedBytes: 0,
          reservedBytes: 0,
          budgetBytes: 1,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
  });
  const cookieQuota = await cookieClient.getQuota({ familyId: 'fam_1' });
  assert.equal(cookieQuota.ok, true);
  assert.equal(cookieCalls[0]!.csrf, 'csrf-secret');
  assert.equal(cookieCalls[0]!.credentials, 'include');
});
