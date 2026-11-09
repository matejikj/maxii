import { createDiaryArchive, type UnitOfWorkFactory } from '../domain';
import type { LogicalCheckpointVault } from '../infrastructure/database/logicalCheckpointVault';
import type { DatabaseKeyStore } from '../infrastructure/database/native/databaseKeyStoreTypes';
import type { DatabasePresence } from '../infrastructure/database/native/databasePresence';
import type { ReminderScheduler } from '../infrastructure/notifications/reminderScheduler';
import type { AppLockStore } from '../infrastructure/security/appLockStore';

export type PersonalWipeResult = {
  wipedAtMs: number;
  clearedCheckpoints: number;
  externalExportNote: string;
};

export type PersonalWipeDeps = {
  unitOfWork: UnitOfWorkFactory;
  checkpoints: LogicalCheckpointVault;
  reminders: ReminderScheduler;
  appLock: AppLockStore;
  nowMs: number;
  /** Close open connections before deleting durable files. */
  closeRuntime: () => Promise<void>;
  /** Delete the encrypted SQLite file (native) or IndexedDB diary (web). */
  deleteDurableStore: () => Promise<void>;
  keyStore?: DatabaseKeyStore;
  presence?: DatabasePresence;
  databaseName: string;
};

/**
 * Complete local erase for the personal diary. External portable/CSV files the
 * caregiver already saved elsewhere must be removed manually in those places.
 */
export async function wipePersonalData(deps: PersonalWipeDeps): Promise<PersonalWipeResult> {
  const beforePoints = await deps.checkpoints.list();

  // Empty replace clears live rows even if file delete is delayed/failing.
  const empty = createDiaryArchive({
    createdAtMs: deps.nowMs,
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
  await deps.unitOfWork.run(async (uow) => {
    await uow.diary.replace(empty);
  });

  await deps.checkpoints.clearAll();
  await deps.reminders.cancelAll();
  await deps.appLock.clearForWipe();

  await deps.closeRuntime();
  await deps.deleteDurableStore();

  if (deps.keyStore) {
    await deps.keyStore.clearDatabaseKey();
  }
  if (deps.presence) {
    await deps.presence.clear(deps.databaseName);
  }

  return {
    wipedAtMs: deps.nowMs,
    clearedCheckpoints: beforePoints.length,
    externalExportNote:
      'Soubory přenosné zálohy nebo CSV uložené mimo aplikaci smažte ručně v jejich umístění.',
  };
}

/** Canary hunt helper for wipe tests — returns matching rows still present. */
export async function findCanaryResidues(
  unitOfWork: UnitOfWorkFactory,
  canary: string,
): Promise<string[]> {
  const hits: string[] = [];
  await unitOfWork.run(async (uow) => {
    const profiles = await uow.profiles.list();
    for (const profile of profiles) {
      if (profile.displayName.includes(canary)) hits.push(`profile:${profile.childId}`);
      const page = await uow.care.listRecent(profile.childId, 200);
      for (const event of page) {
        const blob = JSON.stringify(event);
        if (blob.includes(canary)) hits.push(`care:${event.eventId}`);
      }
    }
    const drafts = await uow.drafts.listAll();
    for (const draft of drafts) {
      if (JSON.stringify(draft).includes(canary)) hits.push(`draft:${draft.draftId}`);
    }
    const deletions = await uow.revisions.listDeletions();
    for (const deletion of deletions) {
      if (JSON.stringify(deletion).includes(canary)) hits.push(`deletion:${deletion.deletionId}`);
    }
    const meta = await uow.meta.listEntries();
    for (const entry of meta) {
      if (entry.key.includes(canary) || entry.value.includes(canary)) {
        hits.push(`meta:${entry.key}`);
      }
    }
    const projects = await uow.projects.listAll();
    for (const project of projects) {
      if (JSON.stringify(project).includes(canary)) hits.push(`project:${project.projectId}`);
    }
  });
  return hits;
}
