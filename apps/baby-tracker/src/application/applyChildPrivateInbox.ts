import {
  asActorId,
  asChildId,
  asEntityId,
  asRevisionId,
  isChildPrivateSyncKind,
  markChildPrivateInboxApplied,
  normalizeProjectRow,
  pendingChildPrivateInbox,
  type Instant,
  type LocalChildPrivateSyncState,
  type PortfolioItem,
  type Project,
  type ProjectStep,
  type ProjectStepStatus,
  type ProjectStatus,
  type ShareSnapshot,
  type UnitOfWorkFactory,
} from '../domain';
import type { InboxEntry } from '../domain/sync/transport';

export type ApplyChildPrivateInboxResult = {
  readonly state: LocalChildPrivateSyncState;
  readonly appliedUpserts: number;
  readonly appliedDeletes: number;
  readonly appliedShares: number;
  readonly rejected: number;
};

const PROJECT_STATUSES = new Set<ProjectStatus>([
  'idea',
  'active',
  'paused',
  'closed',
  'archived',
]);
const STEP_STATUSES = new Set<ProjectStepStatus>(['pending', 'tried', 'skipped']);

function asInstant(value: unknown, fallback: Instant): Instant {
  if (
    value &&
    typeof value === 'object' &&
    'epochMs' in value &&
    typeof (value as { epochMs: unknown }).epochMs === 'number' &&
    Number.isFinite((value as { epochMs: number }).epochMs)
  ) {
    return { epochMs: (value as { epochMs: number }).epochMs };
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return { epochMs: parsed };
  }
  return fallback;
}

function parseSteps(raw: unknown): ProjectStep[] | null {
  if (!Array.isArray(raw)) return null;
  const steps: ProjectStep[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') return null;
    const step = row as Record<string, unknown>;
    if (typeof step.stepId !== 'string' || typeof step.text !== 'string') return null;
    if (typeof step.order !== 'number' || !Number.isFinite(step.order)) return null;
    if (typeof step.status !== 'string' || !STEP_STATUSES.has(step.status as ProjectStepStatus)) {
      return null;
    }
    steps.push({
      stepId: asEntityId(step.stepId),
      order: step.order,
      text: step.text,
      status: step.status as ProjectStepStatus,
    });
  }
  return steps;
}

function parseProjectUpsert(
  entry: InboxEntry,
  ownerAppUserId: string,
  now: Instant,
  existing: Project | null,
): Project | null {
  const p = entry.payload;
  if (typeof p.projectId !== 'string' || typeof p.childId !== 'string') return null;
  if (typeof p.title !== 'string' || typeof p.intent !== 'string') return null;
  if (typeof p.status !== 'string' || !PROJECT_STATUSES.has(p.status as ProjectStatus)) {
    return null;
  }
  const steps = parseSteps(p.steps);
  if (!steps) return null;
  const reflection =
    p.reflection == null
      ? null
      : typeof p.reflection === 'string'
        ? p.reflection
        : null;
  if (p.reflection != null && reflection == null) return null;

  return normalizeProjectRow({
    projectId: asEntityId(p.projectId),
    revisionId: asRevisionId(entry.revisionId),
    scope: 'childPrivate',
    childId: asChildId(p.childId),
    ownerAppUserId: asActorId(ownerAppUserId),
    creatorAppUserId: asActorId(ownerAppUserId),
    familyId: null,
    templateRevisionId:
      typeof p.templateRevisionId === 'string'
        ? (p.templateRevisionId as Project['templateRevisionId'])
        : null,
    title: p.title,
    intent: p.intent,
    status: p.status as ProjectStatus,
    steps,
    reflection,
    variantNotes:
      p.variantNotes && typeof p.variantNotes === 'object'
        ? (p.variantNotes as Project['variantNotes'])
        : null,
    sourceNotes:
      p.sourceNotes && typeof p.sourceNotes === 'object'
        ? (p.sourceNotes as Project['sourceNotes'])
        : null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

function parsePortfolioUpsert(
  entry: InboxEntry,
  ownerAppUserId: string,
  now: Instant,
  existing: PortfolioItem | null,
): PortfolioItem | null {
  const p = entry.payload;
  if (typeof p.portfolioItemId !== 'string') return null;
  if (typeof p.projectId !== 'string' || typeof p.childId !== 'string') return null;
  if (typeof p.title !== 'string') return null;
  const description =
    p.description == null
      ? null
      : typeof p.description === 'string'
        ? p.description
        : null;
  if (p.description != null && description == null) return null;
  const item: PortfolioItem = {
    portfolioItemId: asEntityId(p.portfolioItemId),
    projectId: asEntityId(p.projectId),
    childId: asChildId(p.childId),
    ownerAppUserId: asActorId(ownerAppUserId),
    title: p.title,
    description,
    visibility: 'private',
    createdAt: existing?.createdAt ?? now,
  };
  if (typeof p.sortIndex === 'number' && Number.isFinite(p.sortIndex)) {
    return { ...item, sortIndex: p.sortIndex };
  }
  return item;
}

function parseSharePublish(
  entry: InboxEntry,
  fallbackOwnerAppUserId: string,
  now: Instant,
  existing: ShareSnapshot | null,
): ShareSnapshot | null {
  const p = entry.payload;
  if (!isChildPrivateSyncKind(entry.kind)) return null;
  if (typeof p.shareId !== 'string') return null;
  if (typeof p.sourceProjectId !== 'string' || typeof p.sourceRevisionId !== 'string') {
    return null;
  }
  if (typeof p.publishedTitle !== 'string' || typeof p.publishedBody !== 'string') {
    return null;
  }
  if (!Array.isArray(p.audienceAppUserIds) || p.audienceAppUserIds.length === 0) {
    return null;
  }
  if (!p.audienceAppUserIds.every((id) => typeof id === 'string' && id.length > 0)) {
    return null;
  }
  // Forbidden live private fields must never materialize from a share row.
  for (const key of ['reflection', 'intent', 'variantNotes', 'sourceNotes', 'steps']) {
    if (key in p) return null;
  }
  const ownerRaw =
    typeof p.ownerAppUserId === 'string' && p.ownerAppUserId.length > 0
      ? p.ownerAppUserId
      : fallbackOwnerAppUserId;
  if (!ownerRaw) return null;
  return {
    shareId: asEntityId(p.shareId),
    sourceProjectId: asEntityId(p.sourceProjectId),
    sourceRevisionId: asRevisionId(p.sourceRevisionId),
    ownerAppUserId: asActorId(ownerRaw),
    publishedTitle: p.publishedTitle,
    publishedBody: p.publishedBody,
    audienceAppUserIds: p.audienceAppUserIds.map((id) => asActorId(id as string)),
    commentsEnabled: p.commentsEnabled === true,
    revokedAt: null,
    createdAt: existing?.createdAt ?? now,
  };
}

/**
 * Materialize unapplied child-private inbox rows into the local diary.
 * Unknown/invalid rows are counted as rejected and still marked applied so a
 * poison payload cannot block the rest of the stream forever.
 */
export async function applyChildPrivateInboxToWorkspace(input: {
  readonly state: LocalChildPrivateSyncState;
  readonly unitOfWork: UnitOfWorkFactory;
  readonly now: Instant;
  /** Authenticated principal — used when a share payload omits ownerAppUserId. */
  readonly sessionAppUserId: string | null;
}): Promise<ApplyChildPrivateInboxResult> {
  const pending = pendingChildPrivateInbox(input.state);
  if (pending.length === 0) {
    return {
      state: input.state,
      appliedUpserts: 0,
      appliedDeletes: 0,
      appliedShares: 0,
      rejected: 0,
    };
  }

  let appliedUpserts = 0;
  let appliedDeletes = 0;
  let appliedShares = 0;
  let rejected = 0;
  const appliedIds: string[] = [];

  await input.unitOfWork.run(async (uow) => {
    for (const entry of pending) {
      if (!isChildPrivateSyncKind(entry.kind)) {
        rejected += 1;
        appliedIds.push(entry.operationId);
        continue;
      }

      try {
        if (entry.kind === 'child_private.project.upsert') {
          const owner =
            input.state.ownerAppUserId ??
            input.sessionAppUserId ??
            (typeof entry.payload.ownerAppUserId === 'string'
              ? entry.payload.ownerAppUserId
              : null);
          if (!owner) {
            rejected += 1;
            appliedIds.push(entry.operationId);
            continue;
          }
          const existing = await uow.projects.getById(asEntityId(entry.entityId));
          const project = parseProjectUpsert(entry, owner, input.now, existing);
          if (!project) {
            rejected += 1;
            appliedIds.push(entry.operationId);
            continue;
          }
          await uow.projects.save(project);
          appliedUpserts += 1;
          appliedIds.push(entry.operationId);
          continue;
        }

        if (entry.kind === 'child_private.project.delete') {
          const projectId =
            typeof entry.payload.projectId === 'string'
              ? entry.payload.projectId
              : entry.entityId;
          await uow.projects.delete(asEntityId(projectId));
          appliedDeletes += 1;
          appliedIds.push(entry.operationId);
          continue;
        }

        if (entry.kind === 'child_private.portfolio.upsert') {
          const owner =
            input.state.ownerAppUserId ??
            input.sessionAppUserId ??
            (typeof entry.payload.ownerAppUserId === 'string'
              ? entry.payload.ownerAppUserId
              : null);
          if (!owner) {
            rejected += 1;
            appliedIds.push(entry.operationId);
            continue;
          }
          const existing = await uow.portfolio.getById(asEntityId(entry.entityId));
          const item = parsePortfolioUpsert(entry, owner, input.now, existing);
          if (!item) {
            rejected += 1;
            appliedIds.push(entry.operationId);
            continue;
          }
          await uow.portfolio.save(item);
          appliedUpserts += 1;
          appliedIds.push(entry.operationId);
          continue;
        }

        if (entry.kind === 'child_private.portfolio.delete') {
          const portfolioItemId =
            typeof entry.payload.portfolioItemId === 'string'
              ? entry.payload.portfolioItemId
              : entry.entityId;
          await uow.portfolio.delete(asEntityId(portfolioItemId));
          appliedDeletes += 1;
          appliedIds.push(entry.operationId);
          continue;
        }

        if (entry.kind === 'child_private.share.publish') {
          const existing = await uow.shares.getById(asEntityId(entry.entityId));
          const share = parseSharePublish(
            entry,
            input.state.ownerAppUserId ?? input.sessionAppUserId ?? '',
            input.now,
            existing,
          );
          if (!share) {
            rejected += 1;
            appliedIds.push(entry.operationId);
            continue;
          }
          await uow.shares.save(share);
          appliedShares += 1;
          appliedIds.push(entry.operationId);
          continue;
        }

        if (entry.kind === 'child_private.share.revoke') {
          const shareId =
            typeof entry.payload.shareId === 'string'
              ? entry.payload.shareId
              : entry.entityId;
          const existing = await uow.shares.getById(asEntityId(shareId));
          const revokedAt = asInstant(entry.payload.revokedAt, input.now);
          if (!existing) {
            // Materialize a revoked placeholder so later undo/restore cannot revive it.
            const sourceProjectId =
              typeof entry.payload.sourceProjectId === 'string'
                ? entry.payload.sourceProjectId
                : shareId;
            const ownerRaw =
              typeof entry.payload.ownerAppUserId === 'string'
                ? entry.payload.ownerAppUserId
                : input.state.ownerAppUserId ?? input.sessionAppUserId;
            if (!ownerRaw) {
              rejected += 1;
              appliedIds.push(entry.operationId);
              continue;
            }
            await uow.shares.save({
              shareId: asEntityId(shareId),
              sourceProjectId: asEntityId(sourceProjectId),
              sourceRevisionId: asRevisionId(entry.revisionId),
              ownerAppUserId: asActorId(ownerRaw),
              publishedTitle: '',
              publishedBody: '',
              audienceAppUserIds: [],
              commentsEnabled: false,
              revokedAt,
              createdAt: input.now,
            });
          } else if (existing.revokedAt == null) {
            await uow.shares.save({ ...existing, revokedAt });
          }
          appliedShares += 1;
          appliedIds.push(entry.operationId);
          continue;
        }

        rejected += 1;
        appliedIds.push(entry.operationId);
      } catch {
        rejected += 1;
        appliedIds.push(entry.operationId);
      }
    }
  });

  return {
    state: markChildPrivateInboxApplied(input.state, appliedIds),
    appliedUpserts,
    appliedDeletes,
    appliedShares,
    rejected,
  };
}
