import { FIRST_YEAR_PUBLISHED_REVISIONS } from './firstYearPublished';
import {
  TODDLER_1_2_PUBLISHED_CONTENT_VERSION,
  TODDLER_1_2_PUBLISHED_REVISIONS,
} from './toddler12Published';
import type { ActivityRevision } from '../model/types';

/**
 * Install-local recommendable product catalog. First-year base plus published
 * toddler expansion; personal mode never requires a remote download.
 */
export const PRODUCT_PUBLISHED_CONTENT_VERSION =
  `first-year.v1+${TODDLER_1_2_PUBLISHED_CONTENT_VERSION}` as const;

export const PRODUCT_PUBLISHED_REVISIONS: readonly ActivityRevision[] = [
  ...FIRST_YEAR_PUBLISHED_REVISIONS,
  ...TODDLER_1_2_PUBLISHED_REVISIONS,
];

export const PRODUCT_SUPPORTED_AGE_MONTHS = {
  fromInclusive: 0,
  toInclusive: 23,
} as const;
