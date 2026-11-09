import {
  AppError,
  asEntityId,
  asRevisionId,
  assertProjectAccess,
  createFamilyGuidedBlankProject,
  createFamilyGuidedProject,
  currentProjectStep,
  describeScopeForCaregiver,
  groupProjectsByStatus,
  isChildPrivateModeActive,
  listTodayActiveProjects,
  markProjectStep,
  normalizeProjectRow,
  transitionProjectStatus,
  presentSelfManagementPreparation,
  updateProjectReflection,
  updateProjectSourceNotes,
  updateProjectVariantNotes,
  type ActorId,
  type ChildId,
  type EntityId,
  type FamilyGuidedBlankStyle,
  type IdGenerator,
  type Instant,
  type Project,
  type ProjectSourceNotes,
  type ProjectStatus,
  type ProjectStep,
  type ProjectTemplateRevision,
  type ProjectTemplateRevisionId,
  type ProjectVariantNotes,
  type UnitOfWorkFactory,
} from '../domain';
import {
  describeProjectCohortAvailability,
  findProjectTemplateRevision,
  listProjectTemplatesByCohort,
  PROJECT_COHORT_8_11_PACK,
  PROJECT_COHORT_12_14_PACK,
  PROJECT_COHORT_15_17_PACK,
  PROJECT_TEMPLATES_PUBLISHED,
  searchPublishedProjectTemplates,
} from '../content/catalog/projectTemplatesPublished';

export type FamilyGuidedProjectView = {
  project: Project;
  scopeLabel: string;
  templateTitle: string | null;
  nextStepText: string | null;
  cohort: ProjectTemplateRevision['cohort'] | 'blank';
};

export type FamilyGuidedShelfView = {
  active: FamilyGuidedProjectView[];
  paused: FamilyGuidedProjectView[];
  closed: FamilyGuidedProjectView[];
};

function caregiverAccess(project: Project, principalAppUserId: ActorId | null) {
  const namedOwner =
    principalAppUserId != null &&
    (project.creatorAppUserId === principalAppUserId ||
      project.ownerAppUserId === principalAppUserId);
  // Personal mode has no login — unowned familyGuided rows stay editable locally.
  const personalLocalOwner =
    project.scope === 'familyGuided' &&
    project.creatorAppUserId == null &&
    project.ownerAppUserId == null;
  const principalKind =
    namedOwner || personalLocalOwner ? ('owner' as const) : ('other_adult_caregiver' as const);
  return {
    principalKind,
    principalAppUserId,
    childPrivateModeActive: isChildPrivateModeActive(),
    project,
  };
}

function toView(project: Project): FamilyGuidedProjectView {
  const normalized = normalizeProjectRow(project);
  const template = normalized.templateRevisionId
    ? findProjectTemplateRevision(normalized.templateRevisionId)
    : null;
  return {
    project: normalized,
    scopeLabel: describeScopeForCaregiver(normalized.scope),
    templateTitle: template?.title ?? null,
    nextStepText: currentProjectStep(normalized)?.text ?? null,
    cohort: template?.cohort ?? 'blank',
  };
}

/** Published templates available offline for caregiver-led shared projects. */
export function listFamilyGuidedTemplates(): ProjectTemplateRevision[] {
  return [...PROJECT_TEMPLATES_PUBLISHED];
}

/** First verified 8–11 cohort — primary discovery for caregiver-led starts. */
export function listFamilyGuidedTemplatesForCohort8to11(): ProjectTemplateRevision[] {
  return listProjectTemplatesByCohort('8-11');
}

export function describeFamilyGuidedCohort8to11Availability() {
  return describeProjectCohortAvailability('8-11');
}

export function familyGuidedCohort8to11Pack() {
  return PROJECT_COHORT_8_11_PACK;
}

/** Verified 12–14 cohort — more own choice and variant comparison. */
export function listFamilyGuidedTemplatesForCohort12to14(): ProjectTemplateRevision[] {
  return listProjectTemplatesByCohort('12-14');
}

export function describeFamilyGuidedCohort12to14Availability() {
  return describeProjectCohortAvailability('12-14');
}

export function familyGuidedCohort12to14Pack() {
  return PROJECT_COHORT_12_14_PACK;
}

/** Verified 15–17 cohort — own brief, sources, and self-management preparation. */
export function listFamilyGuidedTemplatesForCohort15to17(): ProjectTemplateRevision[] {
  return listProjectTemplatesByCohort('15-17');
}

export function describeFamilyGuidedCohort15to17Availability() {
  return describeProjectCohortAvailability('15-17');
}

export function familyGuidedCohort15to17Pack() {
  return PROJECT_COHORT_15_17_PACK;
}

/** Truthful preview of later self-management — never a silent family-history handoff. */
export function describeFamilyGuidedSelfManagementPreparation() {
  return presentSelfManagementPreparation();
}

export function searchFamilyGuidedTemplates(query: string): ProjectTemplateRevision[] {
  return searchPublishedProjectTemplates(query);
}

export async function listFamilyGuidedProjectsForChild(
  unitOfWork: UnitOfWorkFactory,
  input: { childId: ChildId; principalAppUserId?: ActorId | null },
): Promise<FamilyGuidedProjectView[]> {
  return unitOfWork.run(async (uow) => {
    const rows = await uow.projects.listByChild(input.childId);
    const views: FamilyGuidedProjectView[] = [];
    for (const project of rows) {
      if (project.scope !== 'familyGuided') continue;
      assertProjectAccess('list', caregiverAccess(project, input.principalAppUserId ?? null));
      views.push(toView(project));
    }
    return views;
  });
}

export async function listTodayFamilyGuidedProjects(
  unitOfWork: UnitOfWorkFactory,
  input: { childId: ChildId; principalAppUserId?: ActorId | null },
): Promise<FamilyGuidedProjectView[]> {
  const all = await listFamilyGuidedProjectsForChild(unitOfWork, input);
  return listTodayActiveProjects(all.map((view) => view.project)).map(toView);
}

export async function listFamilyGuidedProjectShelves(
  unitOfWork: UnitOfWorkFactory,
  input: { childId: ChildId; principalAppUserId?: ActorId | null },
): Promise<FamilyGuidedShelfView> {
  const all = await listFamilyGuidedProjectsForChild(unitOfWork, input);
  const grouped = groupProjectsByStatus(all.map((view) => view.project));
  return {
    active: grouped.active.map(toView),
    paused: grouped.paused.map(toView),
    closed: grouped.closed.map(toView),
  };
}

export async function createFamilyGuidedProjectFromTemplate(input: {
  unitOfWork: UnitOfWorkFactory;
  ids: IdGenerator;
  now: Instant;
  childId: ChildId;
  templateRevisionId: ProjectTemplateRevisionId | string;
  creatorAppUserId?: ActorId | null;
  familyId?: string | null;
  title?: string;
  intent?: string;
}): Promise<FamilyGuidedProjectView> {
  const template = findProjectTemplateRevision(String(input.templateRevisionId));
  if (!template) {
    throw new AppError('NOT_FOUND', 'Project template revision was not found', {
      details: { reason: 'template_missing', revisionId: String(input.templateRevisionId) },
    });
  }

  const project = createFamilyGuidedProject({
    projectId: asEntityId(input.ids.createId('proj')),
    revisionId: asRevisionId(input.ids.createId('rev')),
    childId: input.childId,
    creatorAppUserId: input.creatorAppUserId ?? null,
    familyId: input.familyId ?? null,
    template,
    ...(input.title != null ? { title: input.title } : {}),
    ...(input.intent != null ? { intent: input.intent } : {}),
    now: input.now,
    createStepId: (index) => asEntityId(input.ids.createId(`pstep${index}`)),
  });

  assertProjectAccess(
    'create',
    caregiverAccess(project, input.creatorAppUserId ?? null),
  );

  await input.unitOfWork.run(async (uow) => {
    await uow.projects.save(project);
  });
  return toView(project);
}

/** Blank own idea — same familyGuided scope as a template start. */
export async function createFamilyGuidedBlankIdea(input: {
  unitOfWork: UnitOfWorkFactory;
  ids: IdGenerator;
  now: Instant;
  childId: ChildId;
  title: string;
  intent?: string;
  style?: FamilyGuidedBlankStyle;
  creatorAppUserId?: ActorId | null;
  familyId?: string | null;
}): Promise<FamilyGuidedProjectView> {
  const project = createFamilyGuidedBlankProject({
    projectId: asEntityId(input.ids.createId('proj')),
    revisionId: asRevisionId(input.ids.createId('rev')),
    childId: input.childId,
    creatorAppUserId: input.creatorAppUserId ?? null,
    familyId: input.familyId ?? null,
    title: input.title,
    ...(input.intent != null ? { intent: input.intent } : {}),
    style: input.style ?? 'simple',
    now: input.now,
    createStepId: (index) => asEntityId(input.ids.createId(`pstep${index}`)),
  });

  assertProjectAccess(
    'create',
    caregiverAccess(project, input.creatorAppUserId ?? null),
  );

  await input.unitOfWork.run(async (uow) => {
    await uow.projects.save(project);
  });
  return toView(project);
}

export async function updateFamilyGuidedProjectStatus(input: {
  unitOfWork: UnitOfWorkFactory;
  ids: IdGenerator;
  now: Instant;
  projectId: EntityId;
  nextStatus: ProjectStatus;
  principalAppUserId?: ActorId | null;
}): Promise<FamilyGuidedProjectView> {
  return input.unitOfWork.run(async (uow) => {
    const current = await uow.projects.getById(input.projectId);
    if (!current || current.scope !== 'familyGuided') {
      throw new AppError('NOT_FOUND', 'Family project was not found', {
        details: { reason: 'project_missing' },
      });
    }
    assertProjectAccess('update', caregiverAccess(current, input.principalAppUserId ?? null));
    const next = transitionProjectStatus(
      current,
      input.nextStatus,
      asRevisionId(input.ids.createId('rev')),
      input.now,
    );
    await uow.projects.save(next);
    return toView(next);
  });
}

export async function markFamilyGuidedProjectStep(input: {
  unitOfWork: UnitOfWorkFactory;
  ids: IdGenerator;
  now: Instant;
  projectId: EntityId;
  stepId: EntityId;
  status: ProjectStep['status'];
  principalAppUserId?: ActorId | null;
}): Promise<FamilyGuidedProjectView> {
  return input.unitOfWork.run(async (uow) => {
    const current = await uow.projects.getById(input.projectId);
    if (!current || current.scope !== 'familyGuided') {
      throw new AppError('NOT_FOUND', 'Family project was not found', {
        details: { reason: 'project_missing' },
      });
    }
    assertProjectAccess('update', caregiverAccess(current, input.principalAppUserId ?? null));
    const next = markProjectStep(
      current,
      input.stepId,
      input.status,
      asRevisionId(input.ids.createId('rev')),
      input.now,
    );
    await uow.projects.save(next);
    return toView(next);
  });
}

export async function saveFamilyGuidedProjectReflection(input: {
  unitOfWork: UnitOfWorkFactory;
  ids: IdGenerator;
  now: Instant;
  projectId: EntityId;
  reflection: string | null;
  principalAppUserId?: ActorId | null;
}): Promise<FamilyGuidedProjectView> {
  return input.unitOfWork.run(async (uow) => {
    const current = await uow.projects.getById(input.projectId);
    if (!current || current.scope !== 'familyGuided') {
      throw new AppError('NOT_FOUND', 'Family project was not found', {
        details: { reason: 'project_missing' },
      });
    }
    assertProjectAccess('update', caregiverAccess(current, input.principalAppUserId ?? null));
    const next = updateProjectReflection(
      normalizeProjectRow(current),
      input.reflection,
      asRevisionId(input.ids.createId('rev')),
      input.now,
    );
    await uow.projects.save(next);
    return toView(next);
  });
}

/**
 * Save two compared options on the live project. Does not publish a share and
 * does not change privacy — caregivers still choose an explicit share body.
 */
export async function saveFamilyGuidedVariantNotes(input: {
  unitOfWork: UnitOfWorkFactory;
  ids: IdGenerator;
  now: Instant;
  projectId: EntityId;
  notes: ProjectVariantNotes | null;
  principalAppUserId?: ActorId | null;
}): Promise<FamilyGuidedProjectView> {
  return input.unitOfWork.run(async (uow) => {
    const current = await uow.projects.getById(input.projectId);
    if (!current || current.scope !== 'familyGuided') {
      throw new AppError('NOT_FOUND', 'Family project was not found', {
        details: { reason: 'project_missing' },
      });
    }
    assertProjectAccess('update', caregiverAccess(current, input.principalAppUserId ?? null));
    const next = updateProjectVariantNotes(
      normalizeProjectRow(current),
      input.notes,
      asRevisionId(input.ids.createId('rev')),
      input.now,
    );
    await uow.projects.save(next);
    return toView(next);
  });
}

/**
 * Save one research/source card on the live project. Does not publish a share
 * and never upgrades an offline note into a confirmed online offer.
 */
export async function saveFamilyGuidedSourceNotes(input: {
  unitOfWork: UnitOfWorkFactory;
  ids: IdGenerator;
  now: Instant;
  projectId: EntityId;
  notes: ProjectSourceNotes | null;
  principalAppUserId?: ActorId | null;
}): Promise<FamilyGuidedProjectView> {
  return input.unitOfWork.run(async (uow) => {
    const current = await uow.projects.getById(input.projectId);
    if (!current || current.scope !== 'familyGuided') {
      throw new AppError('NOT_FOUND', 'Family project was not found', {
        details: { reason: 'project_missing' },
      });
    }
    assertProjectAccess('update', caregiverAccess(current, input.principalAppUserId ?? null));
    const next = updateProjectSourceNotes(
      normalizeProjectRow(current),
      input.notes,
      asRevisionId(input.ids.createId('rev')),
      input.now,
    );
    await uow.projects.save(next);
    return toView(next);
  });
}
