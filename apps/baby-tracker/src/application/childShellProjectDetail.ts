import {
  AppError,
  asRevisionId,
  currentProjectStep,
  markProjectStep,
  normalizeProjectRow,
  transitionProjectStatus,
  updateProjectReflection,
  type ActorId,
  type EntityId,
  type IdGenerator,
  type Instant,
  type Project,
  type ProjectStatus,
  type ProjectStep,
  type UnitOfWorkFactory,
} from '../domain';

export type ChildShellProjectDetailView = {
  readonly projectId: string;
  readonly title: string;
  readonly intent: string;
  readonly status: Project['status'];
  readonly scopeLabel: 'Jen pro mě';
  readonly currentStep: {
    readonly stepId: string;
    readonly text: string;
    readonly status: ProjectStep['status'];
  } | null;
  readonly steps: readonly {
    readonly stepId: string;
    readonly order: number;
    readonly text: string;
    readonly status: ProjectStep['status'];
  }[];
  readonly reflection: string | null;
  /** True when more steps exist beyond the current one — UI may expand the rest. */
  readonly hasMoreSteps: boolean;
};

function requireActiveMode(childPrivateModeActive: boolean): void {
  if (!childPrivateModeActive) {
    throw new AppError('UNAVAILABLE', 'Child private workspace is not activated', {
      details: { reason: 'child_mode_inactive' },
    });
  }
}

function assertOwnedPrivate(project: Project | null, ownerAppUserId: ActorId): Project {
  if (!project || project.scope !== 'childPrivate') {
    throw new AppError('NOT_FOUND', 'Private project was not found', {
      details: { reason: 'project_missing' },
    });
  }
  if (project.ownerAppUserId !== ownerAppUserId) {
    throw new AppError('FORBIDDEN', 'Only the project owner may open this detail', {
      details: { reason: 'not_project_owner' },
    });
  }
  return normalizeProjectRow(project);
}

function toDetailView(project: Project): ChildShellProjectDetailView {
  const current = currentProjectStep(project);
  return {
    projectId: project.projectId,
    title: project.title,
    intent: project.intent,
    status: project.status,
    scopeLabel: 'Jen pro mě',
    currentStep: current
      ? { stepId: current.stepId, text: current.text, status: current.status }
      : null,
    steps: project.steps.map((step) => ({
      stepId: step.stepId,
      order: step.order,
      text: step.text,
      status: step.status,
    })),
    reflection: project.reflection,
    hasMoreSteps: project.steps.length > 1,
  };
}

/**
 * Owner-only private project detail for the child shell. Refuses when mode is
 * closed so caregiver UI cannot probe titles by project id.
 */
export async function loadChildShellProjectDetail(input: {
  readonly unitOfWork: UnitOfWorkFactory;
  readonly projectId: EntityId;
  readonly ownerAppUserId: ActorId;
  readonly childPrivateModeActive?: boolean;
}): Promise<ChildShellProjectDetailView> {
  const active = input.childPrivateModeActive ?? false;
  requireActiveMode(active);
  return input.unitOfWork.run(async (uow) => {
    const current = assertOwnedPrivate(
      await uow.projects.getById(input.projectId),
      input.ownerAppUserId,
    );
    return toDetailView(current);
  });
}

export async function continueChildShellProject(input: {
  readonly unitOfWork: UnitOfWorkFactory;
  readonly ids: IdGenerator;
  readonly now: Instant;
  readonly projectId: EntityId;
  readonly ownerAppUserId: ActorId;
  readonly childPrivateModeActive?: boolean;
}): Promise<ChildShellProjectDetailView> {
  const active = input.childPrivateModeActive ?? false;
  requireActiveMode(active);
  return input.unitOfWork.run(async (uow) => {
    const current = assertOwnedPrivate(
      await uow.projects.getById(input.projectId),
      input.ownerAppUserId,
    );
    // "Pokračovat" resumes idea/paused/closed into active, then marks one pending step.
    let next =
      current.status === 'active'
        ? current
        : transitionProjectStatus(
            current,
            'active',
            asRevisionId(input.ids.createId('rev')),
            input.now,
          );
    const pending = currentProjectStep(next);
    if (pending) {
      next = markProjectStep(
        next,
        pending.stepId,
        'tried',
        asRevisionId(input.ids.createId('rev')),
        input.now,
      );
    }
    await uow.projects.save(next);
    return toDetailView(next);
  });
}

export async function pauseChildShellProject(input: {
  readonly unitOfWork: UnitOfWorkFactory;
  readonly ids: IdGenerator;
  readonly now: Instant;
  readonly projectId: EntityId;
  readonly ownerAppUserId: ActorId;
  readonly childPrivateModeActive?: boolean;
}): Promise<ChildShellProjectDetailView> {
  return mutateStatus(input, 'paused');
}

export async function closeChildShellProject(input: {
  readonly unitOfWork: UnitOfWorkFactory;
  readonly ids: IdGenerator;
  readonly now: Instant;
  readonly projectId: EntityId;
  readonly ownerAppUserId: ActorId;
  readonly childPrivateModeActive?: boolean;
}): Promise<ChildShellProjectDetailView> {
  return mutateStatus(input, 'closed');
}

async function mutateStatus(
  input: {
    readonly unitOfWork: UnitOfWorkFactory;
    readonly ids: IdGenerator;
    readonly now: Instant;
    readonly projectId: EntityId;
    readonly ownerAppUserId: ActorId;
    readonly childPrivateModeActive?: boolean;
  },
  nextStatus: Extract<ProjectStatus, 'paused' | 'closed'>,
): Promise<ChildShellProjectDetailView> {
  const active = input.childPrivateModeActive ?? false;
  requireActiveMode(active);
  return input.unitOfWork.run(async (uow) => {
    const current = assertOwnedPrivate(
      await uow.projects.getById(input.projectId),
      input.ownerAppUserId,
    );
    const next = transitionProjectStatus(
      current,
      nextStatus,
      asRevisionId(input.ids.createId('rev')),
      input.now,
    );
    await uow.projects.save(next);
    return toDetailView(next);
  });
}

/**
 * Optional reflection — empty string clears to null. Never required to continue.
 */
export async function saveChildShellProjectReflection(input: {
  readonly unitOfWork: UnitOfWorkFactory;
  readonly ids: IdGenerator;
  readonly now: Instant;
  readonly projectId: EntityId;
  readonly ownerAppUserId: ActorId;
  readonly reflection: string | null;
  readonly childPrivateModeActive?: boolean;
}): Promise<ChildShellProjectDetailView> {
  const active = input.childPrivateModeActive ?? false;
  requireActiveMode(active);
  return input.unitOfWork.run(async (uow) => {
    const current = assertOwnedPrivate(
      await uow.projects.getById(input.projectId),
      input.ownerAppUserId,
    );
    const reflection =
      input.reflection == null || input.reflection.trim().length === 0
        ? null
        : input.reflection.trim();
    const next = updateProjectReflection(
      current,
      reflection,
      asRevisionId(input.ids.createId('rev')),
      input.now,
    );
    await uow.projects.save(next);
    return toDetailView(next);
  });
}
