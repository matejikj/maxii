import { AppError } from '../errors';
import type { ActorId, ChildId, EntityId, RevisionId } from '../ids';
import type { Instant } from '../ports/clock';
import {
  PROJECT_LIMITS,
  type Project,
  type ProjectScope,
  type ProjectStatus,
  type ProjectStep,
  type ProjectTemplateRevision,
  type ProjectTemplateRevisionId,
  type ProjectVariantNotes,
} from './types';

function assertTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new AppError('VALIDATION', 'Project title is required', {
      details: { reason: 'empty_title' },
    });
  }
  if (trimmed.length > PROJECT_LIMITS.titleMaxChars) {
    throw new AppError('VALIDATION', 'Project title is too long', {
      details: { reason: 'title_length' },
    });
  }
  return trimmed;
}

function assertIntent(intent: string): string {
  const trimmed = intent.trim();
  if (trimmed.length > PROJECT_LIMITS.intentMaxChars) {
    throw new AppError('VALIDATION', 'Project intent is too long', {
      details: { reason: 'intent_length' },
    });
  }
  return trimmed;
}

function stepsFromTemplate(
  template: ProjectTemplateRevision,
  createStepId: (index: number) => EntityId,
): ProjectStep[] {
  return template.steps.map((text, index) => {
    if (text.length > PROJECT_LIMITS.stepMaxChars) {
      throw new AppError('VALIDATION', 'Project step text is too long', {
        details: { reason: 'step_length', index },
      });
    }
    return {
      stepId: createStepId(index),
      order: index,
      text,
      status: 'pending' as const,
    };
  });
}

/**
 * Create a caregiver-led familyGuided project. Scope cannot later become
 * childPrivate by rename — takeover copies into a new private id.
 */
export function createFamilyGuidedProject(input: {
  projectId: EntityId;
  revisionId: RevisionId;
  childId: ChildId;
  creatorAppUserId: ActorId | null;
  familyId: string | null;
  template: ProjectTemplateRevision;
  title?: string;
  intent?: string;
  now: Instant;
  createStepId: (index: number) => EntityId;
}): Project {
  return {
    projectId: input.projectId,
    revisionId: input.revisionId,
    scope: 'familyGuided',
    childId: input.childId,
    ownerAppUserId: input.creatorAppUserId,
    creatorAppUserId: input.creatorAppUserId,
    familyId: input.familyId,
    templateRevisionId: input.template.revisionId,
    title: assertTitle(input.title ?? input.template.title),
    intent: assertIntent(input.intent ?? input.template.intent),
    status: 'active',
    steps: stepsFromTemplate(input.template, input.createStepId),
    reflection: null,
    variantNotes: null,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export type FamilyGuidedBlankStyle = 'simple' | 'variants';

/**
 * Caregiver-led blank idea — equal to a template start, without claiming a
 * private child workspace. Starter steps stay short and optional to skip later.
 * `variants` offers more own choice for older cohorts without changing privacy.
 */
export function createFamilyGuidedBlankProject(input: {
  projectId: EntityId;
  revisionId: RevisionId;
  childId: ChildId;
  creatorAppUserId: ActorId | null;
  familyId: string | null;
  title: string;
  intent?: string;
  style?: FamilyGuidedBlankStyle;
  now: Instant;
  createStepId: (index: number) => EntityId;
}): Project {
  const starterTexts =
    input.style === 'variants'
      ? ([
          'Sepíšeme dvě možné varianty vlastního zadání.',
          'Porovnáme je bez žebříčku správných odpovědí.',
          'Vybereme další krok nebo otevřenou otázku.',
        ] as const)
      : ([
          'Domluvíme první malý krok.',
          'Zkusíme to spolu vlastním tempem.',
          'Vybereme, co chceme uchovat.',
        ] as const);
  const steps: ProjectStep[] = starterTexts.map((text, index) => ({
    stepId: input.createStepId(index),
    order: index,
    text,
    status: 'pending' as const,
  }));
  return {
    projectId: input.projectId,
    revisionId: input.revisionId,
    scope: 'familyGuided',
    childId: input.childId,
    ownerAppUserId: input.creatorAppUserId,
    creatorAppUserId: input.creatorAppUserId,
    familyId: input.familyId,
    templateRevisionId: null,
    title: assertTitle(input.title),
    intent: assertIntent(input.intent ?? ''),
    status: 'active',
    steps,
    reflection: null,
    variantNotes: null,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

/**
 * Child-private create stays available in the domain but activation is gated
 * separately — callers must refuse when child mode is inactive.
 */
export function createChildPrivateProject(input: {
  projectId: EntityId;
  revisionId: RevisionId;
  childId: ChildId;
  ownerAppUserId: ActorId;
  template: ProjectTemplateRevision | null;
  title: string;
  intent: string;
  now: Instant;
  createStepId: (index: number) => EntityId;
  childPrivateModeActive: boolean;
}): Project {
  if (!input.childPrivateModeActive) {
    throw new AppError('UNAVAILABLE', 'Child private workspace is not activated', {
      details: { reason: 'child_mode_inactive' },
    });
  }
  const steps = input.template
    ? stepsFromTemplate(input.template, input.createStepId)
    : [];
  if (steps.length > PROJECT_LIMITS.maxSteps) {
    throw new AppError('VALIDATION', 'Too many project steps', {
      details: { reason: 'step_count' },
    });
  }
  return {
    projectId: input.projectId,
    revisionId: input.revisionId,
    scope: 'childPrivate',
    childId: input.childId,
    ownerAppUserId: input.ownerAppUserId,
    creatorAppUserId: input.ownerAppUserId,
    familyId: null,
    templateRevisionId: input.template?.revisionId ?? null,
    title: assertTitle(input.title),
    intent: assertIntent(input.intent),
    status: 'idea',
    steps,
    reflection: null,
    variantNotes: null,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

const STATUS_TRANSITIONS: Record<ProjectStatus, readonly ProjectStatus[]> = {
  idea: ['active', 'paused', 'closed', 'archived'],
  active: ['paused', 'closed', 'archived'],
  paused: ['active', 'closed', 'archived'],
  closed: ['archived', 'active'],
  archived: [],
};

export function transitionProjectStatus(
  project: Project,
  next: ProjectStatus,
  revisionId: RevisionId,
  now: Instant,
): Project {
  if (!STATUS_TRANSITIONS[project.status].includes(next)) {
    throw new AppError('CONFLICT', 'Project status transition is not allowed', {
      details: { from: project.status, to: next },
    });
  }
  return {
    ...project,
    status: next,
    revisionId,
    updatedAt: now,
  };
}

export function updateProjectReflection(
  project: Project,
  reflection: string | null,
  revisionId: RevisionId,
  now: Instant,
): Project {
  if (reflection != null && reflection.length > PROJECT_LIMITS.reflectionMaxChars) {
    throw new AppError('VALIDATION', 'Reflection is too long', {
      details: { reason: 'reflection_length' },
    });
  }
  return {
    ...project,
    reflection,
    revisionId,
    updatedAt: now,
  };
}

function assertVariantOption(label: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new AppError('VALIDATION', `${label} is required`, {
      details: { reason: 'empty_variant_option' },
    });
  }
  if (trimmed.length > PROJECT_LIMITS.variantOptionMaxChars) {
    throw new AppError('VALIDATION', `${label} is too long`, {
      details: { reason: 'variant_option_length' },
    });
  }
  return trimmed;
}

/**
 * Store two optional solutions on the live project. Share snapshots still need
 * an explicit published body — variants never leak by themselves.
 */
export function updateProjectVariantNotes(
  project: Project,
  notes: ProjectVariantNotes | null,
  revisionId: RevisionId,
  now: Instant,
): Project {
  if (notes == null) {
    return { ...project, variantNotes: null, revisionId, updatedAt: now };
  }
  const optionA = assertVariantOption('Variant A', notes.optionA);
  const optionB = assertVariantOption('Variant B', notes.optionB);
  const chosenNote = notes.chosenNote?.trim() || null;
  if (chosenNote != null && chosenNote.length > PROJECT_LIMITS.reflectionMaxChars) {
    throw new AppError('VALIDATION', 'Variant note is too long', {
      details: { reason: 'variant_chosen_length' },
    });
  }
  return {
    ...project,
    variantNotes: { optionA, optionB, chosenNote },
    revisionId,
    updatedAt: now,
  };
}

/** Live variant notes are never implied by a share — only the frozen body. */
export function shareIncludesLiveVariantNotes(): false {
  return false;
}

/** Older payload rows may omit variantNotes — treat missing as null. */
export function normalizeProjectRow(project: Project): Project {
  return {
    ...project,
    variantNotes: project.variantNotes ?? null,
  };
}

export function markProjectStep(
  project: Project,
  stepId: EntityId,
  status: ProjectStep['status'],
  revisionId: RevisionId,
  now: Instant,
): Project {
  const steps = project.steps.map((step) =>
    step.stepId === stepId ? { ...step, status } : step,
  );
  if (!steps.some((step) => step.stepId === stepId)) {
    throw new AppError('NOT_FOUND', 'Project step was not found', {
      details: { reason: 'step_missing' },
    });
  }
  return { ...project, steps, revisionId, updatedAt: now };
}

/**
 * Taking a familyGuided project into childPrivate always copies — never flips
 * the original scope bit. Original family copy stays under family rules.
 */
export function planPrivateTakeoverCopy(input: {
  source: Project;
  newProjectId: EntityId;
  newRevisionId: RevisionId;
  ownerAppUserId: ActorId;
  now: Instant;
  remapStepId: (stepId: EntityId, index: number) => EntityId;
  childPrivateModeActive: boolean;
}): { copy: Project; sourceUnchangedScope: ProjectScope } {
  if (input.source.scope !== 'familyGuided') {
    throw new AppError('VALIDATION', 'Only familyGuided projects can be taken over', {
      details: { reason: 'not_family_guided' },
    });
  }
  if (!input.childPrivateModeActive) {
    throw new AppError('UNAVAILABLE', 'Child private workspace is not activated', {
      details: { reason: 'child_mode_inactive' },
    });
  }
  const copy: Project = {
    ...input.source,
    projectId: input.newProjectId,
    revisionId: input.newRevisionId,
    scope: 'childPrivate',
    ownerAppUserId: input.ownerAppUserId,
    creatorAppUserId: input.ownerAppUserId,
    familyId: null,
    steps: input.source.steps.map((step, index) => ({
      ...step,
      stepId: input.remapStepId(step.stepId, index),
    })),
    createdAt: input.now,
    updatedAt: input.now,
  };
  return { copy, sourceUnchangedScope: input.source.scope };
}

export function listTodayActiveProjects(projects: readonly Project[]): Project[] {
  return projects
    .filter((project) => project.status === 'active' || project.status === 'idea')
    .slice(0, PROJECT_LIMITS.todayActiveProjects);
}

/** First pending step — caregivers continue one concrete action, never a score. */
export function currentProjectStep(project: Project): ProjectStep | null {
  return project.steps.find((step) => step.status === 'pending') ?? null;
}

export type ProjectStatusGroups = {
  active: Project[];
  paused: Project[];
  closed: Project[];
};

/**
 * Simple status shelves for caregiver project lists. Archived stays out of the
 * everyday shelves so closed work is not confused with soft pause.
 */
export function groupProjectsByStatus(projects: readonly Project[]): ProjectStatusGroups {
  const active: Project[] = [];
  const paused: Project[] = [];
  const closed: Project[] = [];
  for (const project of projects) {
    if (project.status === 'active' || project.status === 'idea') active.push(project);
    else if (project.status === 'paused') paused.push(project);
    else if (project.status === 'closed' || project.status === 'archived') closed.push(project);
  }
  return { active, paused, closed };
}

export type { ProjectTemplateRevisionId };
