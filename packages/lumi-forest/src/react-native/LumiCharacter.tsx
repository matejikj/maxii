import React, { useMemo } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import Svg from 'react-native-svg';
import type { LumiAnimal } from '../core/types';
import { CHARACTER_BLUEPRINTS } from '../core/characters/blueprint';
import { compileCharacter } from '../core/characters/compiler';
import type { CharacterCompileOptions } from '../core/characters/blueprint';
import { VectorNodeView } from './VectorNodeView';

export interface LumiCharacterProps extends CharacterCompileOptions {
  readonly species: LumiAnimal;
  readonly width?: number | `${number}%`;
  readonly height?: number | `${number}%`;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * Standalone decorative SVG character. Unlike scene SVG, it has no background.
 * The character compiles only when semantic inputs change; no per-frame JS rig.
 * Keep options arrays and proportion objects referentially stable in clients.
 */
export const LumiCharacter = React.memo(function LumiCharacter({
  species, pose = 'sitting', expression, accessories, proportions, prop, props, appearanceStyle,
  width = 150, height = 162, style,
}: LumiCharacterProps) {
  const geometry = useMemo(() => compileCharacter(CHARACTER_BLUEPRINTS[species], {
    pose,
    ...(expression === undefined ? {} : { expression }),
    ...(accessories === undefined ? {} : { accessories }),
    ...(proportions === undefined ? {} : { proportions }),
    ...(prop == null ? {} : { prop }),
    ...(props == null ? {} : { props }),
    ...(appearanceStyle === undefined ? {} : { appearanceStyle }),
  }), [species, pose, expression, accessories, proportions, prop, props, appearanceStyle]);
  const nodes = useMemo(() => [geometry], [geometry]);
  // react-native-svg forwards native accessibility props to the DOM on web.
  return (
    <Svg {...(Platform.OS === 'web' ? { 'aria-hidden': true, focusable: false } : { accessible: false })}
      pointerEvents="none" style={style}
      width={width} height={height}
      viewBox="-176 -178 352 360" preserveAspectRatio="xMidYMid meet">
      <VectorNodeView nodes={nodes} />
    </Svg>
  );
});
