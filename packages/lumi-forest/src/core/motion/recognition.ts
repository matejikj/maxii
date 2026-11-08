import type { CharacterExpression, CharacterPose } from '../characters/blueprint';
import type { CharacterMotion } from './types';

/**
 * Two rabbit recognition cues for the pilot. Motion is optional; the static
 * props alone must read as a complete, calm companion when animation is off.
 */
export type RecognitionAction = 'earPerk' | 'headTilt';

export type RecognitionPresentation = {
  readonly action: RecognitionAction;
  readonly motion: CharacterMotion;
  readonly pose: CharacterPose;
  readonly expression: CharacterExpression;
  /** Static-only fallback used when Reduce Motion / preference disables loops. */
  readonly staticFallback: {
    readonly pose: CharacterPose;
    readonly expression: CharacterExpression;
  };
};

export const RECOGNITION_ACTIONS: readonly RecognitionAction[] = ['earPerk', 'headTilt'];

export function recognitionPresentation(action: RecognitionAction): RecognitionPresentation {
  if (action === 'earPerk') {
    return {
      action,
      motion: 'perk',
      pose: 'sitting',
      expression: 'curious',
      staticFallback: { pose: 'sitting', expression: 'curious' },
    };
  }
  return {
    action,
    motion: 'tilt',
    pose: 'sitting',
    expression: 'curious',
    staticFallback: { pose: 'standing', expression: 'curious' },
  };
}

/** Prefer animated props only when the host already decided motion is allowed. */
export function resolveRecognitionCompileOptions(
  action: RecognitionAction,
  animate: boolean,
): { pose: CharacterPose; expression: CharacterExpression; motion: CharacterMotion } {
  const presentation = recognitionPresentation(action);
  if (!animate) {
    return {
      pose: presentation.staticFallback.pose,
      expression: presentation.staticFallback.expression,
      motion: 'still',
    };
  }
  return {
    pose: presentation.pose,
    expression: presentation.expression,
    motion: presentation.motion,
  };
}
