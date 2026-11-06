import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import type { LumiAnimal, LumiDensity, LumiScene } from '../../core/types';
import type { SafeZone, ScenePlan } from '../../core/procedural/types';
import type { CharacterAccessory, CharacterExpression, CharacterPose, CharacterProportions } from '../../core/characters/blueprint';
import type { ViewportSize } from '../../core/layout/viewport';
import { planProceduralScene } from '../../core/procedural/compiler';
import { SCENE_CATALOG } from '../../core/scenes/catalog';
import type { SceneDocument } from '../../core/vector/types';
import type { CharacterMotion } from '../../core/motion';
import { LumiVectorDocument } from '../LumiVectorDocument';
import { LumiAnimatedCharacter } from './LumiAnimatedCharacter';

export interface LumiAnimatedProceduralBackgroundProps {
  readonly scene: LumiScene;
  readonly seed?: string;
  readonly density?: LumiDensity;
  readonly safeZones?: readonly SafeZone[];
  readonly animal?: LumiAnimal;
  readonly pose?: CharacterPose;
  readonly expression?: CharacterExpression;
  readonly accessories?: readonly CharacterAccessory[];
  readonly proportions?: CharacterProportions;
  readonly motion?: CharacterMotion;
  readonly playing?: boolean;
  readonly celebrationKey?: string | number;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

const EXTRA_CHARACTER_CLEARANCE = 18;
const withoutCharacter = (plan: ScenePlan): SceneDocument => ({
  ...plan.document,
  layers: plan.document.layers.map(layer => layer.id === 'character' ? { ...layer, nodes: [] } : layer),
});

/**
 * Animated scene integration. The planner reserves an extra 18dp envelope around the
 * character, so its breathing, floating and small celebration cannot overlap UI zones.
 * The scene stays a STATIC Svg document; only the local character overlay moves.
 */
export const LumiAnimatedProceduralBackground = React.memo(function LumiAnimatedProceduralBackground({
  scene, seed = 'lumi-default', density = 'regular', safeZones, animal,
  pose = 'sitting', expression, accessories, proportions, motion = 'idle', playing = true,
  celebrationKey, style, testID,
}: LumiAnimatedProceduralBackgroundProps) {
  const [viewport, setViewport] = useState<ViewportSize | null>(null);
  const onLayout = useCallback(({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    if (layout.width < 240 || layout.height < 240) return;
    const width = Math.round(layout.width * 100) / 100;
    const height = Math.round(layout.height * 100) / 100;
    setViewport(previous => previous?.width === width && previous.height === height ? previous : { width, height });
  }, []);
  const plan = useMemo(() => viewport ? planProceduralScene({
    scene, viewport, seed, density, characterMotionPadding: EXTRA_CHARACTER_CLEARANCE,
    ...(safeZones === undefined ? {} : { safeZones }),
    ...(animal === undefined ? {} : { animal }),
    pose,
    ...(expression === undefined ? {} : { expression }),
    ...(accessories === undefined ? {} : { accessories }),
    ...(proportions === undefined ? {} : { proportions }),
  }) : null, [viewport, scene, seed, density, safeZones, animal, pose, expression, accessories, proportions]);
  const base = useMemo(() => plan && withoutCharacter(plan), [plan]);
  const placement = plan?.items.find(item => item.kind === 'character');
  return (
    <View testID={testID} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
      onLayout={onLayout}
      style={[StyleSheet.absoluteFill, styles.clip, { backgroundColor: SCENE_CATALOG[scene].palette.bg }, style]}>
      {base && <LumiVectorDocument document={base} mode="contain"/>}
      {placement && (
        <LumiAnimatedCharacter species={animal ?? SCENE_CATALOG[scene].defaultAnimal}
          pose={pose}
          {...(expression === undefined ? {} : { expression })}
          {...(accessories === undefined ? {} : { accessories })}
          {...(proportions === undefined ? {} : { proportions })}
          motion={motion} playing={playing}
          {...(celebrationKey === undefined ? {} : { celebrationKey })} frame="procedural"
          width={placement.bounds.width} height={placement.bounds.height}
          style={{ position: 'absolute', left: placement.bounds.x, top: placement.bounds.y }}/>
      )}
    </View>
  );
});
const styles = StyleSheet.create({ clip: { overflow: 'hidden' } });
