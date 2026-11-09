import {
  AppError,
  asEntityId,
  asProjectTemplateId,
  asProjectTemplateRevisionId,
  asRevisionId,
  authorLearnsPrivateAcceptOrDismiss,
  acceptParentSuggestionIntoPrivate,
  createFamilyGuidedProject,
  createParentSuggestion,
  dismissParentSuggestion,
  isChildPrivateModeActive,
  presentChildPrivateModeStatus,
  presentSuggestionToAuthor,
  startSuggestionTogether,
  withdrawParentSuggestion,
  type ActorId,
  type ChildId,
  type EntityId,
  type IdGenerator,
  type Instant,
  type ParentSuggestion,
  type ProjectTemplateRevision,
  type ProjectTemplateRevisionId,
  type UnitOfWorkFactory,
} from '../domain';
import { findProjectTemplateRevision } from '../content/catalog/projectTemplatesPublished';

export type AuthorSuggestionView = ReturnType<typeof presentSuggestionToAuthor>;

function freeformTemplate(suggestion: ParentSuggestion): ProjectTemplateRevision {
  return {
    templateId: asProjectTemplateId(`freeform:${suggestion.suggestionId}`),
    revisionId: asProjectTemplateRevisionId(`freeform-rev:${suggestion.suggestionId}`),
    language: 'cs',
    title: suggestion.title,
    cohort: '8-11',
    theme: 'Vlastní nápad',
    intent: suggestion.note ?? suggestion.title,
    materials: [],
    offeredSessions: 'Podle domluvy',
    steps: [
      'Začněte společně podle návrhu.',
      'Pokračujte vlastním tempem.',
      'Vyberte, co chcete uchovat.',
    ],
    portfolioHint: 'Vyberte výtvor, který chcete uchovat.',
    optionalReflection: 'Co jsme zkusili spolu?',
    privacyNote: 'Rodinný projekt — vidí pečující rodiny.',
    constraints: ['Nejde o soukromý dětský deník.'],
    sources: [
      {
        label: 'Návrh pečující osoby',
        checkedOn: '2026-11-09',
        kind: 'parent',
      },
    ],
  };
}

/**
 * Propose an idea to a child. Without an active child workspace the caregiver
 * can later start it together as familyGuided — never as fake private accept.
 */
export async function proposeParentSuggestion(input: {
  unitOfWork: UnitOfWorkFactory;
  ids: IdGenerator;
  now: Instant;
  childId: ChildId;
  title: string;
  note?: string | null;
  templateRevisionId?: ProjectTemplateRevisionId | string | null;
  authorAppUserId?: ActorId | null;
}): Promise<ParentSuggestion> {
  let templateRevisionId: ProjectTemplateRevisionId | null = null;
  if (input.templateRevisionId) {
    const template = findProjectTemplateRevision(String(input.templateRevisionId));
    if (!template) {
      throw new AppError('NOT_FOUND', 'Project template revision was not found', {
        details: { reason: 'template_missing', revisionId: String(input.templateRevisionId) },
      });
    }
    templateRevisionId = template.revisionId;
  }

  const suggestion = createParentSuggestion({
    suggestionId: asEntityId(input.ids.createId('psug')),
    childId: input.childId,
    authorAppUserId: input.authorAppUserId ?? null,
    templateRevisionId,
    title: input.title,
    note: input.note ?? null,
    now: input.now,
  });

  await input.unitOfWork.run(async (uow) => {
    await uow.parentSuggestions.save(suggestion);
  });
  return suggestion;
}

export async function listParentSuggestionsForAuthor(input: {
  unitOfWork: UnitOfWorkFactory;
  childId: ChildId;
  authorAppUserId?: ActorId | null;
}): Promise<AuthorSuggestionView[]> {
  return input.unitOfWork.run(async (uow) => {
    const rows = await uow.parentSuggestions.listByChild(input.childId);
    return rows
      .filter((row) => {
        if (input.authorAppUserId == null) {
          // Personal mode: local caregiver sees suggestions they authored without login.
          return row.authorAppUserId == null;
        }
        return row.authorAppUserId === input.authorAppUserId;
      })
      .map(presentSuggestionToAuthor);
  });
}

export async function withdrawAuthoredSuggestion(input: {
  unitOfWork: UnitOfWorkFactory;
  now: Instant;
  suggestionId: EntityId;
  authorAppUserId?: ActorId | null;
}): Promise<AuthorSuggestionView> {
  return input.unitOfWork.run(async (uow) => {
    const current = await uow.parentSuggestions.getById(input.suggestionId);
    if (!current) {
      throw new AppError('NOT_FOUND', 'Suggestion was not found', {
        details: { reason: 'suggestion_missing' },
      });
    }
    if (
      input.authorAppUserId != null &&
      current.authorAppUserId != null &&
      current.authorAppUserId !== input.authorAppUserId
    ) {
      throw new AppError('FORBIDDEN', 'Only the author may withdraw this suggestion', {
        details: { reason: 'not_suggestion_author' },
      });
    }
    const next = withdrawParentSuggestion(current, input.now);
    await uow.parentSuggestions.save(next);
    return presentSuggestionToAuthor(next);
  });
}

/**
 * Start the pending idea as a familyGuided project. Explicit caregiver action —
 * not a private accept and not accept/dismiss telemetry for the author.
 */
export async function startSuggestionAsFamilyGuided(input: {
  unitOfWork: UnitOfWorkFactory;
  ids: IdGenerator;
  now: Instant;
  suggestionId: EntityId;
  authorAppUserId?: ActorId | null;
  familyId?: string | null;
}): Promise<{ suggestion: AuthorSuggestionView; projectId: EntityId }> {
  return input.unitOfWork.run(async (uow) => {
    const current = await uow.parentSuggestions.getById(input.suggestionId);
    if (!current) {
      throw new AppError('NOT_FOUND', 'Suggestion was not found', {
        details: { reason: 'suggestion_missing' },
      });
    }
    if (
      input.authorAppUserId != null &&
      current.authorAppUserId != null &&
      current.authorAppUserId !== input.authorAppUserId
    ) {
      throw new AppError('FORBIDDEN', 'Only the author may start this suggestion together', {
        details: { reason: 'not_suggestion_author' },
      });
    }

    const template = current.templateRevisionId
      ? findProjectTemplateRevision(String(current.templateRevisionId))
      : null;
    if (current.templateRevisionId && !template) {
      throw new AppError('NOT_FOUND', 'Project template revision was not found', {
        details: {
          reason: 'template_missing',
          revisionId: String(current.templateRevisionId),
        },
      });
    }

    const project = createFamilyGuidedProject({
      projectId: asEntityId(input.ids.createId('proj')),
      revisionId: asRevisionId(input.ids.createId('rev')),
      childId: current.childId,
      creatorAppUserId: input.authorAppUserId ?? current.authorAppUserId,
      familyId: input.familyId ?? null,
      template: template ?? freeformTemplate(current),
      title: current.title,
      ...(current.note ? { intent: current.note } : {}),
      now: input.now,
      createStepId: (index) => asEntityId(input.ids.createId(`pstep${index}`)),
    });

    const next = startSuggestionTogether({
      suggestion: current,
      resultingProjectId: project.projectId,
      now: input.now,
    });

    await uow.projects.save(project);
    await uow.parentSuggestions.save(next);
    return {
      suggestion: presentSuggestionToAuthor(next),
      projectId: project.projectId,
    };
  });
}

/**
 * Child accept into private space — blocked while child mode gates are closed.
 * Kept as an application entry so UI never invents a silent private path.
 */
export async function acceptSuggestionIntoChildPrivate(input: {
  unitOfWork: UnitOfWorkFactory;
  suggestionId: EntityId;
  resultingProjectId: EntityId;
  now: Instant;
}): Promise<ParentSuggestion> {
  return input.unitOfWork.run(async (uow) => {
    const current = await uow.parentSuggestions.getById(input.suggestionId);
    if (!current) {
      throw new AppError('NOT_FOUND', 'Suggestion was not found', {
        details: { reason: 'suggestion_missing' },
      });
    }
    const next = acceptParentSuggestionIntoPrivate({
      suggestion: current,
      resultingProjectId: input.resultingProjectId,
      now: input.now,
      childPrivateModeActive: isChildPrivateModeActive(),
    });
    await uow.parentSuggestions.save(next);
    return next;
  });
}

export async function dismissSuggestionAsChild(input: {
  unitOfWork: UnitOfWorkFactory;
  suggestionId: EntityId;
  now: Instant;
}): Promise<ParentSuggestion> {
  return input.unitOfWork.run(async (uow) => {
    const current = await uow.parentSuggestions.getById(input.suggestionId);
    if (!current) {
      throw new AppError('NOT_FOUND', 'Suggestion was not found', {
        details: { reason: 'suggestion_missing' },
      });
    }
    const next = dismissParentSuggestion(current, input.now, isChildPrivateModeActive());
    await uow.parentSuggestions.save(next);
    return next;
  });
}

export function readChildPrivateModeSettingsStatus() {
  return presentChildPrivateModeStatus();
}

export function authorSeesPrivateAcceptTelemetry(): false {
  return authorLearnsPrivateAcceptOrDismiss();
}
