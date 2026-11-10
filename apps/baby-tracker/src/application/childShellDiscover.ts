import {
  AppError,
  createChildPrivateProject,
  dismissParentSuggestion,
  isChildPrivateModeActive,
  asEntityId,
  asRevisionId,
  type ActorId,
  type ChildId,
  type EntityId,
  type IdGenerator,
  type Instant,
  type OperationId,
  type ParentSuggestion,
  type Project,
  type ProjectTemplateRevision,
  type UnitOfWorkFactory,
} from '../domain';
import {
  PROJECT_TEMPLATES_PUBLISHED,
  searchPublishedProjectTemplates,
} from '../content/catalog/projectTemplatesPublished';
import {
  enqueueAfterChildPrivateProjectSave,
  operationIdOrFallback,
  type ChildPrivateSyncEnqueuePort,
} from './childPrivateSyncEnqueuePort';

export type ChildShellDiscoverTemplateCard = {
  readonly revisionId: string;
  readonly title: string;
  readonly theme: string;
  readonly cohort: ProjectTemplateRevision['cohort'];
  /** Human-readable origin of the published pack — never a personal diary claim. */
  readonly originLabel: string;
  readonly privacyNote: string;
};

export type ChildShellParentSuggestionCard = {
  readonly suggestionId: string;
  readonly title: string;
  readonly note: string | null;
  readonly status: ParentSuggestion['status'];
  readonly sectionLabel: 'Návrh od pečující osoby';
};

function originLabel(template: ProjectTemplateRevision): string {
  const source = template.sources[0];
  if (!source) return 'Vydaná offline šablona';
  return `${source.label} · ověřeno ${source.checkedOn}`;
}

function toTemplateCard(template: ProjectTemplateRevision): ChildShellDiscoverTemplateCard {
  return {
    revisionId: template.revisionId,
    title: template.title,
    theme: template.theme,
    cohort: template.cohort,
    originLabel: originLabel(template),
    privacyNote: template.privacyNote,
  };
}

/**
 * Local catalog for the child Discover tab. Published templates stay available
 * as read-only cards even when private mode is closed; starting a project still
 * requires an active child workspace.
 */
export function listChildShellDiscoverTemplates(query = ''): ChildShellDiscoverTemplateCard[] {
  return searchPublishedProjectTemplates(query).map(toTemplateCard);
}

export function countPublishedDiscoverTemplates(): number {
  return PROJECT_TEMPLATES_PUBLISHED.length;
}

/**
 * Parent suggestions stay in a separate list so they are never mixed into the
 * published template catalog. Empty when private mode is off.
 */
export async function listChildShellParentSuggestionCards(input: {
  readonly unitOfWork: UnitOfWorkFactory;
  readonly childId: ChildId;
  readonly childPrivateModeActive?: boolean;
}): Promise<ChildShellParentSuggestionCard[]> {
  const active = input.childPrivateModeActive ?? isChildPrivateModeActive();
  if (!active) return [];
  return input.unitOfWork.run(async (uow) => {
    const rows = await uow.parentSuggestions.listByChild(input.childId);
    return rows
      .filter((row) => row.status === 'pending')
      .map((row) => ({
        suggestionId: row.suggestionId,
        title: row.title,
        note: row.note,
        status: row.status,
        sectionLabel: 'Návrh od pečující osoby' as const,
      }));
  });
}

export async function dismissChildShellParentSuggestion(input: {
  readonly unitOfWork: UnitOfWorkFactory;
  readonly suggestionId: EntityId;
  readonly now: Instant;
  readonly childPrivateModeActive?: boolean;
}): Promise<ParentSuggestion> {
  const active = input.childPrivateModeActive ?? isChildPrivateModeActive();
  if (!active) {
    throw new AppError('UNAVAILABLE', 'Child private workspace is not activated', {
      details: { reason: 'child_mode_inactive' },
    });
  }
  return input.unitOfWork.run(async (uow) => {
    const current = await uow.parentSuggestions.getById(input.suggestionId);
    if (!current) {
      throw new AppError('NOT_FOUND', 'Suggestion was not found', {
        details: { reason: 'suggestion_missing' },
      });
    }
    const next = dismissParentSuggestion(current, input.now, true);
    await uow.parentSuggestions.save(next);
    return next;
  });
}

/**
 * Start a published template as a new childPrivate project. Template discovery
 * itself is offline; creating the private project still needs mode gates open.
 */
export async function startChildShellProjectFromTemplate(input: {
  readonly unitOfWork: UnitOfWorkFactory;
  readonly ids: IdGenerator;
  readonly now: Instant;
  readonly childId: ChildId;
  readonly ownerAppUserId: ActorId;
  readonly templateRevisionId: string;
  readonly childPrivateModeActive?: boolean;
  readonly syncEnqueue?: ChildPrivateSyncEnqueuePort;
  readonly operationId?: OperationId;
}): Promise<Project> {
  const active = input.childPrivateModeActive ?? isChildPrivateModeActive();
  if (!active) {
    throw new AppError('UNAVAILABLE', 'Child private workspace is not activated', {
      details: { reason: 'child_mode_inactive' },
    });
  }
  const template = PROJECT_TEMPLATES_PUBLISHED.find(
    (row) => row.revisionId === input.templateRevisionId,
  );
  if (!template) {
    throw new AppError('NOT_FOUND', 'Project template revision was not found', {
      details: { reason: 'template_missing', revisionId: input.templateRevisionId },
    });
  }
  return input.unitOfWork.run(async (uow) => {
    const project = createChildPrivateProject({
      projectId: asEntityId(input.ids.createId('proj')),
      revisionId: asRevisionId(input.ids.createId('rev')),
      childId: input.childId,
      ownerAppUserId: input.ownerAppUserId,
      template,
      title: template.title,
      intent: template.intent,
      now: input.now,
      createStepId: (index) => asEntityId(input.ids.createId(`step${index}`)),
      childPrivateModeActive: true,
    });
    await uow.projects.save(project);
    await enqueueAfterChildPrivateProjectSave({
      syncEnqueue: input.syncEnqueue,
      project,
      operationId: operationIdOrFallback(
        input.operationId,
        `op_tpl_${project.projectId}_${input.now.epochMs}`,
      ),
      now: input.now,
    });
    return project;
  });
}
