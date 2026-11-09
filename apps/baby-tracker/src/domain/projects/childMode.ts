import { canActivateChildPrivateMode } from './privacy';

/**
 * Child-private workspace stays inactive until verified identity, recovery,
 * a dedicated device/account, and the legal/operational framework are ready.
 * Personal/family caregiver builds intentionally keep every gate closed.
 */
export const CHILD_PRIVATE_MODE_GATES = {
  verifiedChildIdentity: false,
  supportedRecovery: false,
  dedicatedDeviceOrAccount: false,
  legalOperationalFrameworkReady: false,
} as const;

export function isChildPrivateModeActive(): boolean {
  return canActivateChildPrivateMode(CHILD_PRIVATE_MODE_GATES).active;
}

export function childPrivateModeBlockers(): string[] {
  return canActivateChildPrivateMode(CHILD_PRIVATE_MODE_GATES).blockers;
}
