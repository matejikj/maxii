import React, { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { LumiScene, LumiDensity, LumiAnimal } from '../core/types';
import type { SafeZone } from '../core/procedural/types';
import type {
  CharacterPose,
  CharacterExpression,
  CharacterAccessory,
  CharacterProportions,
} from '../core/characters/blueprint';
import type { ViewportSize } from '../core/layout/viewport';
import { composeProceduralScene } from '../core/procedural/compiler';
import { SCENE_CATALOG } from '../core/scenes/catalog';
import { LumiVectorDocument } from './LumiVectorDocument';

/** Measured viewport-based composition: zones MUST be relative to this View in dp. */
export interface LumiProceduralBackgroundProps {
  readonly scene: LumiScene;
  readonly seed?: string;
  readonly density?: LumiDensity;
  readonly safeZones?: readonly SafeZone[];
  readonly characterVisibility?: 'auto' | 'none';
  readonly animal?: LumiAnimal;
  readonly pose?: CharacterPose;
  readonly expression?: CharacterExpression;
  readonly accessories?: readonly CharacterAccessory[];
  readonly proportions?: CharacterProportions;
  readonly style?: StyleProp<ViewStyle>;
}

export const LumiProceduralBackground = React.memo(function LumiProceduralBackground({
  scene,
  seed = 'lumi-default',
  density = 'regular',
  safeZones,
  characterVisibility,
  animal,
  pose,
  expression,
  accessories,
  proportions,
  style,
}: LumiProceduralBackgroundProps) {
  const [viewport, setViewport] = useState<ViewportSize | null>(null);
  const onLayout = useCallback(
    ({
      nativeEvent: {
        layout: { width, height },
      },
    }: LayoutChangeEvent) => {
      // Ignore transient zero dimensions (initial layout or inactive screens).
      if (width < 240 || height < 240) return;
      const nextWidth = Math.round(width * 100) / 100;
      const nextHeight = Math.round(height * 100) / 100;
      setViewport((prev) =>
        prev?.width === nextWidth && prev.height === nextHeight
          ? prev
          : { width: nextWidth, height: nextHeight },
      );
    },
    [],
  );

  const document = useMemo(
    () =>
      viewport
        ? composeProceduralScene({
            scene,
            viewport,
            seed,
            density,
            ...(safeZones === undefined ? {} : { safeZones }),
            ...(characterVisibility === undefined ? {} : { characterVisibility }),
            ...(animal === undefined ? {} : { animal }),
            ...(pose === undefined ? {} : { pose }),
            ...(expression === undefined ? {} : { expression }),
            ...(accessories === undefined ? {} : { accessories }),
            ...(proportions === undefined ? {} : { proportions }),
          })
        : null,
    [
      viewport,
      scene,
      seed,
      density,
      safeZones,
      characterVisibility,
      animal,
      pose,
      expression,
      accessories,
      proportions,
    ],
  );

  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      onLayout={onLayout}
      style={[StyleSheet.absoluteFill, { backgroundColor: SCENE_CATALOG[scene].palette.bg }, style]}
    >
      {document && <LumiVectorDocument document={document} mode="contain" />}
    </View>
  );
});
