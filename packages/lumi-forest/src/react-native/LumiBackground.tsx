import React, { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { composeScene } from '../core/scenes/compose';
import type { SceneOptions } from '../core/types';
import { LumiVectorDocument, type LumiAspectMode } from './LumiVectorDocument';

export interface LumiBackgroundProps extends SceneOptions {
  readonly mode?: LumiAspectMode;
  readonly style?: StyleProp<ViewStyle>;
}

/** Screen composition is calculated only when semantic scene inputs change. */
export const LumiBackground = React.memo(function LumiBackground({
  scene, seed = 'lumi-default', density = 'regular', animal, pose, expression, accessories, proportions, mode = 'cover', style,
}: LumiBackgroundProps) {
  const document = useMemo(() => composeScene({ scene, seed, density,
    ...(animal === undefined ? {} : { animal }),
    ...(pose === undefined ? {} : { pose }),
    ...(expression === undefined ? {} : { expression }),
    ...(accessories === undefined ? {} : { accessories }),
    ...(proportions === undefined ? {} : { proportions }),
  }), [scene, seed, density, animal, pose, expression, accessories, proportions]);
  return <LumiVectorDocument document={document} mode={mode} style={style} />;
});
