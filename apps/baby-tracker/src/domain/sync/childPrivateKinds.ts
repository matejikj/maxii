/**
 * Dedicated child-private sync kinds. These must never travel on the family
 * care outbox — the private workspace has its own owner-scoped stream.
 */
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

/**
 * Share payloads are frozen snapshots. Live reflection / intent fields are
 * rejected so a buggy enqueue cannot leak private revisions onto the wire.
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
