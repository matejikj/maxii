import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asActorId,
  asChildId,
  asEntityId,
  asRevisionId,
  createChildPrivateProject,
  createChildProfile,
  createDiaryArchive,
  isChildPrivateModeActive,
} from '../src/domain/index.ts';
import {
  addPortfolioSelection,
  createFamilyGuidedBlankIdea,
  createFamilyGuidedProjectFromTemplate,
  describeFamilyGuidedCohort8to11Availability,
  describeFamilyGuidedCohort12to14Availability,
  describeFamilyGuidedCohort15to17Availability,
  describeFamilyGuidedSelfManagementPreparation,
  exportProjectsForFamilyArchive,
  familyGuidedCohort8to11Pack,
  familyGuidedCohort12to14Pack,
  familyGuidedCohort15to17Pack,
  listFamilyGuidedProjectShelves,
  listFamilyGuidedProjectsForChild,
  listFamilyGuidedTemplates,
  listFamilyGuidedTemplatesForCohort8to11,
  listFamilyGuidedTemplatesForCohort12to14,
  listFamilyGuidedTemplatesForCohort15to17,
  listTodayFamilyGuidedProjects,
  saveFamilyGuidedProjectReflection,
  saveFamilyGuidedSourceNotes,
  saveFamilyGuidedVariantNotes,
  searchFamilyGuidedTemplates,
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
import { SCHEMA_VERSION_9 } from '../src/infrastructure/database/native/schema/v9.ts';

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

test('schema opens and familyGuided projects persist across reload', async () => {
  const ctx = await openNative('family-projects.db');
  assert.equal(await currentSchemaVersion(ctx.db.connection), SCHEMA_VERSION_9);
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
    schemaCompatibility: 9,
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

test('portfolio selection persists and family export omits childPrivate rows', async () => {
  const ctx = await openNative('family-portfolio.db');
  const template = PROJECT_TEMPLATES_PUBLISHED[2]!;
  const created = await createFamilyGuidedProjectFromTemplate({
    unitOfWork: ctx.unitOfWork,
    ids: ctx.ids,
    now: { epochMs: clock },
    childId,
    templateRevisionId: template.revisionId,
  });
  const item = await addPortfolioSelection({
    unitOfWork: ctx.unitOfWork,
    ids: ctx.ids,
    now: { epochMs: clock },
    projectId: created.project.projectId,
    title: created.project.title,
  });
  assert.equal(item.visibility, 'private');

  await ctx.unitOfWork.run(async (uow) => {
    const privateProject = createChildPrivateProject({
      projectId: asEntityId('proj_secret'),
      revisionId: asRevisionId('rev_secret'),
      childId,
      ownerAppUserId: asActorId('child_user'),
      template: PROJECT_TEMPLATES_PUBLISHED[0]!,
      title: 'Tajný',
      intent: 'Nemá být v rodinném exportu',
      now: { epochMs: clock },
      createStepId: (index) => asEntityId(`sec_${index}`),
      childPrivateModeActive: true,
    });
    // Persist even though product UI keeps child mode inactive — export must still filter.
    await uow.projects.save(privateProject);
  });

  const exported = await exportProjectsForFamilyArchive({
    unitOfWork: ctx.unitOfWork,
    principalKind: 'other_adult_admin',
    principalAppUserId: asActorId('admin_1'),
  });
  assert.equal(exported.projects.every((row) => row.scope === 'familyGuided'), true);
  assert.equal(
    exported.projects.some((row) => row.title === 'Tajný'),
    false,
  );
  await ctx.close();
});

test('8-11 cohort templates and blank idea support caregiver shelves without child mode', async () => {
  assert.equal(listFamilyGuidedTemplatesForCohort8to11().length, 4);
  assert.equal(familyGuidedCohort8to11Pack().offlineEmbedded, true);
  assert.match(describeFamilyGuidedCohort8to11Availability().detail, /instalace/);

  const ctx = await openNative('family-8-11.db');
  const fromTemplate = await createFamilyGuidedProjectFromTemplate({
    unitOfWork: ctx.unitOfWork,
    ids: ctx.ids,
    now: { epochMs: clock },
    childId,
    templateRevisionId: listFamilyGuidedTemplatesForCohort8to11()[0]!.revisionId,
  });
  const blank = await createFamilyGuidedBlankIdea({
    unitOfWork: ctx.unitOfWork,
    ids: ctx.ids,
    now: { epochMs: clock + 1 },
    childId,
    title: 'Vlastní papírový most',
    intent: 'Zkusit jiný tvar',
  });
  assert.equal(blank.project.templateRevisionId, null);
  assert.ok(blank.nextStepText);

  await saveFamilyGuidedProjectReflection({
    unitOfWork: ctx.unitOfWork,
    ids: ctx.ids,
    now: { epochMs: clock + 2 },
    projectId: blank.project.projectId,
    reflection: null,
  });

  await updateFamilyGuidedProjectStatus({
    unitOfWork: ctx.unitOfWork,
    ids: ctx.ids,
    now: { epochMs: clock + 3 },
    projectId: fromTemplate.project.projectId,
    nextStatus: 'paused',
  });

  const shelves = await listFamilyGuidedProjectShelves(ctx.unitOfWork, { childId });
  assert.equal(shelves.active.length, 1);
  assert.equal(shelves.paused.length, 1);
  assert.equal(shelves.active[0]!.project.projectId, blank.project.projectId);

  const today = await listTodayFamilyGuidedProjects(ctx.unitOfWork, { childId });
  assert.equal(today.length, 1);
  assert.equal(today[0]!.project.title, 'Vlastní papírový most');
  await ctx.close();
});

test('12-14 cohort templates, search, and variant notes stay local without share leak', async () => {
  assert.equal(listFamilyGuidedTemplatesForCohort12to14().length, 4);
  assert.equal(familyGuidedCohort12to14Pack().offlineEmbedded, true);
  assert.match(describeFamilyGuidedCohort12to14Availability().detail, /variant/);
  assert.equal(searchFamilyGuidedTemplates('12-14').length, 4);

  const ctx = await openNative('family-12-14.db');
  const fromTemplate = await createFamilyGuidedProjectFromTemplate({
    unitOfWork: ctx.unitOfWork,
    ids: ctx.ids,
    now: { epochMs: clock },
    childId,
    templateRevisionId: listFamilyGuidedTemplatesForCohort12to14()[0]!.revisionId,
  });
  assert.equal(fromTemplate.cohort, '12-14');
  assert.equal(fromTemplate.project.variantNotes, null);

  const blank = await createFamilyGuidedBlankIdea({
    unitOfWork: ctx.unitOfWork,
    ids: ctx.ids,
    now: { epochMs: clock + 1 },
    childId,
    title: 'Dva směry vlastního nápadu',
    style: 'variants',
  });
  assert.match(blank.nextStepText ?? '', /variant/i);

  const withNotes = await saveFamilyGuidedVariantNotes({
    unitOfWork: ctx.unitOfWork,
    ids: ctx.ids,
    now: { epochMs: clock + 2 },
    projectId: blank.project.projectId,
    notes: {
      optionA: 'Varianta papír',
      optionB: 'Varianta dřevo',
      chosenNote: 'Zatím otevřená otázka',
    },
  });
  assert.equal(withNotes.project.variantNotes?.optionA, 'Varianta papír');
  assert.equal(withNotes.project.variantNotes?.optionB, 'Varianta dřevo');

  const cleared = await saveFamilyGuidedVariantNotes({
    unitOfWork: ctx.unitOfWork,
    ids: ctx.ids,
    now: { epochMs: clock + 3 },
    projectId: blank.project.projectId,
    notes: null,
  });
  assert.equal(cleared.project.variantNotes, null);

  const shelves = await listFamilyGuidedProjectShelves(ctx.unitOfWork, { childId });
  assert.equal(shelves.active.length, 2);
  assert.ok(shelves.active.some((row) => row.project.projectId === fromTemplate.project.projectId));
  await ctx.close();
});

test('15-17 cohort templates, own brief, source notes, and self-management preview', async () => {
  assert.equal(listFamilyGuidedTemplatesForCohort15to17().length, 4);
  assert.equal(familyGuidedCohort15to17Pack().offlineEmbedded, true);
  assert.match(describeFamilyGuidedCohort15to17Availability().detail, /zdroj/);
  assert.equal(searchFamilyGuidedTemplates('15-17').length, 4);

  const prep = describeFamilyGuidedSelfManagementPreparation();
  assert.equal(prep.screenAvailable, false);
  assert.equal(prep.familyHistoryAutoTransfer, false);

  const ctx = await openNative('family-15-17.db');
  const fromTemplate = await createFamilyGuidedProjectFromTemplate({
    unitOfWork: ctx.unitOfWork,
    ids: ctx.ids,
    now: { epochMs: clock },
    childId,
    templateRevisionId: listFamilyGuidedTemplatesForCohort15to17()[0]!.revisionId,
  });
  assert.equal(fromTemplate.cohort, '15-17');
  assert.equal(fromTemplate.project.sourceNotes, null);

  const blank = await createFamilyGuidedBlankIdea({
    unitOfWork: ctx.unitOfWork,
    ids: ctx.ids,
    now: { epochMs: clock + 1 },
    childId,
    title: 'Vlastní krátké zadání',
    style: 'ownBrief',
  });
  assert.match(blank.nextStepText ?? '', /vlastní výsledek/i);

  const withSource = await saveFamilyGuidedSourceNotes({
    unitOfWork: ctx.unitOfWork,
    ids: ctx.ids,
    now: { epochMs: clock + 2 },
    projectId: blank.project.projectId,
    notes: {
      question: 'Co chci ověřit?',
      sourceLabel: 'Lokální příprava bez sítě',
      checkedOn: null,
      supportedClaim: 'Zatím jen otázka',
      openQuestion: 'Bez online kontroly',
      verifiedOnline: false,
    },
  });
  assert.equal(withSource.project.sourceNotes?.verifiedOnline, false);
  assert.equal(withSource.project.sourceNotes?.sourceLabel, 'Lokální příprava bez sítě');

  const cleared = await saveFamilyGuidedSourceNotes({
    unitOfWork: ctx.unitOfWork,
    ids: ctx.ids,
    now: { epochMs: clock + 3 },
    projectId: blank.project.projectId,
    notes: null,
  });
  assert.equal(cleared.project.sourceNotes, null);

  const shelves = await listFamilyGuidedProjectShelves(ctx.unitOfWork, { childId });
  assert.equal(shelves.active.length, 2);
  assert.ok(shelves.active.some((row) => row.project.projectId === fromTemplate.project.projectId));
  await ctx.close();
});
