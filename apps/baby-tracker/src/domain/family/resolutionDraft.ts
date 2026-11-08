/**
 * In-progress conflict resolution. A new remote head must not silently confirm
 * a draft that was based on outdated heads.
 */

export type ResolutionDraft = {
  readonly draftId: string;
  readonly entityIds: readonly string[];
  readonly basedOnHeadRevisionIds: readonly string[];
  readonly choiceId: string;
  readonly note: string | null;
  readonly updatedAt: string;
  readonly status: 'active' | 'stale_heads' | 'committed';
};

export function createResolutionDraft(input: {
  readonly draftId: string;
  readonly entityIds: readonly string[];
  readonly basedOnHeadRevisionIds: readonly string[];
  readonly choiceId: string;
  readonly note?: string | null;
  readonly updatedAt: string;
}): ResolutionDraft {
  return {
    draftId: input.draftId,
    entityIds: input.entityIds,
    basedOnHeadRevisionIds: [...input.basedOnHeadRevisionIds].sort(),
    choiceId: input.choiceId,
    note: input.note ?? null,
    updatedAt: input.updatedAt,
    status: 'active',
  };
}

export function refreshResolutionDraftAgainstHeads(
  draft: ResolutionDraft,
  currentHeadRevisionIds: readonly string[],
): ResolutionDraft {
  if (draft.status === 'committed') return draft;
  const current = [...currentHeadRevisionIds].sort();
  const based = draft.basedOnHeadRevisionIds;
  const same =
    current.length === based.length && current.every((id, index) => id === based[index]);
  if (same) {
    return draft.status === 'active' ? draft : { ...draft, status: 'active' };
  }
  // Keep the parent's proposal as a draft concept, but block commit until reviewed.
  return { ...draft, status: 'stale_heads' };
}

export function canCommitResolutionDraft(draft: ResolutionDraft): boolean {
  return draft.status === 'active';
}

export function markResolutionDraftCommitted(draft: ResolutionDraft): ResolutionDraft {
  return { ...draft, status: 'committed' };
}
