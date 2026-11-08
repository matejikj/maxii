import { AppError } from '../errors';
import type { ChildId, EntityId } from '../ids';
import type { Instant } from '../ports/clock';
import type { CareEventType } from './careEvent';

export type DraftFormType = CareEventType | 'note' | 'experience' | 'observation';

/**
 * A draft is recoverable form state, never a care event and never part of
 * summaries. originalEventTime stays fixed so yesterday's draft cannot save as today.
 */
export type Draft = {
  draftId: EntityId;
  childId: ChildId;
  formType: DraftFormType;
  originalEventTime: Instant;
  updatedAt: Instant;
  /** Opaque form payload validated at the feature boundary before promote. */
  payload: Record<string, unknown>;
};

export function createDraft(input: {
  draftId: EntityId;
  childId: ChildId;
  formType: DraftFormType;
  originalEventTime: Instant;
  updatedAt: Instant;
  payload?: Record<string, unknown>;
}): Draft {
  return {
    draftId: input.draftId,
    childId: input.childId,
    formType: input.formType,
    originalEventTime: input.originalEventTime,
    updatedAt: input.updatedAt,
    payload: input.payload ?? {},
  };
}

export function touchDraft(draft: Draft, updatedAt: Instant, payload: Record<string, unknown>): Draft {
  if (updatedAt.epochMs < draft.updatedAt.epochMs) {
    throw new AppError('VALIDATION', 'Draft update time moved backwards', {
      details: { reason: 'draft_clock' },
    });
  }
  return { ...draft, updatedAt, payload };
}
