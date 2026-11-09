import type { ActivityRevision } from '../../content/model/types';
import { isRecommendable } from '../../content/model/workflow';
import type { RecommendableCandidate } from '../../domain';

/**
 * Map a content revision into the selector snapshot. Development fixtures stay
 * out unless the caller explicitly opts in for local engine wiring.
 */
export function candidateFromRevision(
  revision: ActivityRevision,
  options: { allowDevelopmentFixtures?: boolean } = {},
): RecommendableCandidate {
  const recommendable =
    isRecommendable(revision) ||
    (options.allowDevelopmentFixtures === true &&
      revision.fixtureKind === 'development' &&
      revision.editorial.stage === 'published' &&
      revision.withdrawnReason == null);

  return {
    activityId: revision.activityId,
    revisionId: revision.revisionId,
    primaryArea: revision.primaryArea,
    relatedAreas: revision.relatedAreas,
    ageMonths: revision.ageMonths,
    environments: revision.environments,
    materials: revision.materials,
    duration: revision.duration,
    suitability: revision.suitability,
    activityFamilyId: revision.activityFamilyId ?? null,
    recommendable,
  };
}

export function candidatesFromRevisions(
  revisions: ActivityRevision[],
  options: { allowDevelopmentFixtures?: boolean } = {},
): RecommendableCandidate[] {
  return revisions.map((revision) => candidateFromRevision(revision, options));
}
