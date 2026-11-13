import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asChildId,
  asEntityId,
  createChildProfile,
  isChildPrivateModeActive,
} from '../src/domain/index.ts';
import {
  acceptSuggestionIntoChildPrivate,
  listFamilyGuidedProjectsForChild,
  listParentSuggestionsForAuthor,
  proposeParentSuggestion,
  readChildPrivateModeSettingsStatus,
  startSuggestionAsFamilyGuided,
  withdrawAuthoredSuggestion,
} from '../src/application/index.ts';
import { PROJECT_TEMPLATES_PUBLISHED } from '../src/content/catalog/projectTemplatesPublished.ts';
import { createMemoryCheckpointStore } from '../src/infrastructure/database/native/checkpoint.ts';
import { createMemoryDatabasePresence } from '../src/infrastructure/database/native/databasePresence.ts';
import { createMemoryDatabaseKeyStore } from '../src/infrastructure/database/native/memoryKeyStore.ts';
import { createMemoryEncryptedSqlOpener } from '../src/infrastructure/database/native/memoryEncryptedSql.ts';
import { createNativeUnitOfWorkFactory } from '../src/infrastructure/database/native/nativeUnitOfWork.ts';
import { openPrivateDatabase } from '../src/infrastructure/database/native/privateDatabase.ts';
import { currentSchemaVersion } from '../src/infrastructure/database/native/migrations.ts';
import { SCHEMA_VERSION_9 } from '../src/infrastructure/database/native/schema/v9.ts';

const childId = asChildId('child_sug_1');
const clock = Date.UTC(2026, 10, 9, 14, 0, 0);

async function openNative(name: string) {
  const opener = createMemoryEncryptedSqlOpener();
  const keyStore = createMemoryDatabaseKeyStore();
  const presence = createMemoryDatabasePresence();
  const db = await openPrivateDatabase({
    databaseName: name,
    opener,
    keyStore,
    presence,
    checkpointStore: createMemoryCheckpointStore(),
    now: { epochMs: clock },
  });
  const profile = createChildProfile({
    childId,
    displayName: 'Mája',
    birthDate: { year: 2016, month: 5, day: 1 },
    summaryTimeZone: 'Europe/Prague',
  });
  await db.connection.runAsync(
    `INSERT INTO child_profiles (child_id, display_name, birth_date, summary_time_zone, payload_json) VALUES (?, ?, ?, ?, ?)`,
    childId,
    profile.displayName,
    '2016-05-01',
    'Europe/Prague',
    JSON.stringify(profile),
  );
  const unitOfWork = createNativeUnitOfWorkFactory(db, { nowMs: () => clock });
  const ids = { createId: (prefix = 'id') => `${prefix}_${Math.random().toString(16).slice(2)}` };
  return { db, unitOfWork, ids, close: () => db.close() };
}

test('schema migrates to parent suggestions table', async () => {
  const ctx = await openNative('sug-schema.db');
  assert.equal(await currentSchemaVersion(ctx.db.connection), SCHEMA_VERSION_9);
  await ctx.close();
});

test('caregiver can propose and start together without activating child private mode', async () => {
  assert.equal(isChildPrivateModeActive(), false);
  const status = readChildPrivateModeSettingsStatus();
  assert.equal(status.active, false);

  const ctx = await openNative('sug-flow.db');
  const template = PROJECT_TEMPLATES_PUBLISHED[0]!;
  const suggestion = await proposeParentSuggestion({
    unitOfWork: ctx.unitOfWork,
    ids: ctx.ids,
    now: { epochMs: clock },
    childId,
    title: template.title,
    note: template.intent,
    templateRevisionId: template.revisionId,
  });
  assert.equal(suggestion.status, 'pending');

  const listed = await listParentSuggestionsForAuthor({
    unitOfWork: ctx.unitOfWork,
    childId,
  });
  assert.equal(listed.length, 1);
  assert.equal(listed[0]!.delivery, 'pending');

  const started = await startSuggestionAsFamilyGuided({
    unitOfWork: ctx.unitOfWork,
    ids: ctx.ids,
    now: { epochMs: clock + 1 },
    suggestionId: suggestion.suggestionId,
  });
  assert.equal(started.suggestion.delivery, 'started_together');

  const projects = await listFamilyGuidedProjectsForChild(ctx.unitOfWork, { childId });
  assert.equal(projects.length, 1);
  assert.equal(projects[0]!.project.projectId, started.projectId);
  assert.equal(projects[0]!.project.scope, 'familyGuided');

  await assert.rejects(
    () =>
      acceptSuggestionIntoChildPrivate({
        unitOfWork: ctx.unitOfWork,
        suggestionId: asEntityId('missing'),
        resultingProjectId: asEntityId('proj_x'),
        now: { epochMs: clock + 2 },
      }),
    /not found/i,
  );

  await ctx.close();
});

test('withdraw keeps author view free of private accept telemetry', async () => {
  const ctx = await openNative('sug-withdraw.db');
  const suggestion = await proposeParentSuggestion({
    unitOfWork: ctx.unitOfWork,
    ids: ctx.ids,
    now: { epochMs: clock },
    childId,
    title: 'Venkovní most',
    note: 'Jen nápad',
  });
  const withdrawn = await withdrawAuthoredSuggestion({
    unitOfWork: ctx.unitOfWork,
    now: { epochMs: clock + 5 },
    suggestionId: suggestion.suggestionId,
  });
  assert.equal(withdrawn.delivery, 'withdrawn');
  await ctx.close();
});
