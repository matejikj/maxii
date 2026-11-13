/**
 * Chooses which family photo transfers may use. A logged-in user without an
 * active membership stays cold; multiple active families require an explicit
 * pick so uploads never jump to the wrong tenant.
 */
export type FamilyMembershipSummary = {
  readonly familyId: string;
  readonly role: string;
  readonly status: string;
};

export type ActiveFamilySelection =
  | { readonly kind: 'none' }
  | { readonly kind: 'single'; readonly familyId: string }
  | {
      readonly kind: 'choice_required';
      readonly memberships: readonly FamilyMembershipSummary[];
      readonly preferredFamilyId: string | null;
    };

export function listActiveFamilyMemberships(
  memberships: readonly FamilyMembershipSummary[],
): readonly FamilyMembershipSummary[] {
  return memberships.filter((item) => item.status === 'active' && item.familyId.trim().length > 0);
}

export function resolveActiveFamilySelection(input: {
  readonly memberships: readonly FamilyMembershipSummary[];
  readonly previouslySelectedFamilyId?: string | null;
}): ActiveFamilySelection {
  const active = listActiveFamilyMemberships(input.memberships);
  if (active.length === 0) return { kind: 'none' };
  if (active.length === 1) {
    return { kind: 'single', familyId: active[0]!.familyId };
  }
  const preferred = input.previouslySelectedFamilyId?.trim() || null;
  const preferredStillActive =
    preferred != null && active.some((item) => item.familyId === preferred);
  return {
    kind: 'choice_required',
    memberships: active,
    preferredFamilyId: preferredStillActive ? preferred : null,
  };
}

export function familyIdFromActiveFamilySelection(selection: ActiveFamilySelection): string | null {
  if (selection.kind === 'single') return selection.familyId;
  if (selection.kind === 'choice_required') return selection.preferredFamilyId;
  return null;
}
