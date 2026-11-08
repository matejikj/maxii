/** Animation vocabulary. No React Native, worklets or clock access in core. */
export type CharacterMotion = 'idle' | 'sleeping' | 'still' | 'perk' | 'tilt';
export type AnimationChannel = 'blink' | 'breathe' | 'leftEar' | 'rightEar' | 'float' | 'celebrate';
export type MotionState = Readonly<{
  enabled: boolean;
  reducedMotion: boolean;
  foreground: boolean;
  visible: boolean;
}>;
export interface MotionTiming {
  readonly blinkIntervalMs: number;
  readonly blinkCloseMs: number;
  readonly blinkOpenMs: number;
  readonly breatheHalfCycleMs: number;
  readonly earHalfCycleMs: number;
  readonly floatHalfCycleMs: number;
  readonly sceneTransitionMs: number;
  readonly celebrationMs: number;
  readonly recognitionMs: number;
}
export interface MotionAmplitude {
  readonly breatheScale: number;
  readonly earDegrees: number;
  readonly perkEarDegrees: number;
  readonly tiltHeadDegrees: number;
  readonly floatPx: number;
  readonly celebrationLiftPx: number;
}
export interface MotionProfile {
  readonly timing: MotionTiming;
  readonly amplitude: MotionAmplitude;
}
