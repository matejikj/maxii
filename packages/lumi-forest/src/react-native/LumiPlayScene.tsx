import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import Svg, { G, Line, type GProps } from 'react-native-svg';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedProps, useAnimatedReaction, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { canRunPlayScene, playStepAt, remainingPlayDuration, type PlayMotionIntent } from '../core/play/playback';
import type { CharacterPart } from '../core/characters/blueprint';
import { playLayerProps, playPartMotion, playPartTransform, preparePlayScene, type PlayLayerChannel } from '../core/play/scene';
import { samplePlayMotion } from '../core/play/motion';
import type { LumiPlayAction, PlayMotionFrame, PlaySceneOptions } from '../core/play/types';
import type { VectorNode } from '../core/vector/types';
import { VectorNodeView } from './VectorNodeView';
import { useLumiMotion } from './motion/LumiMotionProvider';

type MotionProps = GProps & { matrix?: number[] };
const AnimatedG = Animated.createAnimatedComponent(G as React.ComponentClass<MotionProps>);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const WEB = Platform.OS === 'web';
export interface LumiPlaySceneProps extends PlaySceneOptions {
  readonly step?: number;
  readonly stepCount?: number;
  readonly playing?: boolean;
  /** 'user' is reserved for deliberately started instructional playback. */
  readonly motionIntent?: PlayMotionIntent;
  readonly onStepChange?: (step: number) => void;
  readonly onComplete?: () => void;
  readonly stepDurationMs?: number;
  readonly cycle?: number;
  readonly width?: number | `${number}%`;
  readonly height?: number;
  readonly testID?: string;
}
const MovingPart = React.memo(function MovingPart({ actor, part, action, progress, initial }: {
  actor: 'baby' | 'guide'; part: CharacterPart; action: LumiPlayAction; progress: SharedValue<number>; initial: PlayMotionFrame;
}) {
  const animatedProps = useAnimatedProps<MotionProps>(() => {
    const frame = samplePlayMotion(action, progress.value);
    const { degrees, x, y } = playPartMotion(actor, part, frame);
    if (WEB) return { transform: `rotate(${degrees} ${x} ${y})` };
    const rad = degrees * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
    return { matrix: [c, s, -s, c, x - c*x + s*y, y - s*x - c*y] };
  }, [action, actor, part]);
  const nodes = useMemo(() => [part.geometry], [part.geometry]);
  return <G {...(part.transform ? { transform: part.transform } : {})}>
    <AnimatedG transform={playPartTransform(actor, part, initial)} animatedProps={animatedProps}><VectorNodeView nodes={nodes} /></AnimatedG>
  </G>;
});
function Layer({ channel, action, progress, initial, children }: {
  channel: PlayLayerChannel; action: LumiPlayAction; progress: SharedValue<number>; initial: PlayMotionFrame; children: React.ReactNode;
}) {
  const animatedProps = useAnimatedProps<MotionProps>(() => {
    const frame = samplePlayMotion(action, progress.value), props = playLayerProps(channel, frame);
    if (WEB) return props;
    if (channel === 'baby') return { matrix: [.52, 0, 0, .52, 270 + frame.babyX, 141 + frame.babyY], opacity: 1 };
    if (channel === 'guide') return { matrix: [.48, 0, 0, .48, 92, 126], opacity: 1 };
    if (channel === 'object') {
      const rad = frame.objectRotation * Math.PI / 180, c = Math.cos(rad) * frame.objectScale, s = Math.sin(rad) * frame.objectScale;
      return { matrix: [c * frame.objectScaleX, s * frame.objectScaleX, -s, c, frame.objectX, frame.objectY], opacity: 1 };
    }
    return { opacity: props.opacity };
  }, [action, channel]);
  const staticProps = playLayerProps(channel, initial);
  return <AnimatedG {...staticProps} animatedProps={animatedProps}>{children}</AnimatedG>;
}
/** One continuous UI-thread clock owns the entire demonstration. React only
 * receives step boundaries; pausing/focus changes never reset the timeline. */
export const LumiPlayScene = React.memo(function LumiPlayScene({ action, babyVariant = 'neutral', babyPose = 'reclined',
  guideSpecies = 'rabbit', appearanceStyle = 'forest', colorMode = 'light', object,
  step = 0, stepCount = 3, playing = true, motionIntent = 'automatic', onStepChange, onComplete,
  stepDurationMs = 4200, cycle = 0, width = '100%', height = 230, testID,
}: LumiPlaySceneProps) {
  const { canAnimate, foreground } = useLumiMotion();
  const count = Number.isFinite(stepCount) ? Math.max(1, Math.min(8, Math.floor(stepCount))) : 3;
  const index = Number.isFinite(step) ? Math.max(0, Math.min(count - 1, Math.floor(step))) : 0;
  const active = canRunPlayScene({ intent: motionIntent, playing, foreground, canAnimate });
  const progress = useSharedValue(index / count);
  const initial = useMemo(() => samplePlayMotion(action, index / count), [action, index, count]);
  // Selection changes are commands. Step callbacks must not feed back as seeks.
  const selection = `${action}/${index}/${count}/${cycle}`;
  const previousSelection = useRef<string | null>(null);
  const run = useRef(0);
  const callbacks = useRef({ onStepChange, onComplete });
  useEffect(() => { callbacks.current = { onStepChange, onComplete }; }, [onStepChange, onComplete]);
  const notifyStep = useCallback((next: number) => { callbacks.current.onStepChange?.(next); }, []);
  const notifyComplete = useCallback((id: number) => {
    if (run.current === id) callbacks.current.onComplete?.();
  }, []);
  useAnimatedReaction(() => playStepAt(progress.value, count), (next, previous) => {
    if (next !== previous) scheduleOnRN(notifyStep, next);
  }, [count, notifyStep]);
  const progressProps = useAnimatedProps(() => ({ x2: 32 + 336 * progress.value }));
  const prepared = useMemo(() => preparePlayScene({ action, babyVariant, babyPose, guideSpecies, appearanceStyle, colorMode,
    ...(object === undefined ? {} : { object }) }), [action, babyVariant, babyPose, guideSpecies, appearanceStyle, colorMode, object]);
  useEffect(() => {
    const id = ++run.current;
    const seek = previousSelection.current !== selection;
    previousSelection.current = selection;
    // Seeking and reading the resulting position must happen on the same thread.
    // RN-side shared-value writes are queued; reading immediately after a seek
    // could otherwise use the old final position and finish a replay instantly.
    scheduleOnUI(() => {
      'worklet';
      cancelAnimation(progress);
      if (seek) progress.value = index / count;
      if (active) {
        if (progress.value >= 1) progress.value = 0;
        progress.value = withTiming(1, {
          duration: remainingPlayDuration(progress.value, count, stepDurationMs), easing: Easing.linear,
          // Automatic motion is vetoed above by the live Lumi policy. User motion
          // runs only after a deliberate Play action, without changing OS settings.
          reduceMotion: ReduceMotion.Never,
        }, (finished) => { if (finished) scheduleOnRN(notifyComplete, id); });
      }
    });
    return () => {
      ++run.current;
      scheduleOnUI(() => { 'worklet'; cancelAnimation(progress); });
    };
  }, [active, index, count, stepDurationMs, selection, progress, notifyComplete]);
  const actor = (name: 'baby' | 'guide', parts: readonly CharacterPart[]) => <Layer channel={name} action={action} progress={progress} initial={initial}>
    {parts.map((part) => <MovingPart key={part.id} actor={name} part={part} action={action} progress={progress} initial={initial} />)}
  </Layer>;
  return <Svg {...(testID ? { testID } : {})} width={width} height={height} viewBox="0 48 400 194" preserveAspectRatio="xMidYMid meet" pointerEvents="none"
    {...(WEB ? { 'aria-hidden': true, focusable: false } : { accessible: false })}>
    <VectorNodeView nodes={prepared.background} />
    <VectorNodeView nodes={prepared.fixedObjects} />
    {actor('guide', prepared.guideParts)}{actor('baby', prepared.babyParts)}
    {(['object', 'reveal', 'signal', 'guideVoice', 'babyVoice', 'cover'] as const).map((channel) =>
      <Layer key={channel} channel={channel} action={action} progress={progress} initial={initial}><VectorNodeView nodes={prepared[channel]} /></Layer>)}
    <Line x1={32} x2={368} y1={238} y2={238} stroke={colorMode === 'dark' ? '#71887E' : '#CCD7C7'} strokeWidth={2} strokeLinecap="round" />
    <AnimatedLine x1={32} x2={32} y1={238} y2={238} animatedProps={progressProps}
      stroke={colorMode === 'dark' ? '#B4D2BE' : '#658A76'} strokeWidth={2.5} strokeLinecap="round" />
  </Svg>;
});
