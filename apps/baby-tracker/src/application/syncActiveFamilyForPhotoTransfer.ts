import {
  familyIdFromActiveFamilySelection,
  resolveActiveFamilySelection,
  type ActiveFamilySelection,
  type FamilyMembershipSummary,
} from '../domain/attachments/activeFamilySelection';

export type SyncActiveFamilyForPhotoTransferResult = {
  readonly selection: ActiveFamilySelection;
  readonly boundFamilyId: string | null;
};

/**
 * Applies memberships to the photo-transfer active family slot. Single active
 * membership binds automatically; multiple families keep a still-valid previous
 * choice or wait for an explicit pick.
 */
export function syncActiveFamilyForPhotoTransfer(input: {
  readonly memberships: readonly FamilyMembershipSummary[];
  readonly previouslySelectedFamilyId?: string | null;
  readonly bindActiveFamily: (familyId: string | null) => void;
}): SyncActiveFamilyForPhotoTransferResult {
  const selection = resolveActiveFamilySelection({
    memberships: input.memberships,
    previouslySelectedFamilyId: input.previouslySelectedFamilyId ?? null,
  });
  const boundFamilyId = familyIdFromActiveFamilySelection(selection);
  input.bindActiveFamily(boundFamilyId);
  return { selection, boundFamilyId };
}
