import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

export interface LumiMotionContextValue {
  /** Effective policy, never overrides OS Reduce Motion. */
  readonly canAnimate: boolean;
  readonly reduceMotion: boolean;
  readonly foreground: boolean;
  /** User preference for decorative character motion (single product switch). */
  readonly enabled: boolean;
}

// Fail-safe default: standalone components render their exact authored static pose.
const MotionContext = createContext<LumiMotionContextValue>({
  canAnimate: false,
  reduceMotion: true,
  foreground: true,
  enabled: false,
});

export interface LumiMotionProviderProps {
  readonly children: React.ReactNode;
  readonly enabled?: boolean;
  /** Additional app preference, e.g. "reduce animations". Cannot turn OS motion back on. */
  readonly preferReducedMotion?: boolean;
}

/** Exactly one OS listener / AppState listener for an app-wide character gallery. */
export function LumiMotionProvider({
  children,
  enabled = true,
  preferReducedMotion = false,
}: LumiMotionProviderProps) {
  const [systemReducedMotion, setSystemReducedMotion] = useState(true); // avoid a flash of motion before async OS query
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (mounted) setSystemReducedMotion(reduced);
      })
      .catch(() => {
        if (mounted) setSystemReducedMotion(true);
      });
    const motionSubscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setSystemReducedMotion,
    );
    const appSubscription = AppState.addEventListener('change', (status) =>
      setForeground(status === 'active'),
    );
    return () => {
      mounted = false;
      motionSubscription.remove();
      appSubscription.remove();
    };
  }, []);
  const reducedMotion = systemReducedMotion || preferReducedMotion;
  const value = useMemo<LumiMotionContextValue>(
    () => ({
      canAnimate: enabled && !reducedMotion && foreground,
      reduceMotion: reducedMotion,
      foreground,
      enabled,
    }),
    [enabled, reducedMotion, foreground],
  );
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export const useLumiMotion = (): LumiMotionContextValue => useContext(MotionContext);

/**
 * Screen-level companion policy: offscreen or background work must not keep
 * decorative loops running. Reduce Motion and the user switch still win.
 */
export function useCompanionPlaying(visible = true): boolean {
  const { canAnimate, foreground } = useLumiMotion();
  return canAnimate && foreground && visible;
}
