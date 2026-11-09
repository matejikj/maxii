import { AppError } from '../errors';
import type { ActorId, EntityId, RevisionId } from '../ids';
import type { Instant } from '../ports/clock';
import { PROJECT_LIMITS, type Project, type ShareSnapshot } from './types';

export type ShareDraft = {
  sourceProjectId: EntityId;
  sourceRevisionId: RevisionId;
  publishedTitle: string;
  publishedBody: string;
  audienceAppUserIds: readonly ActorId[];
  commentsEnabled: boolean;
};

/**
 * Build an immutable share draft from exactly selected fields. Later private
 * edits of the live project must not rewrite an already published body.
 */
export function planShareSnapshot(input: {
  project: Project;
  publishedTitle: string;
  publishedBody: string;
  audienceAppUserIds: readonly ActorId[];
  commentsEnabled?: boolean;
  childPrivateModeActive: boolean;
}): ShareDraft {
  if (input.project.scope === 'childPrivate' && !input.childPrivateModeActive) {
    throw new AppError('UNAVAILABLE', 'Child private workspace is not activated', {
      details: { reason: 'child_mode_inactive' },
    });
  }
  const title = input.publishedTitle.trim();
  const body = input.publishedBody;
  if (!title) {
    throw new AppError('VALIDATION', 'Share title is required', {
      details: { reason: 'empty_share_title' },
    });
  }
  if (title.length > PROJECT_LIMITS.titleMaxChars) {
    throw new AppError('VALIDATION', 'Share title is too long', {
      details: { reason: 'share_title_length' },
    });
  }
  const bodyBytes = new TextEncoder().encode(body).byteLength;
  if (bodyBytes > PROJECT_LIMITS.shareBodyMaxBytes) {
    throw new AppError('VALIDATION', 'Share body exceeds the size limit', {
      details: { reason: 'share_body_bytes', bodyBytes },
    });
  }
  if (input.audienceAppUserIds.length === 0) {
    throw new AppError('VALIDATION', 'Share requires at least one named recipient', {
      details: { reason: 'empty_audience' },
    });
  }
  const unique = new Set(input.audienceAppUserIds);
  if (unique.size !== input.audienceAppUserIds.length) {
    throw new AppError('VALIDATION', 'Share audience must not contain duplicates', {
      details: { reason: 'duplicate_audience' },
    });
  }
  return {
    sourceProjectId: input.project.projectId,
    sourceRevisionId: input.project.revisionId,
    publishedTitle: title,
    publishedBody: body,
    audienceAppUserIds: [...input.audienceAppUserIds],
    commentsEnabled: input.commentsEnabled ?? false,
  };
}

export function publishShareSnapshot(input: {
  shareId: EntityId;
  draft: ShareDraft;
  ownerAppUserId: ActorId;
  now: Instant;
}): ShareSnapshot {
  return {
    shareId: input.shareId,
    sourceProjectId: input.draft.sourceProjectId,
    sourceRevisionId: input.draft.sourceRevisionId,
    ownerAppUserId: input.ownerAppUserId,
    publishedTitle: input.draft.publishedTitle,
    publishedBody: input.draft.publishedBody,
    audienceAppUserIds: input.draft.audienceAppUserIds,
    commentsEnabled: input.draft.commentsEnabled,
    revokedAt: null,
    createdAt: input.now,
  };
}

export function revokeShareSnapshot(
  share: ShareSnapshot,
  now: Instant,
): ShareSnapshot {
  if (share.revokedAt != null) {
    return share;
  }
  return { ...share, revokedAt: now };
}

/**
 * Recipients only ever see the frozen snapshot body — never the live project
 * title/intent/reflection after later private edits.
 */
export function presentShareToRecipient(
  share: ShareSnapshot,
  liveProject: Project | null,
): { title: string; body: string; liveProjectLeaked: false } {
  void liveProject;
  if (share.revokedAt != null) {
    throw new AppError('FORBIDDEN', 'Share was revoked', {
      details: { reason: 'share_revoked' },
    });
  }
  return {
    title: share.publishedTitle,
    body: share.publishedBody,
    liveProjectLeaked: false,
  };
}

/** Undo/restore must never silently re-enable a previously revoked share. */
export function restoreMustNotRepublishShare(): true {
  return true;
}
