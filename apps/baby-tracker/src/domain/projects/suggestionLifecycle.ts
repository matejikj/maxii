import { AppError } from '../errors';
import type { ActorId, ChildId, EntityId } from '../ids';
import type { Instant } from '../ports/clock';
import { PROJECT_LIMITS, type ParentSuggestion, type ProjectTemplateRevisionId } from './types';

/**
 * Create a pending parent suggestion. Visibility is limited to author and the
 * addressed child — never the whole family by default.
 */
export function createParentSuggestion(input: {
  suggestionId: EntityId;
  childId: ChildId;
  authorAppUserId: ActorId | null;
  templateRevisionId: ProjectTemplateRevisionId | null;
  title: string;
  note?: string | null;
  now: Instant;
}): ParentSuggestion {
  const title = input.title.trim();
  if (!title) {
    throw new AppError('VALIDATION', 'Suggestion title is required', {
      details: { reason: 'empty_suggestion_title' },
    });
  }
  if (title.length > PROJECT_LIMITS.titleMaxChars) {
    throw new AppError('VALIDATION', 'Suggestion title is too long', {
      details: { reason: 'suggestion_title_length' },
    });
  }
  const note = input.note?.trim() || null;
  if (note != null && note.length > PROJECT_LIMITS.suggestionNoteMaxChars) {
    throw new AppError('VALIDATION', 'Suggestion note is too long', {
      details: { reason: 'suggestion_note_length' },
    });
  }
  return {
    suggestionId: input.suggestionId,
    childId: input.childId,
    authorAppUserId: input.authorAppUserId,
    templateRevisionId: input.templateRevisionId,
    title,
    note,
    status: 'pending',
    resultingProjectId: null,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function withdrawParentSuggestion(
  suggestion: ParentSuggestion,
  now: Instant,
): ParentSuggestion {
  if (suggestion.status !== 'pending') {
    throw new AppError('CONFLICT', 'Only a pending suggestion can be withdrawn', {
      details: { reason: 'suggestion_not_pending', status: suggestion.status },
    });
  }
  return { ...suggestion, status: 'withdrawn', updatedAt: now };
}

/**
 * Child accept copies into childPrivate when that mode is active. Missing gates
 * must not silently create a private project on the caregiver device.
 */
export function acceptParentSuggestionIntoPrivate(input: {
  suggestion: ParentSuggestion;
  resultingProjectId: EntityId;
  now: Instant;
  childPrivateModeActive: boolean;
}): ParentSuggestion {
  if (!input.childPrivateModeActive) {
    throw new AppError('UNAVAILABLE', 'Child private workspace is not activated', {
      details: { reason: 'child_mode_inactive' },
    });
  }
  if (input.suggestion.status !== 'pending') {
    throw new AppError('CONFLICT', 'Only a pending suggestion can be accepted', {
      details: { reason: 'suggestion_not_pending', status: input.suggestion.status },
    });
  }
  return {
    ...input.suggestion,
    status: 'accepted',
    resultingProjectId: input.resultingProjectId,
    updatedAt: input.now,
  };
}

export function dismissParentSuggestion(
  suggestion: ParentSuggestion,
  now: Instant,
  childPrivateModeActive: boolean,
): ParentSuggestion {
  if (!childPrivateModeActive) {
    throw new AppError('UNAVAILABLE', 'Child private workspace is not activated', {
      details: { reason: 'child_mode_inactive' },
    });
  }
  if (suggestion.status !== 'pending') {
    throw new AppError('CONFLICT', 'Only a pending suggestion can be dismissed', {
      details: { reason: 'suggestion_not_pending', status: suggestion.status },
    });
  }
  return { ...suggestion, status: 'dismissed', updatedAt: now };
}

/**
 * Caregiver starts the idea as a shared familyGuided project without pretending
 * the child accepted it into a private workspace.
 */
export function startSuggestionTogether(input: {
  suggestion: ParentSuggestion;
  resultingProjectId: EntityId;
  now: Instant;
}): ParentSuggestion {
  if (input.suggestion.status !== 'pending') {
    throw new AppError('CONFLICT', 'Only a pending suggestion can start together', {
      details: { reason: 'suggestion_not_pending', status: input.suggestion.status },
    });
  }
  return {
    ...input.suggestion,
    status: 'startedTogether',
    resultingProjectId: input.resultingProjectId,
    updatedAt: input.now,
  };
}

/**
 * Authors only learn that a suggestion was delivered — never accept/dismiss
 * telemetry that would reveal private child activity.
 */
export function presentSuggestionToAuthor(suggestion: ParentSuggestion): {
  suggestionId: EntityId;
  title: string;
  note: string | null;
  delivery: 'pending' | 'withdrawn' | 'delivered' | 'started_together';
  resultingProjectId: EntityId | null;
} {
  if (suggestion.status === 'pending') {
    return {
      suggestionId: suggestion.suggestionId,
      title: suggestion.title,
      note: suggestion.note,
      delivery: 'pending',
      resultingProjectId: null,
    };
  }
  if (suggestion.status === 'withdrawn') {
    return {
      suggestionId: suggestion.suggestionId,
      title: suggestion.title,
      note: suggestion.note,
      delivery: 'withdrawn',
      resultingProjectId: null,
    };
  }
  if (suggestion.status === 'startedTogether') {
    return {
      suggestionId: suggestion.suggestionId,
      title: suggestion.title,
      note: suggestion.note,
      delivery: 'started_together',
      resultingProjectId: suggestion.resultingProjectId,
    };
  }
  // accepted / dismissed collapse to delivered — no private outcome leak.
  return {
    suggestionId: suggestion.suggestionId,
    title: suggestion.title,
    note: suggestion.note,
    delivery: 'delivered',
    resultingProjectId: null,
  };
}

export function authorLearnsPrivateAcceptOrDismiss(): false {
  return false;
}
