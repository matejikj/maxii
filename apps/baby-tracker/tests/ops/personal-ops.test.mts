import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asChildId,
  asEntityId,
  asOperationId,
  asRevisionId,
  asTimeZoneId,
  isAppError,
  zonedInstant,
} from '../../src/domain/index.ts';
import {
  buildDiagnosticsSnapshot,
  buildSupportReport,
  createCommandDispatcher,
  serializeSupportReport,
} from '../../src/application/index.ts';
import {
  NATIVE_SCHEMA_COMPATIBILITY,
  WEB_SCHEMA_COMPATIBILITY,
  assertSchemaCompatibleWithBinary,
  buildReleaseEvidenceManifest,
  canBinaryOpenSchema,
  checkNativeApplicationIds,
  createLocalOperationMetrics,
  metricFieldNames,
} from '../../src/ops/index.ts';
import { LOG_FIELD_ALLOWLIST, sanitizeLogFields } from '../../src/infrastructure/telemetry/logger.ts';
import { createMemoryCheckpointStore } from '../../src/infrastructure/database/native/checkpoint.ts';
import { createMemoryDatabasePresence } from '../../src/infrastructure/database/native/databasePresence.ts';
import { createMemoryDatabaseKeyStore } from '../../src/infrastructure/database/native/memoryKeyStore.ts';
import { createMemoryEncryptedSqlOpener } from '../../src/infrastructure/database/native/memoryEncryptedSql.ts';
import { createNativeUnitOfWorkFactory } from '../../src/infrastructure/database/native/nativeUnitOfWork.ts';
import { openPrivateDatabase } from '../../src/infrastructure/database/native/privateDatabase.ts';

const CANARY_NOTE = 'CANARY_SUPPORT_NOTE_39a1';
const CANARY_DOB = '2099-04-01';
const zone = asTimeZoneId('Europe/Prague');
const childId = asChildId('child_ops_1');

test('native application id check accepts matejikj gradle and pbxproj pins', () => {
  const ok = checkNativeApplicationIds({
    androidAppGradle: `
    namespace 'com.matejikj'
    defaultConfig {
        applicationId 'com.matejikj'
    }
`,
    iosPbxproj: `
				PRODUCT_BUNDLE_IDENTIFIER = com.matejikj;
				PRODUCT_BUNDLE_IDENTIFIER = "com.matejikj";
`,
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.androidApplicationId, 'com.matejikj');
  assert.equal(ok.iosBundleIdentifier, 'com.matejikj');

  const bad = checkNativeApplicationIds({
    androidAppGradle: `
    namespace 'com.example.lumibabytracker'
    defaultConfig {
        applicationId 'com.example.lumibabytracker'
    }
`,
  });
  assert.equal(bad.ok, false);
  assert.ok(bad.problems.some((line) => line.includes('applicationId')));
});

test('release evidence pins app, schema, catalog, pack and art versions', () => {
  const manifest = buildReleaseEvidenceManifest({
    nowMs: 1_700_000_000_000,
    environment: 'staging',
    appVersion: '0.1.0',
  });
  assert.equal(manifest.format, 'lumi.release-evidence.v1');
  assert.equal(manifest.app.version, '0.1.0');
  assert.equal(manifest.app.applicationId, 'com.matejikj');
  assert.equal(manifest.storage.nativeSchemaCompatibility, NATIVE_SCHEMA_COMPATIBILITY);
  assert.equal(manifest.storage.webSchemaCompatibility, WEB_SCHEMA_COMPATIBILITY);
  assert.equal(
    manifest.content.catalogVersion,
    'first-year.v1+toddler-1-2.v1+preschool-2-5.v1',
  );
  assert.equal(manifest.content.baseCatalogVersion, 'first-year.v1');
  assert.equal(manifest.content.publishedRevisionCount, 108);
  assert.ok(manifest.content.recommendationRulesVersion.length > 0);
  assert.equal(manifest.pack.packId, 'lumi.first-year.base');
  assert.equal(manifest.pack.generation, 1);
  assert.equal(manifest.pack.keyId, 'lumi-content-ed25519-v1');
  assert.equal(manifest.pack.expansionPackId, 'lumi.preschool-2-5.content');
  assert.equal(manifest.pack.toddlerExpansionPackId, 'lumi.toddler-1-2.content');
  assert.equal(manifest.art.collectionVersion, 'lumi.characters.collection.v1');
  assert.equal(manifest.signing.keysInRepository, false);
});

test('schema gate allows current binary ceiling and refuses newer diaries', () => {
  assert.equal(
    canBinaryOpenSchema({
      platform: 'native',
      databaseSchemaVersion: NATIVE_SCHEMA_COMPATIBILITY,
    }),
    true,
  );
  assert.equal(
    canBinaryOpenSchema({
      platform: 'web',
      databaseSchemaVersion: WEB_SCHEMA_COMPATIBILITY,
    }),
    true,
  );
  assert.equal(
    canBinaryOpenSchema({
      platform: 'native',
      databaseSchemaVersion: NATIVE_SCHEMA_COMPATIBILITY + 1,
    }),
    false,
  );
  try {
    assertSchemaCompatibleWithBinary({
      platform: 'native',
      databaseSchemaVersion: NATIVE_SCHEMA_COMPATIBILITY + 1,
    });
    assert.fail('expected schema_too_new_for_binary');
  } catch (error) {
    assert.ok(isAppError(error));
    assert.equal(error.code, 'STORAGE');
    assert.equal(error.details.reason, 'schema_too_new_for_binary');
  }
});

test('local operation metrics keep allowlisted fields and drop care payloads', () => {
  for (const name of metricFieldNames()) {
    if (name === 'atMs') continue;
    assert.ok(LOG_FIELD_ALLOWLIST.has(name), `metric field ${name} must be allowlisted`);
  }
  const metrics = createLocalOperationMetrics({ nowMs: () => 42 });
  metrics.record({
    operation: 'recordDiaper',
    ok: true,
    code: 'savedLocally',
    durationMs: 12,
    platform: 'ios',
  });
  metrics.record({
    operation: 'recordNote',
    ok: false,
    code: 'VALIDATION',
    durationMs: 3,
    platform: 'web',
  });
  const snap = metrics.snapshot();
  assert.equal(snap.successCount, 1);
  assert.equal(snap.failureCount, 1);
  assert.equal(snap.recent[0]?.operation, 'recordDiaper');
  const redacted = sanitizeLogFields({
    operation: 'recordNote',
    ok: false,
    code: 'VALIDATION',
    durationMs: 3,
    platform: 'web',
    noteBody: CANARY_NOTE,
    birthDate: CANARY_DOB,
  });
  assert.equal(redacted.noteBody, '[redacted]');
  assert.equal(redacted.birthDate, '[redacted]');
  assert.doesNotMatch(JSON.stringify(redacted), new RegExp(CANARY_NOTE));
});

test('command dispatcher records local success and failure without payloads', async () => {
  const clock = 1_700_000_100_000;
  const opener = createMemoryEncryptedSqlOpener();
  const keyStore = createMemoryDatabaseKeyStore();
  const presence = createMemoryDatabasePresence();
  const db = await openPrivateDatabase({
    databaseName: `ops-metrics-${Date.now()}`,
    opener,
    keyStore,
    presence,
    checkpointStore: createMemoryCheckpointStore(),
    now: { epochMs: clock },
  });
  await db.connection.runAsync(
    `INSERT INTO child_profiles (child_id, display_name, birth_date, summary_time_zone, payload_json) VALUES (?, ?, ?, ?, ?)`,
    childId,
    'Ops',
    '2025-02-02',
    'Europe/Prague',
    JSON.stringify({
      childId,
      displayName: 'Ops',
      birthDate: '2025-02-02',
      settings: { summaryTimeZone: 'Europe/Prague' },
    }),
  );
  const unitOfWork = createNativeUnitOfWorkFactory(db, { nowMs: () => clock });
  const metrics = createLocalOperationMetrics({ nowMs: () => clock });
  const dispatcher = createCommandDispatcher({
    unitOfWork,
    clock: { now: () => ({ epochMs: clock }) },
    metrics,
    metricsPlatform: 'test',
  });
  const ok = await dispatcher.dispatch({
    type: 'recordNote',
    operationId: asOperationId('op_ops_note'),
    intentCapturedAt: { epochMs: clock },
    eventId: asEntityId('note_ops'),
    revisionId: asRevisionId('rev_ops'),
    childId,
    occurredAt: zonedInstant({ epochMs: clock }, zone),
    body: CANARY_NOTE,
  });
  assert.equal(ok.ok, true);
  const snap = metrics.snapshot();
  assert.equal(snap.successCount, 1);
  assert.equal(snap.byOperation.recordNote?.ok, 1);
  assert.doesNotMatch(JSON.stringify(snap), new RegExp(CANARY_NOTE));
  await db.close();
});

test('support report never attaches diary backup and redacts note/DOB canaries', async () => {
  const clock = 1_700_000_200_000;
  const opener = createMemoryEncryptedSqlOpener();
  const db = await openPrivateDatabase({
    databaseName: `ops-support-${Date.now()}`,
    opener,
    keyStore: createMemoryDatabaseKeyStore(),
    presence: createMemoryDatabasePresence(),
    checkpointStore: createMemoryCheckpointStore(),
    now: { epochMs: clock },
  });
  await db.connection.runAsync(
    `INSERT INTO child_profiles (child_id, display_name, birth_date, summary_time_zone, payload_json) VALUES (?, ?, ?, ?, ?)`,
    childId,
    'Support',
    CANARY_DOB,
    'Europe/Prague',
    JSON.stringify({
      childId,
      displayName: 'Support',
      birthDate: CANARY_DOB,
      settings: { summaryTimeZone: 'Europe/Prague' },
    }),
  );
  const unitOfWork = createNativeUnitOfWorkFactory(db, { nowMs: () => clock });
  const metrics = createLocalOperationMetrics({ nowMs: () => clock });
  metrics.record({
    operation: 'recordNote',
    ok: true,
    code: 'savedLocally',
    durationMs: 4,
    platform: 'test',
  });
  const diagnostics = await buildDiagnosticsSnapshot({
    unitOfWork,
    checkpointCount: 1,
    appLockEnabled: false,
    nowMs: clock,
    platform: 'test',
  });
  const release = diagnostics.releaseEvidence!;
  const report = buildSupportReport({
    nowMs: clock,
    release,
    diagnostics,
    localOperations: metrics.snapshot(),
  });
  const text = serializeSupportReport(report);
  assert.equal(report.privacy.includesDiaryBackup, false);
  assert.equal(report.privacy.includesNotesOrDob, false);
  assert.doesNotMatch(text, new RegExp(CANARY_NOTE));
  assert.doesNotMatch(text, new RegExp(CANARY_DOB));
  assert.match(text, /lumi\.support-report\.v1/);
  assert.match(text, /lumi\.release-evidence\.v1/);
  await db.close();
});
