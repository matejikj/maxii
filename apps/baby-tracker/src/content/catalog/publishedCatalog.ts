import { bytesToHex } from '@noble/hashes/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { isRecommendable } from '../model/workflow';
import type { ActivityRevision, ContentManifest } from '../model/types';
import { validateActivityRevision } from '../validation/validateActivity';

export type ContentCatalog = {
  contentVersion: string;
  /** Revisions eligible for recommendation engines. */
  recommendable: ActivityRevision[];
  /** All validated revisions for historical lookup, including withdrawn. */
  byRevisionId: Map<string, ActivityRevision>;
};

/**
 * Build a recommendation catalog. Drafts, unfinished reviews, withdrawn items
 * and development fixtures never enter `recommendable`.
 */
export function buildPublishedCatalog(
  rawRevisions: unknown[],
  contentVersion: string,
): {
  catalog: ContentCatalog;
  rejected: Array<{ index: number; errors: { path: string; code: string; message: string }[] }>;
} {
  const recommendable: ActivityRevision[] = [];
  const byRevisionId = new Map<string, ActivityRevision>();
  const rejected: Array<{
    index: number;
    errors: { path: string; code: string; message: string }[];
  }> = [];

  rawRevisions.forEach((raw, index) => {
    const parsed = validateActivityRevision(raw);
    if (!parsed.ok || !parsed.revision) {
      rejected.push({ index, errors: parsed.errors });
      return;
    }
    const revision = parsed.revision;
    if (byRevisionId.has(revision.revisionId)) {
      rejected.push({
        index,
        errors: [
          {
            path: 'revisionId',
            code: 'duplicate_revision',
            message: `Duplicate revisionId "${revision.revisionId}".`,
          },
        ],
      });
      return;
    }
    byRevisionId.set(revision.revisionId, revision);
    if (isRecommendable(revision)) {
      recommendable.push(revision);
    }
  });

  return {
    catalog: { contentVersion, recommendable, byRevisionId },
    rejected,
  };
}

/**
 * Experiences store revision ids. Even after withdrawal or a newer publish, the
 * original wording stays readable for history.
 */
export function resolveHistoricalRevision(
  catalog: ContentCatalog,
  revisionId: string,
): ActivityRevision | null {
  return catalog.byRevisionId.get(revisionId) ?? null;
}

export function buildContentManifest(
  catalog: ContentCatalog,
  generatedAtMs: number,
): ContentManifest {
  const digests: Record<string, string> = {};
  const revisionIds = [...catalog.byRevisionId.keys()].sort();
  for (const revisionId of revisionIds) {
    const revision = catalog.byRevisionId.get(revisionId)!;
    digests[revisionId] = digestRevision(revision);
  }
  return {
    format: 'lumi.content-manifest.v1',
    contentVersion: catalog.contentVersion,
    generatedAtMs,
    revisionIds,
    digests,
  };
}

export function digestRevision(revision: ActivityRevision): string {
  // Stable JSON keeps the same revisionId from silently changing meaning.
  return bytesToHex(sha256(new TextEncoder().encode(stableStringify(revision))));
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_, nested) => {
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(nested as object).sort()) {
        sorted[key] = (nested as Record<string, unknown>)[key];
      }
      return sorted;
    }
    return nested;
  });
}
