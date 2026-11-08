import React, { Component, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from 'react';
import {
  LumiAnimatedCharacter,
  LumiCharacter,
  useCompanionPlaying,
  useLumiMotion,
} from '@lumi/forest-design/native';
import {
  LUMI_MOTION_PROFILE,
  resolveCompanionPresentation,
  resolveCollectionSpecies,
  type CharacterExpression,
  type CharacterMotion,
  type CharacterSemanticState,
  type LumiAnimal,
  type RecognitionAction,
} from '@lumi/forest-design';

type GuideCompanionProps = {
  species: LumiAnimal | string;
  /** Shared semantic presentation — preferred over raw pose/expression. */
  semantic?: CharacterSemanticState | null;
  /** Species-specific catalog action id (or legacy rabbit recognition). */
  signatureAction?: string | null;
  /** @deprecated Prefer signatureAction; kept for rabbit pilot call sites. */
  recognition?: RecognitionAction | null;
  expression?: CharacterExpression;
  motion?: CharacterMotion;
  /** Confirmed local save may bump this for a brief non-blocking celebration. */
  celebrationKey?: string | number;
  /** Screen focus / offscreen: false stops decorative loops immediately. */
  visible?: boolean;
  width?: number;
  height?: number;
  testID?: string;
};

type BoundaryProps = {
  species: LumiAnimal;
  width: number;
  height: number;
  children: ReactNode;
};

type BoundaryState = { failed: boolean };

/**
 * Graphics faults must never block care write, focus, or timers — fall back to
 * a calm static drawing of the same species.
 */
class GuideMotionBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Intentionally quiet: decorative failure must not enter product logs with PII.
  }

  render() {
    if (this.state.failed) {
      return (
        <LumiCharacter
          species={this.props.species}
          pose="sitting"
          expression="neutral"
          width={this.props.width}
          height={this.props.height}
        />
      );
    }
    return this.props.children;
  }
}

/**
 * Product companion driven by semantic presentation. Motion is optional; static
 * fallbacks keep meaning when Reduce Motion or the user switch disables loops.
 * At most one short gesture plays, then the drawing settles to calm.
 */
export function GuideCompanion({
  species: speciesInput,
  semantic = null,
  signatureAction = null,
  recognition = null,
  expression = 'happy',
  motion = 'idle',
  celebrationKey,
  visible = true,
  width = 120,
  height = 130,
  testID,
}: GuideCompanionProps) {
  const { canAnimate } = useLumiMotion();
  const playing = useCompanionPlaying(visible);
  const species = resolveCollectionSpecies(speciesInput);

  const base = useMemo(
    () =>
      resolveCompanionPresentation({
        species,
        semantic,
        signatureAction,
        recognition,
        expression,
        motion,
        animate: canAnimate && playing,
      }),
    [species, semantic, signatureAction, recognition, expression, motion, canAnimate, playing],
  );

  const presentationKey = `${species}:${base.signatureActionId ?? ''}:${base.semantic ?? ''}:${base.settlesToCalm}:${base.animate}`;
  const [activeKey, setActiveKey] = useState(presentationKey);
  const [settled, setSettled] = useState(false);

  // Reset settle tracking when the authored gesture changes (render-time adjust).
  if (presentationKey !== activeKey) {
    setActiveKey(presentationKey);
    setSettled(false);
  }

  useEffect(() => {
    if (!base.settlesToCalm || !base.animate) return;
    const handle = setTimeout(() => {
      setSettled(true);
    }, LUMI_MOTION_PROFILE.timing.recognitionMs + 80);
    return () => clearTimeout(handle);
  }, [presentationKey, base.settlesToCalm, base.animate]);

  const resolved = settled
    ? resolveCompanionPresentation({
        species,
        semantic: 'calm',
        animate: canAnimate && playing,
      })
    : base;

  const character = !resolved.animate ? (
    <LumiCharacter
      species={resolved.species}
      pose={resolved.pose}
      expression={resolved.expression}
      {...(resolved.prop ? { prop: resolved.prop } : {})}
      width={width}
      height={height}
    />
  ) : (
    <LumiAnimatedCharacter
      species={resolved.species}
      pose={resolved.pose}
      expression={resolved.expression}
      motion={resolved.motion}
      playing={playing}
      {...(resolved.prop ? { prop: resolved.prop } : {})}
      {...(celebrationKey === undefined ? {} : { celebrationKey })}
      width={width}
      height={height}
      {...(testID ? { testID } : {})}
    />
  );

  return (
    <GuideMotionBoundary species={species} width={width} height={height}>
      {character}
    </GuideMotionBoundary>
  );
}
