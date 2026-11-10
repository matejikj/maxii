import { z } from 'zod';
import { AppError } from '../errors';
import { asActorId, asChildId, asEntityId, asRevisionId } from '../ids';
import {
  CHILD_PRIVATE_ARCHIVE_FORMAT,
  CHILD_PRIVATE_ARCHIVE_MAX_COMPAT,
  buildChildPrivateArchiveManifest,
  type ChildPrivateArchive,
} from './childPrivateArchive';
import { CHILD_PRIVATE_EXPORT_EXCLUDED_CATEGORIES } from './childPrivateExport';
import type { PortfolioItem, Project, ProjectStep, ShareSnapshot } from './types';

/** Reject hostile archives before they inflate staging memory. */
export const MAX_CHILD_PRIVATE_ARCHIVE_BYTES = 4 * 1024 * 1024;
export const MAX_CHILD_PRIVATE_ARCHIVE_PROJECTS = 2_000;
export const MAX_CHILD_PRIVATE_ARCHIVE_RELATED = 10_000;

const instantSchema = z.object({
  epochMs: z.number().finite(),
});

const stepSchema = z.object({
  stepId: z.string().min(1),
  order: z.number().int().nonnegative(),
  text: z.string(),
  status: z.enum(['pending', 'tried', 'skipped']),
});

const projectSchema = z.object({
  projectId: z.string().min(1),
  revisionId: z.string().min(1),
  scope: z.literal('childPrivate'),
  childId: z.string().min(1),
  ownerAppUserId: z.string().min(1),
  creatorAppUserId: z.string().nullable(),
  familyId: z.string().nullable(),
  templateRevisionId: z.string().nullable(),
  title: z.string(),
  intent: z.string(),
  status: z.enum(['idea', 'active', 'paused', 'closed', 'archived']),
  steps: z.array(stepSchema).max(12),
  reflection: z.string().nullable(),
  variantNotes: z
    .object({
      optionA: z.string(),
      optionB: z.string(),
      chosenNote: z.string().nullable(),
    })
    .nullable()
    .optional(),
  sourceNotes: z
    .object({
      question: z.string(),
      sourceLabel: z.string(),
      checkedOn: z.string().nullable(),
      supportedClaim: z.string(),
      openQuestion: z.string().nullable(),
      verifiedOnline: z.boolean(),
    })
    .nullable()
    .optional(),
  createdAt: instantSchema,
  updatedAt: instantSchema,
});

const portfolioSchema = z.object({
  portfolioItemId: z.string().min(1),
  projectId: z.string().min(1),
  childId: z.string().min(1),
  ownerAppUserId: z.string().min(1),
  title: z.string(),
  description: z.string().nullable(),
  visibility: z.literal('private'),
  sortIndex: z.number().int().optional(),
  createdAt: instantSchema,
});

const shareSchema = z.object({
  shareId: z.string().min(1),
  sourceProjectId: z.string().min(1),
  sourceRevisionId: z.string().min(1),
  ownerAppUserId: z.string().min(1),
  publishedTitle: z.string(),
  publishedBody: z.string(),
  audienceAppUserIds: z.array(z.string().min(1)),
  commentsEnabled: z.boolean(),
  revokedAt: instantSchema.nullable(),
  createdAt: instantSchema,
});

const manifestSchema = z.object({
  format: z.literal(CHILD_PRIVATE_ARCHIVE_FORMAT).optional(),
  createdAtMs: z.number().int().nonnegative(),
  schemaCompatibility: z.number().int().min(1).max(CHILD_PRIVATE_ARCHIVE_MAX_COMPAT),
  ownerAppUserId: z.string().min(1),
  projectCount: z.number().int().nonnegative(),
  portfolioCount: z.number().int().nonnegative(),
  shareCount: z.number().int().nonnegative(),
  activeShareCount: z.number().int().nonnegative(),
  revokedShareCount: z.number().int().nonnegative(),
  excludedFamilyHistory: z.literal(true),
  excludedCategories: z.array(z.string()).min(1),
});

function mapStep(raw: z.infer<typeof stepSchema>): ProjectStep {
  return {
    stepId: asEntityId(raw.stepId),
    order: raw.order,
    text: raw.text,
    status: raw.status,
  };
}

function mapProject(raw: z.infer<typeof projectSchema>): Project {
  return {
    projectId: asEntityId(raw.projectId),
    revisionId: asRevisionId(raw.revisionId),
    scope: 'childPrivate',
    childId: asChildId(raw.childId),
    ownerAppUserId: asActorId(raw.ownerAppUserId),
    creatorAppUserId: raw.creatorAppUserId != null ? asActorId(raw.creatorAppUserId) : null,
    familyId: raw.familyId,
    templateRevisionId: raw.templateRevisionId as Project['templateRevisionId'],
    title: raw.title,
    intent: raw.intent,
    status: raw.status,
    steps: raw.steps.map(mapStep),
    reflection: raw.reflection,
    variantNotes: raw.variantNotes ?? null,
    sourceNotes: raw.sourceNotes ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function mapPortfolio(raw: z.infer<typeof portfolioSchema>): PortfolioItem {
  const item: PortfolioItem = {
    portfolioItemId: asEntityId(raw.portfolioItemId),
    projectId: asEntityId(raw.projectId),
    childId: asChildId(raw.childId),
    ownerAppUserId: asActorId(raw.ownerAppUserId),
    title: raw.title,
    description: raw.description,
    visibility: 'private',
    createdAt: raw.createdAt,
  };
  if (raw.sortIndex != null) {
    return { ...item, sortIndex: raw.sortIndex };
  }
  return item;
}

function mapShare(raw: z.infer<typeof shareSchema>): ShareSnapshot {
  return {
    shareId: asEntityId(raw.shareId),
    sourceProjectId: asEntityId(raw.sourceProjectId),
    sourceRevisionId: asRevisionId(raw.sourceRevisionId),
    ownerAppUserId: asActorId(raw.ownerAppUserId),
    publishedTitle: raw.publishedTitle,
    publishedBody: raw.publishedBody,
    audienceAppUserIds: raw.audienceAppUserIds.map((id) => asActorId(id)),
    commentsEnabled: raw.commentsEnabled,
    revokedAt: raw.revokedAt,
    createdAt: raw.createdAt,
  };
}

/**
 * Validates a logical child-private archive after decryption or paste. Rebuilds
 * the manifest from entities so counts cannot hide foreign rows.
 */
export function parseChildPrivateArchive(
  raw: unknown,
  options: { maxBytes?: number } = {},
): ChildPrivateArchive {
  const maxBytes = options.maxBytes ?? MAX_CHILD_PRIVATE_ARCHIVE_BYTES;
  const encoded = typeof raw === 'string' ? raw : JSON.stringify(raw);
  if (encoded.length > maxBytes) {
    throw new AppError('VALIDATION', 'Child private archive exceeds the supported size limit', {
      details: { reason: 'archive_too_large', bytes: encoded.length },
    });
  }

  let json: unknown = raw;
  if (typeof raw === 'string') {
    try {
      json = JSON.parse(raw);
    } catch {
      throw new AppError('VALIDATION', 'Child private archive is not valid JSON', {
        details: { reason: 'archive_json' },
      });
    }
  }
  if (json == null || typeof json !== 'object') {
    throw new AppError('VALIDATION', 'Child private archive root must be an object', {
      details: { reason: 'archive_shape' },
    });
  }

  const root = json as Record<string, unknown>;
  if (root.format !== CHILD_PRIVATE_ARCHIVE_FORMAT) {
    throw new AppError('VALIDATION', 'Unsupported child private archive format', {
      details: { reason: 'archive_format' },
    });
  }

  // Hard reject diary-shaped payloads that someone renamed into this format.
  if ('careEvents' in root || 'sessions' in root || 'receipts' in root) {
    throw new AppError('VALIDATION', 'Child private archive must not contain diary payloads', {
      details: { reason: 'diary_payload_forbidden' },
    });
  }
  if ('credentials' in root || 'tokens' in root || 'auth' in root) {
    throw new AppError('VALIDATION', 'Child private archive must not contain credentials', {
      details: { reason: 'credentials_forbidden' },
    });
  }

  const manifestParsed = manifestSchema.safeParse(root.manifest);
  if (!manifestParsed.success) {
    throw new AppError('VALIDATION', 'Child private archive manifest is invalid', {
      details: { reason: 'archive_manifest', issueCount: manifestParsed.error.issues.length },
    });
  }

  const projectsParsed = z.array(projectSchema).safeParse(root.projects ?? []);
  const portfolioParsed = z.array(portfolioSchema).safeParse(root.portfolio ?? []);
  const sharesParsed = z.array(shareSchema).safeParse(root.shares ?? []);
  if (!projectsParsed.success || !portfolioParsed.success || !sharesParsed.success) {
    throw new AppError('VALIDATION', 'Child private archive entities are invalid', {
      details: { reason: 'archive_entities' },
    });
  }
  if (projectsParsed.data.length > MAX_CHILD_PRIVATE_ARCHIVE_PROJECTS) {
    throw new AppError('VALIDATION', 'Child private archive has too many projects', {
      details: { reason: 'too_many_projects' },
    });
  }
  if (
    portfolioParsed.data.length + sharesParsed.data.length >
    MAX_CHILD_PRIVATE_ARCHIVE_RELATED
  ) {
    throw new AppError('VALIDATION', 'Child private archive has too many related rows', {
      details: { reason: 'too_many_related' },
    });
  }

  const ownerAppUserId = asActorId(manifestParsed.data.ownerAppUserId);
  const projects = projectsParsed.data.map(mapProject);
  const portfolio = portfolioParsed.data.map(mapPortfolio);
  const shares = sharesParsed.data.map(mapShare);

  for (const project of projects) {
    if (project.scope !== 'childPrivate') {
      throw new AppError('VALIDATION', 'Child private archive cannot include familyGuided rows', {
        details: { reason: 'family_guided_forbidden' },
      });
    }
    if (project.ownerAppUserId !== ownerAppUserId) {
      throw new AppError('VALIDATION', 'Child private archive mixes owners', {
        details: { reason: 'owner_mismatch', projectId: project.projectId },
      });
    }
  }
  for (const item of portfolio) {
    if (item.ownerAppUserId !== ownerAppUserId) {
      throw new AppError('VALIDATION', 'Child private archive mixes portfolio owners', {
        details: { reason: 'portfolio_owner_mismatch' },
      });
    }
  }
  for (const share of shares) {
    if (share.ownerAppUserId !== ownerAppUserId) {
      throw new AppError('VALIDATION', 'Child private archive mixes share owners', {
        details: { reason: 'share_owner_mismatch' },
      });
    }
  }

  const expectedCategories = new Set(CHILD_PRIVATE_EXPORT_EXCLUDED_CATEGORIES);
  for (const category of manifestParsed.data.excludedCategories) {
    if (!expectedCategories.has(category as (typeof CHILD_PRIVATE_EXPORT_EXCLUDED_CATEGORIES)[number])) {
      throw new AppError('VALIDATION', 'Child private archive claims an unknown exclusion', {
        details: { reason: 'unknown_exclusion', category },
      });
    }
  }

  const manifest = buildChildPrivateArchiveManifest({
    ownerAppUserId,
    createdAtMs: manifestParsed.data.createdAtMs,
    schemaCompatibility: manifestParsed.data.schemaCompatibility,
    projects,
    portfolio,
    shares,
  });

  return {
    format: CHILD_PRIVATE_ARCHIVE_FORMAT,
    manifest,
    projects,
    portfolio,
    shares,
  };
}
