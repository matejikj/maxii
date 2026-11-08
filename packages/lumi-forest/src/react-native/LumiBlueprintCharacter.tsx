import React, { useMemo } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import Svg from 'react-native-svg';
import type { CharacterBlueprintV2, CharacterCompileOptions } from '../core/characters/blueprint';
import { compileCharacter } from '../core/characters/compiler';
import { VectorNodeView } from './VectorNodeView';

export interface LumiBlueprintCharacterProps extends CharacterCompileOptions {
  readonly blueprint: CharacterBlueprintV2;
  readonly width?: number | `${number}%`;
  readonly height?: number | `${number}%`;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

/**
 * Renders any v2 blueprint through the public compiler. Used for art-direction
 * comparisons without changing the shipped species catalog entry.
 */
export const LumiBlueprintCharacter = React.memo(function LumiBlueprintCharacter({
  blueprint, pose = 'sitting', expression, accessories, proportions,
  width = 150, height = 162, style, testID,
}: LumiBlueprintCharacterProps) {
  const geometry = useMemo(() => compileCharacter(blueprint, {
    pose,
    ...(expression === undefined ? {} : { expression }),
    ...(accessories === undefined ? {} : { accessories }),
    ...(proportions === undefined ? {} : { proportions }),
  }), [blueprint, pose, expression, accessories, proportions]);
  const nodes = useMemo(() => [geometry], [geometry]);
  return (
    <Svg {...(Platform.OS === 'web' ? { 'aria-hidden': true, focusable: false } : { accessible: false })}
      pointerEvents="none" style={style}
      {...(testID === undefined ? {} : { testID })}
      width={width} height={height}
      viewBox="-176 -178 352 360" preserveAspectRatio="xMidYMid meet">
      <VectorNodeView nodes={nodes} />
    </Svg>
  );
});
