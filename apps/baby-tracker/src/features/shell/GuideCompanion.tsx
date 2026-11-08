import React, { useMemo } from 'react';
import {
  LumiAnimatedCharacter,
  LumiCharacter,
  useLumiMotion,
} from '@lumi/forest-design/native';
import {
  resolveRecognitionCompileOptions,
  type CharacterExpression,
  type CharacterMotion,
  type LumiAnimal,
  type RecognitionAction,
} from '@lumi/forest-design';

type GuideCompanionProps = {
  species: LumiAnimal;
  /** Default calm presence. Recognition cues are short and optional. */
  recognition?: RecognitionAction | null;
  expression?: CharacterExpression;
  motion?: CharacterMotion;
  width?: number;
  height?: number;
  testID?: string;
};

/**
 * Product companion that prefers a calm static drawing. When character motion is
 * allowed, recognition cues use the animated path; otherwise the static fallback
 * expression/pose still communicates the same idea without movement.
 */
export function GuideCompanion({
  species,
  recognition = null,
  expression = 'happy',
  motion = 'idle',
  width = 120,
  height = 130,
  testID,
}: GuideCompanionProps) {
  const { canAnimate } = useLumiMotion();
  const resolved = useMemo(() => {
    if (recognition == null) {
      return {
        pose: 'sitting' as const,
        expression,
        motion: canAnimate ? motion : ('still' as const),
        animate: canAnimate,
      };
    }
    const next = resolveRecognitionCompileOptions(recognition, canAnimate);
    return { ...next, animate: canAnimate && next.motion !== 'still' };
  }, [recognition, expression, motion, canAnimate]);

  if (!resolved.animate) {
    return (
      <LumiCharacter
        species={species}
        pose={resolved.pose}
        expression={resolved.expression}
        width={width}
        height={height}
      />
    );
  }

  return (
    <LumiAnimatedCharacter
      species={species}
      pose={resolved.pose}
      expression={resolved.expression}
      motion={resolved.motion}
      width={width}
      height={height}
      {...(testID ? { testID } : {})}
    />
  );
}
