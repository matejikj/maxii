import type { ActivityRevision, EditorialEvent, EditorialStage, FieldValidationError } from './types';

const PUBLISH_PATH: EditorialStage[] = [
  'draft',
  'expert_reviewed',
  'language_ux',
  'parent_verified',
  'published',
];

/**
 * Advance one editorial step. Rejected outcomes stay on the prior stage; a
 * published revision is never mutated into a different meaning — withdraw or
 * mint a new revision instead.
 */
export function recordEditorialEvent(
  revision: ActivityRevision,
  event: EditorialEvent,
): { ok: true; revision: ActivityRevision } | { ok: false; errors: FieldValidationError[] } {
  if (revision.editorial.stage === 'published' && event.outcome !== 'withdrawn') {
    return {
      ok: false,
      errors: [
        {
          path: 'editorial.stage',
          code: 'immutable_published',
          message: 'Published revisions cannot be edited in place; create a new revision.',
        },
      ],
    };
  }
  if (revision.editorial.stage === 'withdrawn') {
    return {
      ok: false,
      errors: [
        {
          path: 'editorial.stage',
          code: 'already_withdrawn',
          message: 'Withdrawn revisions are closed; publish a new revision if needed.',
        },
      ],
    };
  }

  if (event.outcome === 'withdrawn') {
    if (revision.editorial.stage !== 'published') {
      return {
        ok: false,
        errors: [
          {
            path: 'editorial.history',
            code: 'withdraw_requires_published',
            message: 'Only a published revision can be withdrawn from the catalog.',
          },
        ],
      };
    }
    return {
      ok: true,
      revision: {
        ...revision,
        editorial: {
          stage: 'withdrawn',
          history: [...revision.editorial.history, event],
        },
        withdrawnReason: event.note.trim() || 'Withdrawn from recommendation catalog',
      },
    };
  }

  if (event.outcome === 'rejected') {
    return {
      ok: true,
      revision: {
        ...revision,
        editorial: {
          stage: revision.editorial.stage,
          history: [...revision.editorial.history, event],
        },
      },
    };
  }

  const expected = nextStage(revision.editorial.stage);
  if (expected == null || event.stage !== expected) {
    return {
      ok: false,
      errors: [
        {
          path: 'editorial.history',
          code: 'stage_order',
          message: `Next required stage is ${expected ?? 'none'}; received ${event.stage}.`,
        },
      ],
    };
  }

  if (!event.author.trim() || !event.note.trim()) {
    return {
      ok: false,
      errors: [
        {
          path: 'editorial.history',
          code: 'review_incomplete',
          message: 'Each editorial step needs an author and a concrete note.',
        },
      ],
    };
  }

  return {
    ok: true,
    revision: {
      ...revision,
      editorial: {
        stage: event.stage,
        history: [...revision.editorial.history, event],
      },
      withdrawnReason: null,
    },
  };
}

export function nextStage(current: EditorialStage): EditorialStage | null {
  const index = PUBLISH_PATH.indexOf(current);
  if (index < 0 || index >= PUBLISH_PATH.length - 1) return null;
  return PUBLISH_PATH[index + 1]!;
}

export function isRecommendable(revision: ActivityRevision): boolean {
  return (
    revision.editorial.stage === 'published' &&
    revision.withdrawnReason == null &&
    revision.fixtureKind !== 'development'
  );
}
