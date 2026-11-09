import type { StudioActionId } from '../characters/studioCollection';
import { STUDIO_ACTIONS } from '../characters/studioCollection';
import type { CharacterMotion } from './types';
import { LUMI_MOTION_PROFILE } from './presets';

/**
 * One decorative studio gesture vocabulary entry. Loops stay on idle/sleeping;
 * studio is always a bounded one-shot that settles to calm.
 */
export const STUDIO_MOTION = 'studio' as const satisfies CharacterMotion;

export type StudioMotionRecipe = {
  readonly actionId: StudioActionId;
  readonly motion: 'studio';
  readonly durationMs: number;
  readonly settlesToCalm: true;
  readonly loops: false;
};

/** Clamp authored duration into the shared 1.6–2.4 s workshop window. */
export function studioActionDurationMs(actionId: StudioActionId): number {
  const { min, max } = STUDIO_ACTIONS[actionId].durationMs;
  const preferred = Math.round((min + max) / 2);
  return Math.min(max, Math.max(min, preferred));
}

export function resolveStudioMotionRecipe(actionId: StudioActionId): StudioMotionRecipe {
  return {
    actionId,
    motion: STUDIO_MOTION,
    durationMs: studioActionDurationMs(actionId),
    settlesToCalm: true,
    loops: false,
  };
}

/**
 * Settle timer for product companions. Prefer the action recipe; fall back to
 * the shared recognition window when no studio action is active.
 */
export function studioSettleDelayMs(actionId: StudioActionId | null): number {
  if (actionId == null) return LUMI_MOTION_PROFILE.timing.recognitionMs + 80;
  return studioActionDurationMs(actionId) + 80;
}
