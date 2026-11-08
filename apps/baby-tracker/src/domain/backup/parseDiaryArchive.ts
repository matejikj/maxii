import { z } from 'zod';
import { AppError } from '../errors';
import {
  DIARY_ARCHIVE_FORMAT,
  DIARY_ARCHIVE_MAX_COMPAT,
  createDiaryArchive,
  type DiaryArchive,
} from './diaryArchive';

/** Reject hostile archives before they inflate staging memory. */
export const MAX_DIARY_ARCHIVE_BYTES = 20 * 1024 * 1024;
export const MAX_DIARY_CARE_EVENTS = 50_000;
export const MAX_DIARY_RELATED_ROWS = 100_000;

const manifestSchema = z.object({
  createdAtMs: z.number().int().nonnegative(),
  schemaCompatibility: z.number().int().min(1).max(DIARY_ARCHIVE_MAX_COMPAT),
  childId: z.string().nullable(),
  displayName: z.string().nullable(),
  careEventCount: z.number().int().nonnegative(),
  draftCount: z.number().int().nonnegative(),
  deletionCount: z.number().int().nonnegative(),
  sessionCount: z.number().int().nonnegative(),
  newestCareSortAtMs: z.number().int().nullable(),
  oldestCareSortAtMs: z.number().int().nullable(),
});

/**
 * Keys that must never leave the device inside a portable diary file. Local
 * checkpoint bookkeeping is also excluded so replace imports stay clean.
 */
export function isExportableMetaKey(key: string): boolean {
  return !/^(auth|token|secret|password|refresh|device_key|ckpt_)/i.test(key);
}

export function filterExportableMeta(
  entries: { key: string; value: string }[],
): { key: string; value: string }[] {
  return entries.filter((entry) => isExportableMetaKey(entry.key));
}

/**
 * Validates a logical diary archive after decryption or staging paste. Rebuilds
 * the manifest from entities so a tampered count cannot hide a replace.
 */
export function parseDiaryArchive(raw: unknown, options: { maxBytes?: number } = {}): DiaryArchive {
  const maxBytes = options.maxBytes ?? MAX_DIARY_ARCHIVE_BYTES;
  const encoded = typeof raw === 'string' ? raw : JSON.stringify(raw);
  if (encoded.length > maxBytes) {
    throw new AppError('VALIDATION', 'Diary archive exceeds the supported size limit', {
      details: { reason: 'archive_too_large', bytes: encoded.length },
    });
  }

  let json: unknown = raw;
  if (typeof raw === 'string') {
    try {
      json = JSON.parse(raw);
    } catch {
      throw new AppError('VALIDATION', 'Diary archive is not valid JSON', {
        details: { reason: 'archive_json' },
      });
    }
  }

  if (json == null || typeof json !== 'object') {
    throw new AppError('VALIDATION', 'Diary archive root must be an object', {
      details: { reason: 'archive_shape' },
    });
  }

  const root = json as Record<string, unknown>;
  if (root.format !== DIARY_ARCHIVE_FORMAT) {
    throw new AppError('VALIDATION', 'Unsupported diary archive format', {
      details: { reason: 'archive_format' },
    });
  }

  const manifestParsed = manifestSchema.safeParse(root.manifest);
  if (!manifestParsed.success) {
    throw new AppError('VALIDATION', 'Diary archive manifest is invalid or too new', {
      details: { reason: 'archive_manifest' },
    });
  }

  const profiles = asArray(root.profiles, 'profiles');
  const careEvents = asArray(root.careEvents, 'careEvents');
  const sessions = asArray(root.sessions, 'sessions');
  const drafts = asArray(root.drafts, 'drafts');
  const revisions = asArray(root.revisions, 'revisions');
  const receipts = asArray(root.receipts, 'receipts');
  const deletions = asArray(root.deletions, 'deletions');
  const meta = asArray(root.meta, 'meta');

  if (careEvents.length > MAX_DIARY_CARE_EVENTS) {
    throw new AppError('VALIDATION', 'Diary archive contains too many care events', {
      details: { reason: 'archive_care_limit', count: careEvents.length },
    });
  }
  for (const [label, rows] of [
    ['sessions', sessions],
    ['drafts', drafts],
    ['revisions', revisions],
    ['receipts', receipts],
    ['deletions', deletions],
    ['meta', meta],
  ] as const) {
    if (rows.length > MAX_DIARY_RELATED_ROWS) {
      throw new AppError('VALIDATION', `Diary archive ${label} exceed supported limits`, {
        details: { reason: 'archive_related_limit', collection: label, count: rows.length },
      });
    }
  }

  // Rebuild so import always replaces from entity payloads, not caller-supplied counts.
  return createDiaryArchive({
    createdAtMs: manifestParsed.data.createdAtMs,
    schemaCompatibility: manifestParsed.data.schemaCompatibility,
    profiles: profiles as DiaryArchive['profiles'],
    careEvents: careEvents as DiaryArchive['careEvents'],
    sessions: sessions as DiaryArchive['sessions'],
    drafts: drafts as DiaryArchive['drafts'],
    revisions: revisions as DiaryArchive['revisions'],
    receipts: receipts as DiaryArchive['receipts'],
    deletions: deletions as DiaryArchive['deletions'],
    meta: filterExportableMeta(meta as DiaryArchive['meta']),
  });
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new AppError('VALIDATION', `Diary archive ${label} must be an array`, {
      details: { reason: 'archive_array', collection: label },
    });
  }
  return value;
}
