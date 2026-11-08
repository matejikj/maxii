import { AppError } from '../../../domain/errors';

/**
 * Turning on the SQLCipher plugin does not encrypt an existing plaintext file.
 * Any legacy probe DB must be converted through this explicit path — never by
 * silently reopening the same path with PRAGMA key.
 */
export type PlaintextConversionRequest = {
  sourceDatabaseName: string;
  targetDatabaseName: string;
  /** Operator must set this after confirming the source is disposable test data. */
  acknowledgeDestructiveConversion: true;
};

export function assertExplicitPlaintextConversion(request: PlaintextConversionRequest): void {
  if (request.acknowledgeDestructiveConversion !== true) {
    throw new AppError(
      'VALIDATION',
      'Plaintext to SQLCipher conversion requires explicit acknowledgement',
      { details: { reason: 'conversion_ack' } },
    );
  }
  if (request.sourceDatabaseName === request.targetDatabaseName) {
    throw new AppError(
      'VALIDATION',
      'Refusing in-place plaintext conversion; write a new encrypted target file',
      { details: { reason: 'inplace_conversion' } },
    );
  }
}

/**
 * Product builds currently start encrypted from the first private open. This
 * helper documents the required operator step when a leftover plaintext probe
 * file is discovered during development.
 */
export function describePlaintextConversionPolicy(): string {
  return 'Detected plaintext SQLite must be exported, deleted, and recreated under SQLCipher; the plugin flag alone is not a data migration.';
}
