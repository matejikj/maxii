import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { SceneDocument } from '../../core/vector/types';
import { LUMI_MOTION_PROFILE } from '../../core/motion';
import { LumiVectorDocument, type LumiAspectMode } from '../LumiVectorDocument';
import { useLumiMotion } from './LumiMotionProvider';

export interface LumiSceneTransitionProps {
  readonly document: SceneDocument;
  readonly mode?: LumiAspectMode;
  readonly playing?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

/**
 * Crossfade for decorative SCENE updates only (not a replacement for native navigation).
 * At most two immutable documents mounted; animation changes opacity on UI thread.
 * No new terrain/character geometry is compiled by an animation tick.
 */
export const LumiSceneTransition = React.memo(function LumiSceneTransition({
  document, mode = 'cover', playing = true, style, testID,
}: LumiSceneTransitionProps) {
  const { canAnimate } = useLumiMotion();
  const allowed = canAnimate && playing;
  const previous = useRef(document);
  const [outgoing, setOutgoing] = useState<SceneDocument | null>(null);
  const progress = useSharedValue(1);
  useEffect(() => {
    const old = previous.current;
    if (old === document) return;
    previous.current = document;
    if (!allowed) { setOutgoing(null); progress.value = 1; return; }
    cancelAnimation(progress);
    setOutgoing(old);
    progress.value = 0;
    progress.value = withTiming(1, { duration: LUMI_MOTION_PROFILE.timing.sceneTransitionMs, easing: Easing.inOut(Easing.quad) });
    const cleanup = setTimeout(() => setOutgoing(null), LUMI_MOTION_PROFILE.timing.sceneTransitionMs + 60);
    return () => { clearTimeout(cleanup); cancelAnimation(progress); };
  }, [document, allowed, progress]);
  useEffect(() => {
    if (!allowed) { cancelAnimation(progress); progress.value = 1; setOutgoing(null); }
  }, [allowed, progress]);
  const incomingStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const outgoingStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  return (
    <View testID={testID} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.clip, style]}>
      {outgoing && allowed && (
        <Animated.View style={[StyleSheet.absoluteFill, outgoingStyle]}>
          <LumiVectorDocument document={outgoing} mode={mode}/>
        </Animated.View>
      )}
      <Animated.View style={[StyleSheet.absoluteFill, outgoing && allowed ? incomingStyle : undefined]}>
        <LumiVectorDocument document={document} mode={mode}/>
      </Animated.View>
    </View>
  );
});
const styles = StyleSheet.create({ clip: { overflow: 'hidden' } });
