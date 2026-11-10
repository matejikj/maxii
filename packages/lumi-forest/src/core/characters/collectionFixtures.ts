import type { CharacterPose, CharacterExpression, CharacterProportions } from './blueprint';
import type { CharacterSemanticState } from './collection';

/**
 * Anatomical and presentation fixtures for gallery review: extreme but still
 * legal proportions, light/dark mats, and safe UI margins around companions.
 */
export const COLLECTION_SCALE_FIXTURES = {
  chip24: { width: 24, height: 26 },
  chip32: { width: 32, height: 34 },
  compact: { width: 48, height: 52 },
  guide: { width: 96, height: 104 },
  hero144: { width: 144, height: 156 },
  hero: { width: 168, height: 180 },
  hero256: { width: 256, height: 276 },
} as const;

export const COLLECTION_BACKGROUND_FIXTURES = {
  light: '#FAF7F1',
  dark: '#24312E',
} as const;

/** Keep UI chrome outside this inset when overlaying companion drawings. */
export const COLLECTION_SAFE_UI_INSET = {
  top: 12,
  right: 16,
  bottom: 20,
  left: 16,
} as const;

export const COLLECTION_EXTREME_PROPORTIONS: CharacterProportions = {
  body: 0.92,
  head: 1.12,
  ears: 1.2,
  paws: 1.08,
};

export const COLLECTION_POSE_EXPRESSION_FIXTURES: readonly {
  readonly pose: CharacterPose;
  readonly expression: CharacterExpression;
  readonly semantic: CharacterSemanticState;
}[] = [
  { pose: 'sitting', expression: 'neutral', semantic: 'calm' },
  { pose: 'sitting', expression: 'happy', semantic: 'greeting' },
  { pose: 'sitting', expression: 'curious', semantic: 'listening' },
  { pose: 'standing', expression: 'curious', semantic: 'curiosity' },
  { pose: 'standing', expression: 'curious', semantic: 'pointContent' },
  { pose: 'sleeping', expression: 'sleepy', semantic: 'rest' },
  { pose: 'sitting', expression: 'happy', semantic: 'gentleJoy' },
  { pose: 'sitting', expression: 'neutral', semantic: 'static' },
];
