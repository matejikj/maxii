import type { AppUserId } from './ids.ts';
import { LUMI_API_PROTOCOL_VERSION } from './protocol.ts';
import type { SyncChangelogEntry, SyncCursor, SyncOperationReceipt } from './sync.ts';

/** Dedicated kinds — must never travel on the family sync endpoint. */
export const CHILD_PRIVATE_SYNC_KINDS = [
  'child_private.project.upsert',
  'child_private.project.delete',
  'child_private.portfolio.upsert',
  'child_private.portfolio.delete',
  'child_private.share.publish',
  'child_private.share.revoke',
] as const;

export type ChildPrivateSyncOperationKind = (typeof CHILD_PRIVATE_SYNC_KINDS)[number];

export function isChildPrivateSyncKind(kind: string): kind is ChildPrivateSyncOperationKind {
  return (CHILD_PRIVATE_SYNC_KINDS as readonly string[]).includes(kind);
}

export function isChildPrivateShareKind(kind: string): boolean {
  return kind === 'child_private.share.publish' || kind === 'child_private.share.revoke';
}

export type ChildPrivateSyncPushRequest = {
  readonly protocolVersion: typeof LUMI_API_PROTOCOL_VERSION;
  readonly attemptId: string;
  readonly operations: readonly import('./sync.ts').SyncOperation[];
  readonly writerGeneration?: number;
};

export type ChildPrivateSyncPushResponse = {
  /** Workspace owner of the pushed stream — never a family id. */
  readonly ownerAppUserId: AppUserId;
  readonly attemptId: string;
  readonly epoch: number;
  readonly receipts: readonly SyncOperationReceipt[];
};

export type ChildPrivateSyncPullResponse = {
  readonly ownerAppUserId: AppUserId | null;
  readonly epoch: number;
  readonly entries: readonly SyncChangelogEntry[];
  readonly nextCursor: SyncCursor | null;
  readonly resyncRequired: boolean;
  /** Recipients never receive live private project rows on this stream. */
  readonly includesLivePrivateProjects: false;
};

/**
 * Share publish/revoke payloads must stay frozen snapshots. Live reflection /
 * intent fields are rejected so a bug cannot leak private revisions.
 */
export function childPrivateSharePayloadIsSafe(
  payload: Readonly<Record<string, unknown>>,
): boolean {
  const forbidden = ['reflection', 'intent', 'variantNotes', 'sourceNotes', 'steps'];
  for (const key of forbidden) {
    if (key in payload) return false;
  }
  const title = payload.publishedTitle;
  const body = payload.publishedBody;
  const audience = payload.audienceAppUserIds;
  if (typeof title !== 'string' || title.trim().length === 0) return false;
  if (typeof body !== 'string') return false;
  if (!Array.isArray(audience) || audience.length === 0) return false;
  return audience.every((id) => typeof id === 'string' && id.length > 0);
}

export function childPrivateShareAudience(
  payload: Readonly<Record<string, unknown>>,
): readonly string[] {
  const audience = payload.audienceAppUserIds;
  if (!Array.isArray(audience)) return [];
  return audience.filter((id): id is string => typeof id === 'string');
}
