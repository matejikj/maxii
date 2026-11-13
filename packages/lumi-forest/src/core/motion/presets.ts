import type { CharacterMotion, MotionProfile, MotionState } from './types';

/** Versioned bounded parameters shared by UI and tests. Everything is declarative. */
export const LUMI_MOTION_PROFILE: MotionProfile = Object.freeze({
  timing: Object.freeze({
    blinkIntervalMs: 4700,
    blinkCloseMs: 95,
    blinkOpenMs: 135,
    breatheHalfCycleMs: 1900,
    earHalfCycleMs: 1450,
    floatHalfCycleMs: 2700,
    sceneTransitionMs: 360,
    celebrationMs: 680,
    recognitionMs: 920,
  }),
  amplitude: Object.freeze({
    breatheScale: 1.018,
    earDegrees: 3.2,
    perkEarDegrees: 8.5,
    tiltHeadDegrees: 6,
    floatPx: 2.2,
    celebrationLiftPx: 13,
  }),
});

/** Reduced-motion is always respected, including explicit enabled=true from the caller. */
export function shouldAnimate(state: MotionState): boolean {
  return state.enabled && !state.reducedMotion && state.foreground && state.visible;
}

export function shouldBlink(motion: CharacterMotion, expression: string, pose: string): boolean {
  return (
    (motion === 'idle' || motion === 'perk' || motion === 'studio') &&
    expression !== 'sleepy' &&
    pose !== 'sleeping'
  );
}

/** Avoid full-opacity loops, unbounded frequency or animated blur effects on mobile. */
export const LUMI_MOTION_BUDGETS = Object.freeze({
  maxAnimatedSvgGroupsPerCharacter: 6,
  maxSimultaneousAnimatedCharacters: 3,
  maxTransitionDocuments: 2,
  defaultTargetFps: 60,
  maxP95FrameMsAt60Hz: 16.67,
  maxDroppedFramePercent: 2,
  maxP95JankFrameMs: 32,
});

/** Pure validator for future remote authored motion profiles. */
export function validateMotionProfile(profile: MotionProfile): MotionProfile {
  const { timing: t, amplitude: a } = profile;
  for (const [name, value] of Object.entries(t)) {
    if (!Number.isFinite(value) || value < 1 || value > 15_000)
      throw new RangeError(`Invalid motion timing: ${name}`);
  }
  if (t.blinkCloseMs + t.blinkOpenMs >= t.blinkIntervalMs)
    throw new RangeError('Blink cycle must contain an idle gap');
  if (a.breatheScale < 1 || a.breatheScale > 1.08 || !Number.isFinite(a.breatheScale))
    throw new RangeError('Invalid breathing scale');
  if (!Number.isFinite(a.earDegrees) || Math.abs(a.earDegrees) > 12)
    throw new RangeError('Invalid ear amplitude');
  if (!Number.isFinite(a.perkEarDegrees) || Math.abs(a.perkEarDegrees) > 14)
    throw new RangeError('Invalid perk ear amplitude');
  if (!Number.isFinite(a.tiltHeadDegrees) || Math.abs(a.tiltHeadDegrees) > 12)
    throw new RangeError('Invalid head tilt amplitude');
  if (!Number.isFinite(a.floatPx) || Math.abs(a.floatPx) > 10)
    throw new RangeError('Invalid float amplitude');
  if (!Number.isFinite(a.celebrationLiftPx) || a.celebrationLiftPx < 0 || a.celebrationLiftPx > 30)
    throw new RangeError('Invalid celebration amplitude');
  return profile;
}
