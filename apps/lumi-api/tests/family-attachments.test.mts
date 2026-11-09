import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import {
  LUMI_API_PROTOCOL_VERSION,
  type AppUserId,
  type FamilyId,
} from '@lumi/contracts';
import { loadApiConfig } from '../src/config/env.ts';
import { createFamilyApi } from '../src/http/createServer.ts';
import { createFamilyAttachmentQuotaLedger } from '../src/attachments/quotaLedger.ts';
import { createMemoryAttachmentObjectStore } from '../src/attachments/objectStore.ts';
import {
  createFamilyAttachmentService,
  sha256Hex,
} from '../src/attachments/attachmentService.ts';

function tinyJpeg(marker = 1): Uint8Array {
  // Minimal JPEG SOI/EOI with a distinct marker byte for digest variety.
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xd9, marker & 0xff]);
}

async function boot() {
  const config = loadApiConfig({
    LUMI_TEST_HS256_SECRET: 'unit-test-hs256',
    LUMI_OIDC_ISSUER: 'http://test.invalid/realms/lumi',
  } as NodeJS.ProcessEnv);
  return createFamilyApi(config);
}

async function createFamilyWithAdmin(
  app: Awaited<ReturnType<typeof createFamilyApi>>['app'],
  tokens: Awaited<ReturnType<typeof createFamilyApi>>['tokens'],
) {
  const adminId = randomUUID() as AppUserId;
  const token = await tokens.mintTestToken({
    subject: `admin-${adminId}`,
    appUserId: adminId,
  });
  const created = await app.inject({
    method: 'POST',
    url: '/v1/families',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: `fam-${adminId}`,
      displayName: 'Photo family',
    },
  });
  assert.equal(created.statusCode, 201);
  return {
    token,
    adminId,
    familyId: created.json().familyId as FamilyId,
  };
}

test('family attachment intent upload finalize and authorized read', async () => {
  const { app, tokens } = await boot();
  const family = await createFamilyWithAdmin(app, tokens);
  const bytes = tinyJpeg(7);
  const digest = sha256Hex(bytes);
  const attachmentId = randomUUID();

  const intent = await app.inject({
    method: 'POST',
    url: `/v1/families/${family.familyId}/attachments/intents`,
    headers: { authorization: `Bearer ${family.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: `up-${attachmentId}`,
      attachmentId,
      childId: 'child_1',
      eventId: 'note_1',
      role: 'display',
      expectedBytes: bytes.byteLength,
      expectedSha256: digest,
      contentType: 'image/jpeg',
    },
  });
  assert.equal(intent.statusCode, 201);
  const intentId = intent.json().intentId as string;

  const uploaded = await app.inject({
    method: 'PUT',
    url: `/v1/families/${family.familyId}/attachments/intents/${intentId}`,
    headers: {
      authorization: `Bearer ${family.token}`,
      'content-type': 'application/octet-stream',
    },
    payload: Buffer.from(bytes),
  });
  assert.equal(uploaded.statusCode, 200);

  const finalized = await app.inject({
    method: 'POST',
    url: `/v1/families/${family.familyId}/attachments/intents/${intentId}/finalize`,
    headers: { authorization: `Bearer ${family.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      intentId,
      sha256: digest,
      byteLength: bytes.byteLength,
    },
  });
  assert.equal(finalized.statusCode, 200);
  assert.equal(finalized.json().activated, true);

  const read = await app.inject({
    method: 'GET',
    url: `/v1/families/${family.familyId}/attachments/${attachmentId}/display`,
    headers: { authorization: `Bearer ${family.token}` },
  });
  assert.equal(read.statusCode, 200);
  assert.equal(read.headers['cache-control'], 'private, no-store');
  assert.equal(createHash('sha256').update(read.rawPayload).digest('hex'), digest);
});

test('foreign family token cannot read or finalize another family attachment', async () => {
  const { app, tokens } = await boot();
  const familyA = await createFamilyWithAdmin(app, tokens);
  const familyB = await createFamilyWithAdmin(app, tokens);
  const bytes = tinyJpeg(3);
  const digest = sha256Hex(bytes);
  const attachmentId = randomUUID();

  const intent = await app.inject({
    method: 'POST',
    url: `/v1/families/${familyA.familyId}/attachments/intents`,
    headers: { authorization: `Bearer ${familyA.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: `cross-${attachmentId}`,
      attachmentId,
      childId: 'child_1',
      eventId: 'note_1',
      role: 'display',
      expectedBytes: bytes.byteLength,
      expectedSha256: digest,
      contentType: 'image/jpeg',
    },
  });
  const intentId = intent.json().intentId as string;
  await app.inject({
    method: 'PUT',
    url: `/v1/families/${familyA.familyId}/attachments/intents/${intentId}`,
    headers: {
      authorization: `Bearer ${familyA.token}`,
      'content-type': 'application/octet-stream',
    },
    payload: Buffer.from(bytes),
  });
  await app.inject({
    method: 'POST',
    url: `/v1/families/${familyA.familyId}/attachments/intents/${intentId}/finalize`,
    headers: { authorization: `Bearer ${familyA.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      intentId,
      sha256: digest,
      byteLength: bytes.byteLength,
    },
  });

  const stolenRead = await app.inject({
    method: 'GET',
    url: `/v1/families/${familyA.familyId}/attachments/${attachmentId}/display`,
    headers: { authorization: `Bearer ${familyB.token}` },
  });
  assert.equal(stolenRead.statusCode, 403);

  const stolenIntent = await app.inject({
    method: 'POST',
    url: `/v1/families/${familyA.familyId}/attachments/intents`,
    headers: { authorization: `Bearer ${familyB.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: `steal-${attachmentId}`,
      attachmentId: randomUUID(),
      childId: 'child_x',
      eventId: 'note_x',
      role: 'display',
      expectedBytes: bytes.byteLength,
      expectedSha256: digest,
      contentType: 'image/jpeg',
    },
  });
  assert.equal(stolenIntent.statusCode, 403);
});

test('quota ledger rejects concurrent over-budget reservations without double-spend', async () => {
  const quota = createFamilyAttachmentQuotaLedger({
    budgetBytes: 1000,
    pendingReservationBudgetBytes: 1000,
  });
  const familyId = 'fam_quota';
  const first = await quota.reserve(familyId, 700);
  assert.equal(first.ok, true);
  const second = await Promise.all([quota.reserve(familyId, 400), quota.reserve(familyId, 400)]);
  const okCount = second.filter((row) => row.ok).length;
  assert.equal(okCount, 0);
  assert.equal(quota.view(familyId).reservedBytes, 700);
});

test('expired intents release reservation and never activate staging objects', async () => {
  const objects = createMemoryAttachmentObjectStore();
  const quota = createFamilyAttachmentQuotaLedger({
    budgetBytes: 10_000,
    pendingReservationBudgetBytes: 10_000,
  });
  const service = createFamilyAttachmentService({ objects, quota });
  const bytes = tinyJpeg(9);
  const digest = sha256Hex(bytes);
  const created = await service.createIntent({
    familyId: 'fam_exp',
    appUserId: 'user_1',
    membership: { active: true, role: 'caregiver' },
    attachmentId: 'att_exp',
    childId: 'child_1',
    eventId: 'note_1',
    role: 'display',
    expectedBytes: bytes.byteLength,
    expectedSha256: digest,
    nowMs: 1_000,
    idempotencyKey: 'exp-1',
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  await service.uploadBytes({
    intentId: created.response.intentId,
    appUserId: 'user_1',
    membership: { active: true, role: 'caregiver' },
    bytes,
    nowMs: 1_100,
  });
  const cleaned = await service.cleanupExpiredIntents(1_000 + 25 * 60 * 60 * 1000);
  assert.equal(cleaned, 1);
  assert.equal(quota.view('fam_exp').reservedBytes, 0);
  const finalized = await service.finalize({
    intentId: created.response.intentId,
    appUserId: 'user_1',
    membership: { active: true, role: 'caregiver' },
    sha256: digest,
    byteLength: bytes.byteLength,
    nowMs: 1_000 + 25 * 60 * 60 * 1000,
  });
  assert.equal(finalized.ok, false);
});

test('caregiver cannot tombstone; admin tombstone blocks later reads', async () => {
  const { app, tokens, store } = await boot();
  const family = await createFamilyWithAdmin(app, tokens);
  const caregiverId = randomUUID() as AppUserId;
  const caregiverToken = await tokens.mintTestToken({
    subject: `care-${caregiverId}`,
    appUserId: caregiverId,
  });
  store.ensureUser(caregiverId, new Date().toISOString());
  store.memberships.push({
    membershipId: randomUUID() as never,
    familyId: family.familyId,
    appUserId: caregiverId,
    role: 'caregiver',
    status: 'active',
    joinedAt: new Date().toISOString(),
  });

  const bytes = tinyJpeg(2);
  const digest = sha256Hex(bytes);
  const attachmentId = randomUUID();
  const intent = await app.inject({
    method: 'POST',
    url: `/v1/families/${family.familyId}/attachments/intents`,
    headers: { authorization: `Bearer ${caregiverToken}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: `care-${attachmentId}`,
      attachmentId,
      childId: 'child_1',
      eventId: 'note_1',
      role: 'display',
      expectedBytes: bytes.byteLength,
      expectedSha256: digest,
      contentType: 'image/jpeg',
    },
  });
  const intentId = intent.json().intentId as string;
  await app.inject({
    method: 'PUT',
    url: `/v1/families/${family.familyId}/attachments/intents/${intentId}`,
    headers: {
      authorization: `Bearer ${caregiverToken}`,
      'content-type': 'application/octet-stream',
    },
    payload: Buffer.from(bytes),
  });
  await app.inject({
    method: 'POST',
    url: `/v1/families/${family.familyId}/attachments/intents/${intentId}/finalize`,
    headers: { authorization: `Bearer ${caregiverToken}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      intentId,
      sha256: digest,
      byteLength: bytes.byteLength,
    },
  });

  const denied = await app.inject({
    method: 'POST',
    url: `/v1/families/${family.familyId}/attachments/${attachmentId}/tombstone`,
    headers: { authorization: `Bearer ${caregiverToken}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attachmentId,
      eraseGeneration: 1,
    },
  });
  assert.equal(denied.statusCode, 403);

  const erased = await app.inject({
    method: 'POST',
    url: `/v1/families/${family.familyId}/attachments/${attachmentId}/tombstone`,
    headers: { authorization: `Bearer ${family.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attachmentId,
      eraseGeneration: 1,
    },
  });
  assert.equal(erased.statusCode, 200);

  const missing = await app.inject({
    method: 'GET',
    url: `/v1/families/${family.familyId}/attachments/${attachmentId}/display`,
    headers: { authorization: `Bearer ${family.token}` },
  });
  assert.equal(missing.statusCode, 404);
});

test('tombstone cancels in-flight upload and blocks late finalize revival', async () => {
  const objects = createMemoryAttachmentObjectStore();
  const quota = createFamilyAttachmentQuotaLedger({
    budgetBytes: 10_000,
    pendingReservationBudgetBytes: 10_000,
  });
  const service = createFamilyAttachmentService({ objects, quota });
  const bytes = tinyJpeg(5);
  const digest = sha256Hex(bytes);
  const created = await service.createIntent({
    familyId: 'fam_erase',
    appUserId: 'user_1',
    membership: { active: true, role: 'caregiver' },
    attachmentId: 'att_erase',
    childId: 'child_1',
    eventId: 'note_1',
    role: 'display',
    expectedBytes: bytes.byteLength,
    expectedSha256: digest,
    nowMs: 1_000,
    idempotencyKey: 'erase-1',
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  await service.uploadBytes({
    intentId: created.response.intentId,
    appUserId: 'user_1',
    membership: { active: true, role: 'caregiver' },
    bytes,
    nowMs: 1_100,
  });

  const erased = await service.tombstone({
    familyId: 'fam_erase',
    attachmentId: 'att_erase',
    membership: { active: true, role: 'admin' },
    eraseGeneration: 1,
    nowMs: 1_200,
  });
  assert.equal(erased.ok, true);
  assert.equal(quota.view('fam_erase').reservedBytes, 0);
  assert.equal(service.recordedEraseGeneration('fam_erase', 'att_erase'), 1);

  const lateFinalize = await service.finalize({
    intentId: created.response.intentId,
    appUserId: 'user_1',
    membership: { active: true, role: 'caregiver' },
    sha256: digest,
    byteLength: bytes.byteLength,
    nowMs: 1_300,
  });
  assert.equal(lateFinalize.ok, false);

  const retryIntent = await service.createIntent({
    familyId: 'fam_erase',
    appUserId: 'user_1',
    membership: { active: true, role: 'caregiver' },
    attachmentId: 'att_erase',
    childId: 'child_1',
    eventId: 'note_1',
    role: 'display',
    expectedBytes: bytes.byteLength,
    expectedSha256: digest,
    nowMs: 1_400,
    idempotencyKey: 'erase-retry',
  });
  assert.equal(retryIntent.ok, false);

  const staleTomb = await service.tombstone({
    familyId: 'fam_erase',
    attachmentId: 'att_erase',
    membership: { active: true, role: 'admin' },
    eraseGeneration: 1,
    nowMs: 1_500,
  });
  assert.equal(staleTomb.ok, false);
});
