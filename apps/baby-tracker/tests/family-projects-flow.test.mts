import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asChildId,
  createChildProfile,
  createDiaryArchive,
  isChildPrivateModeActive,
} from '../src/domain/index.ts';
import {
  createFamilyGuidedProjectFromTemplate,
  listFamilyGuidedProjectsForChild,
  listFamilyGuidedTemplates,
  updateFamilyGuidedProjectStatus,
} from '../src/application/index.ts';
import { PROJECT_TEMPLATES_PUBLISHED } from '../src/content/catalog/projectTemplatesPublished.ts';
import { createMemoryCheckpointStore } from '../src/infrastructure/database/native/checkpoint.ts';
import { createMemoryDatabasePresence } from '../src/infrastructure/database/native/databasePresence.ts';
import { createMemoryDatabaseKeyStore } from '../src/infrastructure/database/native/memoryKeyStore.ts';
import { createMemoryEncryptedSqlOpener } from '../src/infrastructure/database/native/memoryEncryptedSql.ts';
import { createNativeUnitOfWorkFactory } from '../src/infrastructure/database/native/nativeUnitOfWork.ts';
import { openPrivateDatabase } from '../src/infrastructure/database/native/privateDatabase.ts';
import { currentSchemaVersion } from '../src/infrastructure/database/native/migrations.ts';
import { SCHEMA_VERSION_6 } from '../src/infrastructure/database/native/schema/v6.ts';

const childId = asChildId('child_proj_1');
const clock = Date.UTC(2026, 10, 9, 12, 0, 0);

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

test('schema v6 opens and familyGuided projects persist across reload', async () => {
  const ctx = await openNative('family-projects.db');
  assert.equal(await currentSchemaVersion(ctx.db.connection), SCHEMA_VERSION_6);
  assert.equal(isChildPrivateModeActive(), false);
  assert.equal(listFamilyGuidedTemplates().length, 12);

  const template = PROJECT_TEMPLATES_PUBLISHED[0]!;
  const created = await createFamilyGuidedProjectFromTemplate({
    unitOfWork: ctx.unitOfWork,
    ids: ctx.ids,
    now: { epochMs: clock },
    childId,
    templateRevisionId: template.revisionId,
  });
  assert.equal(created.project.scope, 'familyGuided');
  assert.match(created.scopeLabel, /Rodinný projekt/);

  const listed = await listFamilyGuidedProjectsForChild(ctx.unitOfWork, { childId });
  assert.equal(listed.length, 1);
  assert.equal(listed[0]!.project.title, template.title);

  await updateFamilyGuidedProjectStatus({
    unitOfWork: ctx.unitOfWork,
    ids: ctx.ids,
    now: { epochMs: clock + 1 },
    projectId: created.project.projectId,
    nextStatus: 'paused',
  });
  const after = await listFamilyGuidedProjectsForChild(ctx.unitOfWork, { childId });
  assert.equal(after[0]!.project.status, 'paused');
  await ctx.close();
});

test('diary replace clears local projects so wipe cannot leave residues', async () => {
  const ctx = await openNative('family-projects-wipe.db');
  const template = PROJECT_TEMPLATES_PUBLISHED[1]!;
  await createFamilyGuidedProjectFromTemplate({
    unitOfWork: ctx.unitOfWork,
    ids: ctx.ids,
    now: { epochMs: clock },
    childId,
    templateRevisionId: template.revisionId,
  });
  assert.equal((await listFamilyGuidedProjectsForChild(ctx.unitOfWork, { childId })).length, 1);

  const empty = createDiaryArchive({
    createdAtMs: clock,
    schemaCompatibility: 6,
    profiles: [],
    careEvents: [],
    sessions: [],
    drafts: [],
    revisions: [],
    receipts: [],
    deletions: [],
    meta: [],
  });
  await ctx.unitOfWork.run(async (uow) => {
    await uow.diary.replace(empty);
  });
  assert.equal((await listFamilyGuidedProjectsForChild(ctx.unitOfWork, { childId })).length, 0);
  await ctx.close();
});
