import {
  AppError,
  CHILD_PRIVATE_MODE_GATES,
  CHILD_SHELL_FIRST_ENTRY,
  CHILD_SHELL_FORBIDDEN_ROUTES,
  CHILD_SHELL_TABS,
  asEntityId,
  asRevisionId,
  attemptChildShellActivation,
  createChildPrivateProject,
  currentProjectStep,
  groupProjectsByStatus,
  isChildPrivateModeActive,
  presentChildPrivateModeStatus,
  resolveRootShellKind,
  selectChildShellTodayProjects,
  type ActorId,
  type ChildId,
  type ChildShellActivationGates,
  type ChildShellBlueprint,
  type ChildShellSession,
  type EntityId,
  type Instant,
  type Project,
  type ProjectTemplateRevision,
  type RevisionId,
  type UnitOfWorkFactory,
} from '../domain';

export type ChildShellAvailability = ChildShellBlueprint & {
  readonly headline: string;
  readonly detail: string;
  readonly blockers: ReturnType<typeof presentChildPrivateModeStatus>['blockers'];
};

/**
 * Caregiver Settings / future activation UI: describe the child shell honestly
 * while production gates keep it unavailable.
 */
export function presentChildShellAvailability(
  gateOverrides: Partial<ChildShellActivationGates> = {},
): ChildShellAvailability {
  const status = presentChildPrivateModeStatus(gateOverrides);
  return {
    available: status.active,
    tabs: CHILD_SHELL_TABS,
    firstEntry: CHILD_SHELL_FIRST_ENTRY,
    forbiddenRoutes: CHILD_SHELL_FORBIDDEN_ROUTES,
    profileInHeader: true,
    fifthTab: false,
    headline: status.headline,
    detail: status.detail,
    blockers: status.blockers,
  };
}

/**
 * Production personal builds always resolve caregiver. Tests may pass an
 * already-activated session together with open gates.
 */
export function resolveActiveRootShell(input?: {
  readonly session?: ChildShellSession | null;
  readonly gateOverrides?: Partial<ChildShellActivationGates>;
}): 'caregiver' | 'child' {
  const gates = { ...CHILD_PRIVATE_MODE_GATES, ...input?.gateOverrides };
  const modeActive = presentChildPrivateModeStatus(gates).active;
  return resolveRootShellKind({
    childSession: input?.session ?? null,
    childPrivateModeActive: modeActive,
  });
}

export function tryActivateChildShell(input: {
  readonly appUserId: ActorId;
  readonly displayAlias: string;
  readonly linkedChildProfileId?: ChildId | null | undefined;
  readonly firstEntryCompleted?: boolean | undefined;
  readonly gateOverrides?: Partial<ChildShellActivationGates>;
}) {
  return attemptChildShellActivation({
    gates: { ...CHILD_PRIVATE_MODE_GATES, ...input.gateOverrides },
    appUserId: input.appUserId,
    displayAlias: input.displayAlias,
    linkedChildProfileId: input.linkedChildProfileId,
    firstEntryCompleted: input.firstEntryCompleted,
  });
}

export type ChildShellProjectCard = {
  readonly projectId: string;
  readonly title: string;
  readonly status: Project['status'];
  readonly scopeLabel: 'Jen pro mě';
  readonly currentStepText: string | null;
};

function toCard(project: Project): ChildShellProjectCard {
  const step = currentProjectStep(project);
  return {
    projectId: project.projectId,
    title: project.title,
    status: project.status,
    scopeLabel: 'Jen pro mě',
    currentStepText: step?.text ?? null,
  };
}

/**
 * Read models for the child shell. Refuses quietly when private mode is off so
 * caregiver UI cannot accidentally render a private list.
 */
export async function listChildShellTodayCards(input: {
  readonly unitOfWork: UnitOfWorkFactory;
  readonly ownerAppUserId: ActorId;
  readonly childPrivateModeActive?: boolean;
}): Promise<ChildShellProjectCard[]> {
  const active = input.childPrivateModeActive ?? isChildPrivateModeActive();
  if (!active) return [];
  return input.unitOfWork.run(async (uow) => {
    const all = await uow.projects.listAll();
    return selectChildShellTodayProjects(all, input.ownerAppUserId).map(toCard);
  });
}

export async function listChildShellProjectShelves(input: {
  readonly unitOfWork: UnitOfWorkFactory;
  readonly ownerAppUserId: ActorId;
  readonly childPrivateModeActive?: boolean;
}): Promise<{
  readonly active: ChildShellProjectCard[];
  readonly paused: ChildShellProjectCard[];
  readonly closed: ChildShellProjectCard[];
}> {
  const active = input.childPrivateModeActive ?? isChildPrivateModeActive();
  if (!active) {
    return { active: [], paused: [], closed: [] };
  }
  return input.unitOfWork.run(async (uow) => {
    const mine = (await uow.projects.listAll()).filter(
      (project) =>
        project.scope === 'childPrivate' && project.ownerAppUserId === input.ownerAppUserId,
    );
    const groups = groupProjectsByStatus(mine);
    return {
      active: groups.active.map(toCard),
      paused: groups.paused.map(toCard),
      closed: groups.closed.map(toCard),
    };
  });
}

export async function createChildShellBlankProject(input: {
  readonly unitOfWork: UnitOfWorkFactory;
  readonly projectId?: EntityId;
  readonly revisionId?: RevisionId;
  readonly childId: ChildId;
  readonly ownerAppUserId: ActorId;
  readonly title: string;
  readonly intent: string;
  readonly now: Instant;
  readonly template?: ProjectTemplateRevision | null;
  readonly childPrivateModeActive?: boolean;
}): Promise<Project> {
  const active = input.childPrivateModeActive ?? isChildPrivateModeActive();
  if (!active) {
    throw new AppError('UNAVAILABLE', 'Child private workspace is not activated', {
      details: { reason: 'child_mode_inactive' },
    });
  }
  return input.unitOfWork.run(async (uow) => {
    const project = createChildPrivateProject({
      projectId: input.projectId ?? asEntityId(`proj_${input.now.epochMs}`),
      revisionId: input.revisionId ?? asRevisionId(`rev_${input.now.epochMs}`),
      childId: input.childId,
      ownerAppUserId: input.ownerAppUserId,
      template: input.template ?? null,
      title: input.title,
      intent: input.intent,
      now: input.now,
      createStepId: (index) => asEntityId(`step_${input.now.epochMs}_${index}`),
      childPrivateModeActive: true,
    });
    await uow.projects.save(project);
    return project;
  });
}
