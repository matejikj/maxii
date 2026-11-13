import {
  ALLOWED_CONTENT_MIME,
  CONTENT_FILE_KINDS,
  CONTENT_PACK_FORMAT,
  CONTENT_PACK_KINDS,
  CONTENT_PACK_LIMITS,
} from './limits';
import type { ContentPackFileEntry, ContentPackManifest } from './types';

export type PackFieldError = { path: string; code: string; message: string };

const PACK_ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const LOGICAL_ID_RE = /^[a-z0-9][a-z0-9._/-]{0,127}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

/**
 * Structural validation of a content-pack manifest before signature checks.
 * Rejects path traversal, unknown keys, and oversize envelopes.
 */
export function validateContentPackManifest(
  raw: unknown,
): { ok: true; manifest: ContentPackManifest } | { ok: false; errors: PackFieldError[] } {
  const errors: PackFieldError[] = [];
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      errors: [{ path: '', code: 'manifest_shape', message: 'Manifest must be a JSON object.' }],
    };
  }

  const record = raw as Record<string, unknown>;
  const allowedKeys = new Set([
    'format',
    'packId',
    'kind',
    'generation',
    'readerVersion',
    'catalogVersion',
    'collectionVersion',
    'rulesVersion',
    'language',
    'ageMonths',
    'activityRevisionIds',
    'capabilities',
    'files',
    'totalBytes',
    'createdAt',
  ]);
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      errors.push({ path: key, code: 'unknown_key', message: `Unexpected manifest key "${key}".` });
    }
  }

  if (record.format !== CONTENT_PACK_FORMAT) {
    errors.push({
      path: 'format',
      code: 'format',
      message: `Expected format ${CONTENT_PACK_FORMAT}.`,
    });
  }

  const packId = requireAsciiId(record.packId, 'packId', PACK_ID_RE, errors);
  const kind = requireEnum(record.kind, 'kind', CONTENT_PACK_KINDS, errors);
  const generation = requirePositiveInt(record.generation, 'generation', errors);
  const readerVersion = requireNonEmptyString(record.readerVersion, 'readerVersion', errors);
  const catalogVersion = requireNonEmptyString(record.catalogVersion, 'catalogVersion', errors);
  const collectionVersion = requireNonEmptyString(
    record.collectionVersion,
    'collectionVersion',
    errors,
  );
  const rulesVersion = requireNonEmptyString(record.rulesVersion, 'rulesVersion', errors);
  if (record.language !== 'cs') {
    errors.push({
      path: 'language',
      code: 'language',
      message: 'Only cs content packs are supported.',
    });
  }

  let ageMonths: ContentPackManifest['ageMonths'] | null = null;
  if (
    record.ageMonths == null ||
    typeof record.ageMonths !== 'object' ||
    Array.isArray(record.ageMonths)
  ) {
    errors.push({ path: 'ageMonths', code: 'ageMonths', message: 'ageMonths must be an object.' });
  } else {
    const age = record.ageMonths as Record<string, unknown>;
    const fromInclusive = requireNonNegativeInt(
      age.fromInclusive,
      'ageMonths.fromInclusive',
      errors,
    );
    const toInclusive = requireNonNegativeInt(age.toInclusive, 'ageMonths.toInclusive', errors);
    if (fromInclusive != null && toInclusive != null) {
      if (toInclusive < fromInclusive) {
        errors.push({
          path: 'ageMonths',
          code: 'age_range',
          message: 'toInclusive must be >= fromInclusive.',
        });
      } else if (toInclusive > 11 && kind === 'base') {
        errors.push({
          path: 'ageMonths.toInclusive',
          code: 'first_birthday',
          message: 'Base first-year pack must end before the first birthday (toInclusive <= 11).',
        });
      } else {
        ageMonths = { fromInclusive, toInclusive };
      }
    }
  }

  const activityRevisionIds = requireStringArray(
    record.activityRevisionIds,
    'activityRevisionIds',
    errors,
  );
  const capabilities = requireStringArray(record.capabilities, 'capabilities', errors);
  const files = parseFiles(record.files, errors);
  const totalBytes = requireNonNegativeInt(record.totalBytes, 'totalBytes', errors);
  const createdAt = requireNonEmptyString(record.createdAt, 'createdAt', errors);

  if (files && totalBytes != null) {
    const sum = files.reduce((acc, file) => acc + file.byteLength, 0);
    if (sum !== totalBytes) {
      errors.push({
        path: 'totalBytes',
        code: 'total_bytes',
        message: 'totalBytes must equal the sum of file byteLength values.',
      });
    }
    if (sum > CONTENT_PACK_LIMITS.maxPackBytes) {
      errors.push({
        path: 'totalBytes',
        code: 'pack_too_large',
        message: 'Pack exceeds the total byte budget.',
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    manifest: {
      format: CONTENT_PACK_FORMAT,
      packId: packId!,
      kind: kind!,
      generation: generation!,
      readerVersion: readerVersion!,
      catalogVersion: catalogVersion!,
      collectionVersion: collectionVersion!,
      rulesVersion: rulesVersion!,
      language: 'cs',
      ageMonths: ageMonths!,
      activityRevisionIds: activityRevisionIds!,
      capabilities: capabilities!,
      files: files!,
      totalBytes: totalBytes!,
      createdAt: createdAt!,
    },
  };
}

function parseFiles(value: unknown, errors: PackFieldError[]): ContentPackFileEntry[] | null {
  if (!Array.isArray(value)) {
    errors.push({ path: 'files', code: 'files', message: 'files must be an array.' });
    return null;
  }
  if (value.length > CONTENT_PACK_LIMITS.maxFiles) {
    errors.push({ path: 'files', code: 'too_many_files', message: 'Too many files in the pack.' });
  }
  const out: ContentPackFileEntry[] = [];
  const seen = new Set<string>();
  for (const [index, item] of value.entries()) {
    if (item == null || typeof item !== 'object' || Array.isArray(item)) {
      errors.push({
        path: `files[${index}]`,
        code: 'file_shape',
        message: 'File entry must be an object.',
      });
      continue;
    }
    const record = item as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!['logicalId', 'kind', 'mime', 'byteLength', 'sha256'].includes(key)) {
        errors.push({
          path: `files[${index}].${key}`,
          code: 'unknown_key',
          message: `Unexpected file key "${key}".`,
        });
      }
    }
    const logicalId = requireAsciiId(
      record.logicalId,
      `files[${index}].logicalId`,
      LOGICAL_ID_RE,
      errors,
    );
    if (logicalId) {
      if (logicalId.includes('..') || logicalId.startsWith('/') || logicalId.includes('\\')) {
        errors.push({
          path: `files[${index}].logicalId`,
          code: 'unsafe_path',
          message: 'logicalId must not contain path traversal.',
        });
      }
      if (seen.has(logicalId)) {
        errors.push({
          path: `files[${index}].logicalId`,
          code: 'duplicate_logical_id',
          message: `Duplicate logicalId "${logicalId}".`,
        });
      } else {
        seen.add(logicalId);
      }
    }
    const kind = requireEnum(record.kind, `files[${index}].kind`, CONTENT_FILE_KINDS, errors);
    const mime = requireNonEmptyString(record.mime, `files[${index}].mime`, errors);
    if (kind && mime && ALLOWED_CONTENT_MIME[kind] !== mime) {
      errors.push({
        path: `files[${index}].mime`,
        code: 'mime',
        message: `MIME ${mime} is not allowed for kind ${kind}.`,
      });
    }
    const byteLength = requireNonNegativeInt(
      record.byteLength,
      `files[${index}].byteLength`,
      errors,
    );
    if (byteLength != null && byteLength > CONTENT_PACK_LIMITS.maxFileBytes) {
      errors.push({
        path: `files[${index}].byteLength`,
        code: 'file_too_large',
        message: 'File exceeds the per-file budget.',
      });
    }
    const sha256 =
      typeof record.sha256 === 'string' && SHA256_RE.test(record.sha256) ? record.sha256 : null;
    if (!sha256) {
      errors.push({
        path: `files[${index}].sha256`,
        code: 'sha256',
        message: 'sha256 must be a 64-char lowercase hex digest.',
      });
    }
    if (logicalId && kind && mime && byteLength != null && sha256) {
      out.push({ logicalId, kind, mime, byteLength, sha256 });
    }
  }
  return out;
}

function requireAsciiId(
  value: unknown,
  path: string,
  pattern: RegExp,
  errors: PackFieldError[],
): string | null {
  if (typeof value !== 'string' || !pattern.test(value)) {
    errors.push({ path, code: 'id', message: `${path} must be a safe ASCII identifier.` });
    return null;
  }
  return value;
}

function requireNonEmptyString(
  value: unknown,
  path: string,
  errors: PackFieldError[],
): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push({ path, code: 'string', message: `${path} must be a non-empty string.` });
    return null;
  }
  if (utf8Length(value) > CONTENT_PACK_LIMITS.maxGenericStringBytes) {
    errors.push({ path, code: 'string_too_large', message: `${path} exceeds string budget.` });
    return null;
  }
  return value;
}

function requireStringArray(
  value: unknown,
  path: string,
  errors: PackFieldError[],
): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    errors.push({ path, code: 'string_array', message: `${path} must be an array of strings.` });
    return null;
  }
  return value as string[];
}

function requirePositiveInt(value: unknown, path: string, errors: PackFieldError[]): number | null {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > Number.MAX_SAFE_INTEGER
  ) {
    errors.push({
      path,
      code: 'positive_int',
      message: `${path} must be a positive safe integer.`,
    });
    return null;
  }
  return value;
}

function requireNonNegativeInt(
  value: unknown,
  path: string,
  errors: PackFieldError[],
): number | null {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > Number.MAX_SAFE_INTEGER
  ) {
    errors.push({
      path,
      code: 'non_negative_int',
      message: `${path} must be a non-negative safe integer.`,
    });
    return null;
  }
  return value;
}

function requireEnum<T extends string>(
  value: unknown,
  path: string,
  allowed: readonly T[],
  errors: PackFieldError[],
): T | null {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    errors.push({
      path,
      code: 'enum',
      message: `${path} must be one of: ${allowed.join(', ')}.`,
    });
    return null;
  }
  return value as T;
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
