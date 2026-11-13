import { AppError } from '../domain';
import { NATIVE_SCHEMA_COMPATIBILITY, WEB_SCHEMA_COMPATIBILITY } from './releaseEvidence';

/**
 * Refuse to open a diary written by a newer binary. Rolling back the app must
 * not quietly rewrite or pretend to understand an unknown schema generation.
 */
export function assertSchemaCompatibleWithBinary(input: {
  platform: 'native' | 'web';
  databaseSchemaVersion: number;
}): void {
  const max = input.platform === 'native' ? NATIVE_SCHEMA_COMPATIBILITY : WEB_SCHEMA_COMPATIBILITY;
  if (input.databaseSchemaVersion > max) {
    throw new AppError(
      'STORAGE',
      'This app build cannot open a newer diary schema; restore a matching build or export first',
      {
        details: {
          reason: 'schema_too_new_for_binary',
          databaseSchemaVersion: input.databaseSchemaVersion,
          binaryMaxSchema: max,
        },
      },
    );
  }
  if (input.databaseSchemaVersion < 1) {
    throw new AppError('STORAGE', 'Diary schema version is invalid', {
      details: { reason: 'schema_invalid', databaseSchemaVersion: input.databaseSchemaVersion },
    });
  }
}

export function canBinaryOpenSchema(input: {
  platform: 'native' | 'web';
  databaseSchemaVersion: number;
}): boolean {
  try {
    assertSchemaCompatibleWithBinary(input);
    return true;
  } catch {
    return false;
  }
}
