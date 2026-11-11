import type { VectorNode } from '../vector/types';

/** Stable tab / UI glyph identifiers. Additive only — do not renumber meanings. */
export const LUMI_ICON_IDS = [
  'today', 'care', 'development', 'history',
  'sleep', 'nursing', 'bottle', 'food', 'diaper', 'growth', 'plus', 'arrow-right',
  'experience', 'settings',
] as const;
export type LumiIconId = (typeof LUMI_ICON_IDS)[number];

/** Compact botanical icon document (not a full scene). */
export interface IconDocument {
  readonly schemaVersion: 1;
  readonly id: LumiIconId;
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly VectorNode[];
}

export interface CompileLumiIconOptions {
  /** Single tint applied to stroke and fill. */
  readonly color: string;
  /** Optional second tint for botanical/material details; defaults to color. */
  readonly accentColor?: string;
}
