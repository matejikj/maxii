import {
  AppError,
  asChildId,
  asOperationId,
  asRevisionId,
  createChildProfile,
  createDiaryArchive,
  filterDiaryArchiveByScope,
  listActiveChildProfiles,
  normalizeChildProfile,
  planAddChildProfile,
  planArchiveChildProfile,
  planCareEventReassignment,
  planSwitchActiveChild,
  resolveActiveChildProfile,
  type CareEvent,
  type CareMutationCommand,
  type ChildId,
  type ChildProfile,
  type DiaryArchive,
  type DiaryExportScope,
  type IdGenerator,
  type UnitOfWorkFactory,
} from '../domain';
import { buildEditCareCommand } from './careEdit';
import { META_ACTIVE_CHILD_ID } from './personalBootstrap';

export type MultiChildWorkspaceSnapshot = {
  profiles: ChildProfile[];
  activeProfiles: ChildProfile[];
  activeChild: ChildProfile | null;
};

export async function loadMultiChildWorkspace(
  unitOfWork: UnitOfWorkFactory,
): Promise<MultiChildWorkspaceSnapshot> {
  return unitOfWork.run(async (uow) => {
    const profiles = (await uow.profiles.list()).map(normalizeChildProfile);
    const activeId = await uow.meta.get(META_ACTIVE_CHILD_ID);
    const activeChild = resolveActiveChildProfile(profiles, activeId);
    return {
      profiles,
      activeProfiles: listActiveChildProfiles(profiles),
      activeChild,
    };
  });
}

export async function switchActiveChild(
  unitOfWork: UnitOfWorkFactory,
  childId: ChildId,
): Promise<ChildProfile> {
  return unitOfWork.run(async (uow) => {
    const profiles = await uow.profiles.list();
    const next = planSwitchActiveChild({ profiles, childId });
    await uow.meta.set(META_ACTIVE_CHILD_ID, next.childId);
    return next;
  });
}

export async function addChildProfile(
  unitOfWork: UnitOfWorkFactory,
  deps: {
    ids: IdGenerator;
    displayName: string;
    birthDate?: ChildProfile['birthDate'];
    summaryTimeZone: string;
    /** When true, the new child becomes the writing context immediately. */
    activate?: boolean;
  },
): Promise<ChildProfile> {
  return unitOfWork.run(async (uow) => {
    const profiles = await uow.profiles.list();
    const planned = planAddChildProfile({
      profiles,
      childId: asChildId(deps.ids.createId('child')),
      displayName: deps.displayName,
      birthDate: deps.birthDate ?? null,
      summaryTimeZone: deps.summaryTimeZone,
    });
    await uow.profiles.save(planned.profile);
    if (deps.activate !== false) {
      await uow.meta.set(META_ACTIVE_CHILD_ID, planned.nextActiveChildId);
    }
    return planned.profile;
  });
}

export async function archiveChildProfile(
  unitOfWork: UnitOfWorkFactory,
  input: { childId: ChildId; archivedAtMs: number },
): Promise<{ archived: ChildProfile; activeChild: ChildProfile }> {
  return unitOfWork.run(async (uow) => {
    const profiles = await uow.profiles.list();
    const activeId = await uow.meta.get(META_ACTIVE_CHILD_ID);
    const planned = planArchiveChildProfile({
      profiles,
      childId: input.childId,
      archivedAtMs: input.archivedAtMs,
      activeChildId: activeId,
    });
    await uow.profiles.save(planned.archived);
    await uow.meta.set(META_ACTIVE_CHILD_ID, planned.nextActiveChildId);
    const activeChild = await uow.profiles.get(planned.nextActiveChildId);
    if (!activeChild) {
      throw new AppError('INTERNAL', 'Active child missing after archive', {
        details: { reason: 'active_missing' },
      });
    }
    return { archived: planned.archived, activeChild: normalizeChildProfile(activeChild) };
  });
}

export async function updateChildProfileFields(
  unitOfWork: UnitOfWorkFactory,
  profile: ChildProfile,
): Promise<ChildProfile> {
  return unitOfWork.run(async (uow) => {
    const current = await uow.profiles.get(profile.childId);
    if (!current) {
      throw new AppError('NOT_FOUND', 'Child profile was not found', {
        details: { reason: 'profile_missing' },
      });
    }
    const normalizedCurrent = normalizeChildProfile(current);
    const next = createChildProfile({
      childId: profile.childId,
      displayName: profile.displayName,
      birthDate: profile.birthDate,
      summaryTimeZone: profile.settings.summaryTimeZone,
      status: normalizedCurrent.status,
      archivedAtMs: normalizedCurrent.archivedAtMs,
    });
    await uow.profiles.save(next);
    return next;
  });
}

/**
 * Conscious move of a care row to another active child. Keeps eventId and
 * authorship fields; bumps revision under optimistic concurrency.
 */
export function buildReassignCareChildCommand(input: {
  event: CareEvent;
  targetChildId: ChildId;
  profiles: readonly ChildProfile[];
  operationId: string;
  revisionId: string;
  intentCapturedAtMs: number;
}): CareMutationCommand {
  const plan = planCareEventReassignment({
    event: input.event,
    targetChildId: input.targetChildId,
    profiles: input.profiles,
  });
  if (plan.sameChild) {
    throw new AppError('VALIDATION', 'Care event already belongs to that child', {
      details: { reason: 'same_child' },
    });
  }
  const command = buildEditCareCommand({
    event: input.event,
    expectedRevisionId: input.event.revisionId,
    operationId: asOperationId(input.operationId),
    revisionId: asRevisionId(input.revisionId),
    intentCapturedAtMs: input.intentCapturedAtMs,
  });
  return { ...command, childId: plan.toChildId };
}

export async function captureScopedDiaryArchive(input: {
  unitOfWork: UnitOfWorkFactory;
  nowMs: number;
  scope: DiaryExportScope;
  schemaCompatibility?: number;
}): Promise<DiaryArchive> {
  const full = await input.unitOfWork.run((uow) =>
    uow.diary.capture({
      createdAtMs: input.nowMs,
      schemaCompatibility: input.schemaCompatibility ?? 8,
    }),
  );
  return filterDiaryArchiveByScope(full, input.scope);
}

/**
 * Remove one child's live diary rows while leaving every other profile intact.
 * Does not delete the durable database file or recovery vault for siblings.
 */
export async function wipeSingleChildDiaryScope(input: {
  unitOfWork: UnitOfWorkFactory;
  childId: ChildId;
  nowMs: number;
}): Promise<{ removedCareEvents: number; remainingActiveChildId: ChildId }> {
  return input.unitOfWork.run(async (uow) => {
    const full = await uow.diary.capture({
      createdAtMs: input.nowMs,
      schemaCompatibility: 8,
    });
    const remainingProfiles = full.profiles
      .map(normalizeChildProfile)
      .filter((profile) => profile.childId !== input.childId);
    if (remainingProfiles.length === 0) {
      throw new AppError('VALIDATION', 'Refusing to wipe the last child via scoped erase', {
        details: { reason: 'last_child_scope' },
      });
    }
    const remainingActive = listActiveChildProfiles(remainingProfiles);
    if (remainingActive.length === 0) {
      throw new AppError('VALIDATION', 'Scoped wipe would leave no active child', {
        details: { reason: 'no_active_after_wipe' },
      });
    }
    const keepIds = new Set(remainingProfiles.map((profile) => profile.childId));
    // Diary replace clears project/portfolio/share tables; re-save siblings' rows.
    const keptProjects = (await uow.projects.listAll()).filter((project) =>
      keepIds.has(project.childId),
    );
    const keptPortfolio = (await uow.portfolio.listAll()).filter((item) =>
      keepIds.has(item.childId),
    );
    const wipedProjectIds = new Set(
      (await uow.projects.listAll())
        .filter((project) => project.childId === input.childId)
        .map((project) => project.projectId),
    );
    const keptShares = (await uow.shares.listAll()).filter(
      (share) => !wipedProjectIds.has(share.sourceProjectId),
    );
    const keptSuggestions = (await uow.parentSuggestions.listAll()).filter((suggestion) =>
      keepIds.has(suggestion.childId),
    );
    const careEvents = full.careEvents.filter((event) => keepIds.has(event.childId));
    const sessions = full.sessions.filter((session) => keepIds.has(session.childId));
    const drafts = full.drafts.filter((draft) => keepIds.has(draft.childId));
    const removedCareEvents = full.careEvents.length - careEvents.length;
    const entityIds = new Set<string>([
      ...careEvents.map((event) => event.eventId),
      ...sessions.map((session) => session.sessionId),
      ...drafts.map((draft) => draft.draftId),
      ...remainingProfiles.map((profile) => profile.childId),
    ]);
    const revisions = full.revisions.filter((revision) => entityIds.has(revision.entityId));
    const receipts = full.receipts.filter((receipt) =>
      receipt.entityIds.some((id) => entityIds.has(id)),
    );
    const deletions = full.deletions.filter((deletion) => entityIds.has(deletion.entityId));
    const nextActive = resolveActiveChildProfile(
      remainingProfiles,
      remainingActive[0]!.childId,
    )!;
    const meta = [
      ...full.meta.filter((entry) => entry.key !== META_ACTIVE_CHILD_ID),
      { key: META_ACTIVE_CHILD_ID, value: nextActive.childId },
    ];
    const nextArchive = createDiaryArchive({
      createdAtMs: input.nowMs,
      schemaCompatibility: 8,
      profiles: remainingProfiles,
      careEvents,
      sessions,
      drafts,
      revisions,
      receipts,
      deletions,
      meta,
    });
    await uow.diary.replace(nextArchive);
    for (const project of keptProjects) {
      await uow.projects.save(project);
    }
    for (const item of keptPortfolio) {
      await uow.portfolio.save(item);
    }
    for (const share of keptShares) {
      await uow.shares.save(share);
    }
    for (const suggestion of keptSuggestions) {
      await uow.parentSuggestions.save(suggestion);
    }
    for (const profile of remainingProfiles) {
      await uow.search.rebuildForChild(profile.childId);
    }
    return {
      removedCareEvents,
      remainingActiveChildId: asChildId(nextActive.childId),
    };
  });
}

export async function rebuildSearchAfterReassign(
  unitOfWork: UnitOfWorkFactory,
  fromChildId: ChildId,
  toChildId: ChildId,
): Promise<void> {
  await unitOfWork.run(async (uow) => {
    await uow.search.rebuildForChild(fromChildId);
    if (toChildId !== fromChildId) {
      await uow.search.rebuildForChild(toChildId);
    }
  });
}
