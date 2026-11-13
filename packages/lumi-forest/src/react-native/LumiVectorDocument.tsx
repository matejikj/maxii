import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg from 'react-native-svg';
import type { SceneDocument } from '../core/vector/types';
import { resolveAspectMode } from '../core/layout/viewport';
import { SCENE_CATALOG } from '../core/scenes/catalog';
import type { LumiScene } from '../core/types';
import type { AspectMode } from '../core/layout/viewport';
import { VectorNodeView } from './VectorNodeView';

export type LumiAspectMode = AspectMode;
export interface LumiVectorDocumentProps {
  readonly document: SceneDocument;
  readonly mode?: LumiAspectMode;
  readonly style?: StyleProp<ViewStyle>;
}

/** All geometry stays in one SVG surface. Background ignores touch and screen reader focus. */
export const LumiVectorDocument = React.memo(function LumiVectorDocument({
  document,
  mode = 'cover',
  style,
}: LumiVectorDocumentProps) {
  const screen = useWindowDimensions();
  const [measuredMode, setMeasuredMode] = useState<'cover' | 'contain' | null>(null);
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (mode !== 'auto') return;
      const { width, height } = event.nativeEvent.layout;
      if (width > 0 && height > 0) {
        const next = resolveAspectMode({ width, height });
        setMeasuredMode((previous: 'cover' | 'contain' | null) =>
          previous === next ? previous : next,
        );
      }
    },
    [mode],
  );
  const effective = mode === 'auto' ? (measuredMode ?? resolveAspectMode(screen)) : mode;
  const aspect = effective === 'contain' ? 'xMidYMax meet' : 'xMidYMax slice';
  const backgroundColor = SCENE_CATALOG[document.scene as LumiScene]?.palette.bg ?? 'transparent';
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      {...(mode === 'auto' ? { onLayout: handleLayout } : {})}
      style={[StyleSheet.absoluteFill, styles.clip, { backgroundColor }, style]}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${document.width} ${document.height}`}
        preserveAspectRatio={aspect}
      >
        {document.layers.map((layer) => (
          <VectorNodeView key={layer.id} nodes={layer.nodes} />
        ))}
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({ clip: { overflow: 'hidden' } });
