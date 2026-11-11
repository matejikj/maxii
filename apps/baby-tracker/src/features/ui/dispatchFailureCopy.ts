import type { AppError } from '../../domain';
import { PRODUCT_COPY } from './productCopy';

/** Caregiver-facing text for a failed dispatch — never includes care payloads. */
export function copyForDispatchFailure(error: AppError): string {
  switch (error.code) {
    case 'STORAGE':
      return PRODUCT_COPY.feedback.saveFailedStorage;
    case 'CONFLICT':
      return PRODUCT_COPY.feedback.saveFailedConflict;
    case 'VALIDATION':
      return PRODUCT_COPY.feedback.saveFailedValidation;
    default:
      return PRODUCT_COPY.feedback.saveFailed;
  }
}
