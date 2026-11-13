import type { ActorId } from '../ids';
import { evaluateProjectAccess } from './privacy';
import type { PortfolioItem, Project, ShareSnapshot } from './types';

/**
 * Family/user export never includes childPrivate payloads for a caregiver who
 * is not the owner. Named recipients only receive active share snapshots.
 */
export function filterProjectsForFamilyExport(input: {
  projects: readonly Project[];
  principalKind:
    | 'owner'
    | 'named_recipient'
    | 'other_adult_admin'
    | 'other_adult_caregiver'
    | 'other_child'
    | 'foreign_family'
    | 'inactive_member';
  principalAppUserId: ActorId | null;
  childPrivateModeActive: boolean;
}): Project[] {
  return input.projects.filter((project) => {
    if (project.scope === 'childPrivate') {
      // Caregivers never get private payloads in a family archive.
      return false;
    }
    const decision = evaluateProjectAccess('export', {
      principalKind: input.principalKind,
      principalAppUserId: input.principalAppUserId,
      childPrivateModeActive: input.childPrivateModeActive,
      project,
    });
    return decision.allowed;
  });
}

export function filterPortfolioForFamilyExport(
  items: readonly PortfolioItem[],
  allowedProjectIds: ReadonlySet<string>,
): PortfolioItem[] {
  // Portfolio stays private by default — family export only keeps items tied to
  // already exportable familyGuided projects when the product later opts in.
  // Until then, portfolio cards are omitted from caregiver family archives.
  void items;
  void allowedProjectIds;
  return [];
}

export function filterSharesForRequester(input: {
  shares: readonly ShareSnapshot[];
  principalKind:
    | 'owner'
    | 'named_recipient'
    | 'other_adult_admin'
    | 'other_adult_caregiver'
    | 'other_child'
    | 'foreign_family'
    | 'inactive_member';
  principalAppUserId: ActorId | null;
}): ShareSnapshot[] {
  if (
    input.principalKind === 'foreign_family' ||
    input.principalKind === 'inactive_member' ||
    input.principalKind === 'other_child'
  ) {
    return [];
  }
  return input.shares.filter((share) => {
    if (share.revokedAt != null) return false;
    if (input.principalAppUserId != null && share.ownerAppUserId === input.principalAppUserId) {
      return true;
    }
    if (
      input.principalKind === 'named_recipient' &&
      input.principalAppUserId != null &&
      share.audienceAppUserIds.includes(input.principalAppUserId)
    ) {
      return true;
    }
    // Unaddressed shares never appear in another adult's family export.
    return false;
  });
}
