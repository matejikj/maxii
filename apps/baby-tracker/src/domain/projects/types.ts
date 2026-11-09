import { AppError } from '../errors';
import type { ActorId, ChildId, EntityId, RevisionId } from '../ids';
import type { Instant } from '../ports/clock';

/** Stable published template identity — never a personal project. */
export type ProjectTemplateId = string & { readonly __brand: 'ProjectTemplateId' };
export type ProjectTemplateRevisionId = string & {
  readonly __brand: 'ProjectTemplateRevisionId';
};

export type ProjectCohort = '8-11' | '12-14' | '15-17';

export type ProjectScope = 'childPrivate' | 'familyGuided';

export type ProjectStatus = 'idea' | 'active' | 'paused' | 'closed' | 'archived';

export type ProjectStepStatus = 'pending' | 'tried' | 'skipped';

export type ProjectTemplateRevision = {
  templateId: ProjectTemplateId;
  revisionId: ProjectTemplateRevisionId;
  language: 'cs';
  title: string;
  cohort: ProjectCohort;
  theme: string;
  intent: string;
  materials: string[];
  /** Offered session lengths — never a countdown or required screen time. */
  offeredSessions: string;
  steps: readonly [string, string, string];
  portfolioHint: string;
  optionalReflection: string;
  privacyNote: string;
  constraints: string[];
  sources: readonly {
    label: string;
    checkedOn: string;
    kind: 'expert' | 'parent' | 'internal';
    url?: string | null;
    supportsPrinciple?: string | null;
  }[];
};

export type ProjectStep = {
  stepId: EntityId;
  order: number;
  text: string;
  status: ProjectStepStatus;
};

export type Project = {
  projectId: EntityId;
  revisionId: RevisionId;
  /** Scope is immutable after create — never rename familyGuided into private. */
  scope: ProjectScope;
  childId: ChildId;
  /** Owning app user for childPrivate; creator for familyGuided. */
  ownerAppUserId: ActorId | null;
  creatorAppUserId: ActorId | null;
  familyId: string | null;
  templateRevisionId: ProjectTemplateRevisionId | null;
  title: string;
  intent: string;
  status: ProjectStatus;
  steps: ProjectStep[];
  /** Optional reflection — empty means intentionally skipped, not missing data. */
  reflection: string | null;
  createdAt: Instant;
  updatedAt: Instant;
};

export type PortfolioItem = {
  portfolioItemId: EntityId;
  projectId: EntityId;
  childId: ChildId;
  ownerAppUserId: ActorId | null;
  title: string;
  description: string | null;
  /** Private until an explicit share snapshot is published. */
  visibility: 'private';
  createdAt: Instant;
};

export type ShareSnapshot = {
  shareId: EntityId;
  sourceProjectId: EntityId;
  sourceRevisionId: RevisionId;
  ownerAppUserId: ActorId;
  /** Exact published text — later private edits do not rewrite this copy. */
  publishedTitle: string;
  publishedBody: string;
  audienceAppUserIds: readonly ActorId[];
  commentsEnabled: boolean;
  revokedAt: Instant | null;
  createdAt: Instant;
};

export type ParentSuggestionStatus =
  | 'pending'
  | 'withdrawn'
  | 'accepted'
  | 'dismissed'
  | 'startedTogether';

/**
 * One adult's proposal to a specific child. Acceptance copies into the child's
 * private space when that mode is active; otherwise a caregiver may only start
 * a familyGuided project explicitly without claiming private privacy.
 */
export type ParentSuggestion = {
  suggestionId: EntityId;
  childId: ChildId;
  authorAppUserId: ActorId | null;
  templateRevisionId: ProjectTemplateRevisionId | null;
  title: string;
  note: string | null;
  status: ParentSuggestionStatus;
  resultingProjectId: EntityId | null;
  createdAt: Instant;
  updatedAt: Instant;
};

export function asProjectTemplateId(value: string): ProjectTemplateId {
  if (!value.trim()) {
    throw new AppError('VALIDATION', 'Project template id is required', {
      details: { reason: 'empty_template_id' },
    });
  }
  return value as ProjectTemplateId;
}

export function asProjectTemplateRevisionId(value: string): ProjectTemplateRevisionId {
  if (!value.trim()) {
    throw new AppError('VALIDATION', 'Project template revision id is required', {
      details: { reason: 'empty_template_revision_id' },
    });
  }
  return value as ProjectTemplateRevisionId;
}

export const PROJECT_LIMITS = {
  titleMaxChars: 80,
  intentMaxChars: 2_000,
  stepMaxChars: 240,
  maxSteps: 12,
  reflectionMaxChars: 2_000,
  portfolioTitleMaxChars: 80,
  portfolioDescriptionMaxChars: 2_000,
  shareBodyMaxBytes: 24 * 1024,
  commentMaxChars: 1_000,
  suggestionNoteMaxChars: 1_000,
  todayActiveProjects: 3,
} as const;
