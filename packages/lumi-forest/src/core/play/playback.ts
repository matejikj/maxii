/** Automatic decoration follows motion preferences. An instructional clip can
 * run only after an explicit user request, even when decoration is disabled. */
export type PlayMotionIntent = 'automatic' | 'user';
export function canRunPlayScene(input: {
  intent: PlayMotionIntent; playing: boolean; foreground: boolean; canAnimate: boolean;
}): boolean {
  return input.playing && input.foreground && (input.intent === 'user' || input.canAnimate);
}
export function playStepAt(progress: number, stepCount: number): number {
  'worklet';
  const count = Number.isFinite(stepCount) ? Math.max(1, Math.min(8, Math.floor(stepCount))) : 3;
  const position = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  return Math.min(count - 1, Math.floor(position * count));
}
/** Resuming keeps the original speed and the exact current position. */
export function remainingPlayDuration(progress: number, stepCount: number, stepDurationMs: number): number {
  'worklet';
  const count = Number.isFinite(stepCount) ? Math.max(1, Math.min(8, Math.floor(stepCount))) : 3;
  const duration = Number.isFinite(stepDurationMs) ? Math.max(1000, Math.min(10000, stepDurationMs)) : 4200;
  const position = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  return Math.max(1, count * duration * (1 - position));
}
