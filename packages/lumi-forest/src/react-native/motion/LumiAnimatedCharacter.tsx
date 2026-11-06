import React, { useEffect, useMemo, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import Animated, {
  type SharedValue,
  cancelAnimation, Easing, ReduceMotion, useAnimatedProps, useAnimatedStyle,
  useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { CHARACTER_BLUEPRINTS } from '../../core/characters/blueprint';
import type { CharacterCompileOptions } from '../../core/characters/blueprint';
import type { LumiAnimal } from '../../core/types';
import { LUMI_MOTION_PROFILE, prepareCharacterMotion, shouldBlink } from '../../core/motion';
import type { CharacterMotion, MotionPart, PreparedMotionCharacter } from '../../core/motion';
import { VectorNodeView } from '../VectorNodeView';
import { useLumiMotion } from './LumiMotionProvider';

const AnimatedG = Animated.createAnimatedComponent(G);
const { timing, amplitude } = LUMI_MOTION_PROFILE;
const smooth = Easing.inOut(Easing.sin);
const out = Easing.out(Easing.cubic);

export interface LumiAnimatedCharacterProps extends CharacterCompileOptions {
  readonly species: LumiAnimal;
  readonly motion?: CharacterMotion;
  readonly playing?: boolean;
  readonly celebrationKey?: string | number;
  readonly width?: number | `${number}%`;
  readonly height?: number | `${number}%`;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
  /** Uses the same local viewport as v0.4 character collision bounds. */
  readonly frame?: 'standalone' | 'procedural';
}

interface AnimatedPartProps {
  readonly part: MotionPart;
  readonly blink: SharedValue<number>;
  readonly ear: SharedValue<number>;
  readonly active: boolean;
}

/** Only transform props of a handful of SVG groups update per frame, on the UI runtime. */
const AnimatedPart = React.memo(function AnimatedPart({ part, blink, ear, active }: AnimatedPartProps) {
  const x = part.pivot?.x ?? 0;
  const y = part.pivot?.y ?? 0;
  const channel = part.channel;
  const animatedProps = useAnimatedProps(() => {
    if (channel === 'leftEye' || channel === 'rightEye') {
      return { scaleY: blink.value };
    }
    const direction = channel === 'rightEar' ? -1 : 1;
    return { rotation: ear.value * direction };
  }, [channel]);
  const node = useMemo(() => [part.node], [part.node]);
  if (!active || channel === 'static') return <VectorNodeView nodes={node}/>;
  return <AnimatedG originX={x} originY={y} animatedProps={animatedProps}><VectorNodeView nodes={node}/></AnimatedG>;
});

interface CharacterArtProps {
  readonly prepared: PreparedMotionCharacter;
  readonly blink: SharedValue<number>;
  readonly ear: SharedValue<number>;
  readonly active: boolean;
}
const CharacterArt = React.memo(function CharacterArt({ prepared, blink, ear, active }: CharacterArtProps) {
  const inner = prepared.parts.map(part => (
    <AnimatedPart key={part.id} part={part} blink={blink} ear={ear} active={active}/>
  ));
  const drawing = <G {...prepared.innerProps}>{inner}</G>;
  return prepared.outerProps ? <G {...prepared.outerProps}>{drawing}</G> : drawing;
});

/** One small SVG burst; uses the same SVG surface and no per-frame React state. */
function CelebrationStars({ progress, active }: { progress: SharedValue<number>; active: boolean }) {
  const animatedProps = useAnimatedProps(() => ({
    opacity: Math.max(0, Math.min(1, Math.sin(progress.value * Math.PI) * 0.95)),
    y: -20 * progress.value,
    scale: 0.85 + 0.22 * progress.value,
  }));
  if (!active) return null;
  return (
    <AnimatedG animatedProps={animatedProps}>
      <Path d="M-115 -67 l6 15 15 6 -15 6 -6 15 -6 -15 -15 -6 15 -6Z" fill="#F4D28D"/>
      <Path d="M103 -94 l7 16 16 7 -16 7 -7 16 -7 -16 -16 -7 16 -7Z" fill="#E9B3AC"/>
      <Path d="M88 18 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4Z" fill="#C2C6E3"/>
    </AnimatedG>
  );
}

/**
 * Motion and geometry are completely decoupled. prepareCharacterMotion/compileCharacter
 * only execute when semantic props change; Reanimated worklets drive native transforms.
 * App / screen visibility or Reduce Motion cancel every infinite animation.
 */
export const LumiAnimatedCharacter = React.memo(function LumiAnimatedCharacter({
  species, pose = 'sitting', expression, accessories, proportions, motion = 'idle',
  playing = true, celebrationKey, width = 150, height = 162, style, testID, frame = 'standalone',
}: LumiAnimatedCharacterProps) {
  const blueprint = CHARACTER_BLUEPRINTS[species];
  const prepared = useMemo(() => prepareCharacterMotion(blueprint, {
    pose,
    ...(expression === undefined ? {} : { expression }),
    ...(accessories === undefined ? {} : { accessories }),
    ...(proportions === undefined ? {} : { proportions }),
  }), [blueprint, pose, expression, accessories, proportions]);
  const { canAnimate } = useLumiMotion();
  const active = canAnimate && playing && motion !== 'still';
  const blinkEnabled = active && shouldBlink(motion, expression ?? 'neutral', pose);
  const blink = useSharedValue(1);
  const breath = useSharedValue(1);
  const ears = useSharedValue(0);
  const float = useSharedValue(0);
  const lift = useSharedValue(0);
  const burst = useSharedValue(0);
  const previousCelebration = useRef(celebrationKey);

  useEffect(() => {
    cancelAnimation(blink); cancelAnimation(breath); cancelAnimation(ears); cancelAnimation(float);
    blink.value = 1; breath.value = 1; ears.value = 0; float.value = 0;
    if (!active) return;
    if (blinkEnabled) {
      blink.value = withRepeat(withSequence(
        withDelay(timing.blinkIntervalMs + species.length * 109,
          withTiming(0.06, { duration: timing.blinkCloseMs, easing: smooth, reduceMotion: ReduceMotion.System })),
        withTiming(1, { duration: timing.blinkOpenMs, easing: smooth, reduceMotion: ReduceMotion.System }),
      ), -1, false, undefined, ReduceMotion.System);
    }
    breath.value = withRepeat(withTiming(amplitude.breatheScale, {
      duration: timing.breatheHalfCycleMs * (motion === 'sleeping' ? 1.5 : 1), easing: smooth, reduceMotion: ReduceMotion.System,
    }), -1, true, undefined, ReduceMotion.System);
    if (motion === 'idle') {
      ears.value = withRepeat(withTiming(amplitude.earDegrees, {
        duration: timing.earHalfCycleMs, easing: smooth, reduceMotion: ReduceMotion.System,
      }), -1, true, undefined, ReduceMotion.System);
    }
    if (motion === 'sleeping') {
      float.value = withRepeat(withTiming(-amplitude.floatPx, {
        duration: timing.floatHalfCycleMs, easing: smooth, reduceMotion: ReduceMotion.System,
      }), -1, true, undefined, ReduceMotion.System);
    }
    return () => { cancelAnimation(blink); cancelAnimation(breath); cancelAnimation(ears); cancelAnimation(float); };
  }, [active, blinkEnabled, motion, species, blink, breath, ears, float]);

  useEffect(() => {
    if (previousCelebration.current === celebrationKey) return;
    previousCelebration.current = celebrationKey;
    cancelAnimation(lift); cancelAnimation(burst);
    lift.value = 0; burst.value = 0;
    if (!active || celebrationKey === undefined) return;
    lift.value = withSequence(
      withTiming(-amplitude.celebrationLiftPx, { duration: timing.celebrationMs * .34, easing: out }),
      withTiming(0, { duration: timing.celebrationMs * .66, easing: Easing.out(Easing.bounce) }),
    );
    burst.value = withTiming(1, { duration: timing.celebrationMs, easing: Easing.linear });
    return () => { cancelAnimation(lift); cancelAnimation(burst); };
  }, [celebrationKey, active, lift, burst]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value + lift.value }, { scale: breath.value }],
  }));
  return (
    <Animated.View testID={testID} accessible={false} pointerEvents="none"
      style={[{ width, height }, style, animatedStyle]}>
      <Svg width="100%" height="100%" viewBox={frame === 'procedural' ? '-155 -205 310 410' : '-176 -178 352 360'} preserveAspectRatio="xMidYMid meet">
        <CharacterArt prepared={prepared} blink={blink} ear={ears} active={active}/>
        <CelebrationStars progress={burst} active={active}/>
      </Svg>
    </Animated.View>
  );
});
