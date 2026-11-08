import type { DevelopmentArea } from '../../domain';

/** Editorial stages; only `published` may enter the recommendation catalog. */
export type EditorialStage =
  | 'draft'
  | 'expert_reviewed'
  | 'language_ux'
  | 'parent_verified'
  | 'published'
  | 'withdrawn';

export type ContentEnvironment = 'home' | 'outdoor' | 'travel' | 'quiet';

export type ContentDuration =
  | { kind: 'moment' }
  | { kind: 'minutes'; minutes: 5 | 10 | 15 };

/**
 * Suitability is data only — never an embedded script or generative paraphrase
 * that invents a new environment at packaging time.
 */
export type SuitabilityCondition =
  | {
      kind: 'age_months';
      /** Inclusive calendar-month bounds for the child. */
      fromInclusive: number;
      toInclusive: number;
    }
  | { kind: 'environment_one_of'; environments: ContentEnvironment[] }
  | { kind: 'materials_none' }
  | { kind: 'materials_all_of'; materials: string[] }
  | { kind: 'requires_birth_date' };

export type ContentSource = {
  label: string;
  /** ISO calendar date of the last expert check for this source note. */
  checkedOn: string;
  kind: 'expert' | 'parent' | 'internal';
};

export type EditorialEvent = {
  stage: Exclude<EditorialStage, 'draft'>;
  author: string;
  atMs: number;
  note: string;
  outcome: 'passed' | 'rejected' | 'withdrawn';
};

export type ActivitySteps = readonly [string] | readonly [string, string] | readonly [string, string, string];

/**
 * Immutable content revision. Corrections always mint a new revisionId; an
 * already recorded experience keeps pointing at the original revision.
 */
export type ActivityRevision = {
  activityId: string;
  revisionId: string;
  language: 'cs';
  title: string;
  ageMonths: { fromInclusive: number; toInclusive: number };
  readinessNotes: string | null;
  environments: ContentEnvironment[];
  materials: string[];
  constraints: string[];
  duration: ContentDuration;
  steps: ActivitySteps;
  conversationPrompt: string | null;
  primaryArea: DevelopmentArea;
  relatedAreas: DevelopmentArea[];
  topicIds: string[];
  sources: ContentSource[];
  suitability: SuitabilityCondition[];
  editorial: {
    stage: EditorialStage;
    history: EditorialEvent[];
  };
  withdrawnReason: string | null;
  /**
   * Development fixtures stay out of the distributed recommendation catalog.
   * Product content must omit this flag or set it to `product`.
   */
  fixtureKind?: 'development' | 'product';
};

export type ActivityTopic = {
  topicId: string;
  area: DevelopmentArea;
  titleCs: string;
  /** Editorial taxonomy only — not proof a child mastered a skill. */
  descriptionCs: string;
};

export type ContentManifest = {
  format: 'lumi.content-manifest.v1';
  contentVersion: string;
  generatedAtMs: number;
  revisionIds: string[];
  /** Integrity digests of included revision payloads. */
  digests: Record<string, string>;
};

export type FieldValidationError = {
  path: string;
  code: string;
  message: string;
};
