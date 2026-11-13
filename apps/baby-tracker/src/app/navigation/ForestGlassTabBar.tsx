import React, { useEffect, useId, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Keyboard, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlatformPressable } from '@react-navigation/elements';
import { BottomTabBar, type BottomTabBarButtonProps, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useLumiTheme } from '@lumi/forest-design/native';
import { forestDockMetrics, forestGlassColors } from './forestGlass';

export type ForestBlurTarget = React.RefObject<React.ComponentRef<typeof View> | null>;

/** A floating bottom offset must disappear completely above the open keyboard. */
export function ForestGlassNavigationBar(props: BottomTabBarProps) {
  const [keyboardVisible, setKeyboardVisible] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { shown.remove(); hidden.remove(); };
  }, []);
  return keyboardVisible ? null : <BottomTabBar {...props} />;
}

export function useForestDockInset() {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return forestDockMetrics(width, fontScale, insets).contentInset;
}

export function useGlassAccessibility() {
  const [reducedMotion, setReducedMotion] = useState(true);
  const [reducedTransparency, setReducedTransparency] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (!cancelled) setReducedMotion(value); }).catch(() => {});
    // React Native Web does not expose the native transparency API.
    const supportsTransparency = typeof AccessibilityInfo.isReduceTransparencyEnabled === 'function';
    if (supportsTransparency) void AccessibilityInfo.isReduceTransparencyEnabled().then((value) => { if (!cancelled) setReducedTransparency(value); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    const transparency = supportsTransparency ? AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReducedTransparency) : null;
    const webPreference = Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-transparency: reduce)') : null;
    const onWebPreference = () => { if (webPreference) setReducedTransparency(webPreference.matches); };
    if (webPreference) { onWebPreference(); webPreference.addEventListener('change', onWebPreference); }
    return () => { cancelled = true; motion.remove(); transparency?.remove(); webPreference?.removeEventListener('change', onWebPreference); };
  }, []);
  return { reducedMotion, reducedTransparency };
}

/** A sibling blur samples only the focused screen, never the tab bar itself. */
export function ForestGlassSurface({ target, reducedTransparency, radius }: {
  target: ForestBlurTarget; reducedTransparency: boolean; radius: number;
}) {
  const { colors, mode, motif } = useLumiTheme();
  const material = forestGlassColors(colors, mode, motif);
  const gradient = `dock-sheen-${useId().replace(/:/g, '')}`;
  return <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
    testID="forest-glass-surface" style={[StyleSheet.absoluteFill, styles.surface,
      { borderRadius: radius, borderColor: material.rim }]}>
    {reducedTransparency ? <View style={[StyleSheet.absoluteFill, { backgroundColor: material.opaque }]} />
      : <BlurView key={mode} blurTarget={target} blurMethod="dimezisBlurViewSdk31Plus" intensity={64}
        tint={mode === 'dark' ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
        style={StyleSheet.absoluteFill} />}
    {!reducedTransparency ? <View style={[StyleSheet.absoluteFill, { backgroundColor: material.wash }]} /> : null}
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 400 100" preserveAspectRatio="none">
      <Defs><LinearGradient id={gradient} x1="0" y1="0" x2="0.2" y2="1">
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity={mode === 'dark' ? 0.1 : 0.24} />
        <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.015" />
        <Stop offset="1" stopColor={colors.primary} stopOpacity="0.025" />
      </LinearGradient></Defs>
      <Rect x="0" y="0" width="400" height="100" rx="48" fill={`url(#${gradient})`} />
      <Path d="M 20 20 C 29 8 40 3 59 3 H 341 C 354 3 366 7 374 13"
        fill="none" stroke={material.reflection} strokeWidth="1.15" strokeLinecap="round" />
    </Svg>
    <View style={[styles.innerRim, { borderRadius: radius - 3, borderColor: material.innerRim }]} />
  </View>;
}

/** Keeps React Navigation's press/long-press, links and accessibility semantics intact. */
export function ForestDockButton({ reducedMotion, style, children, onFocus, onBlur, ...props }:
  BottomTabBarButtonProps & { reducedMotion: boolean }) {
  const { colors, mode, motif } = useLumiTheme();
  const material = forestGlassColors(colors, mode, motif);
  const selected = props['aria-selected'] === true;
  const progress = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: selected ? 1 : 0,
      duration: reducedMotion ? 0 : 180, useNativeDriver: Platform.OS !== 'web' });
    animation.start(); return () => animation.stop();
  }, [progress, reducedMotion, selected]);
  return <PlatformPressable {...props} pressOpacity={0.84}
    android_ripple={{ color: 'transparent', borderless: false }}
    onFocus={(event) => { setFocused(true); onFocus?.(event); }}
    onBlur={(event) => { setFocused(false); onBlur?.(event); }}
    style={[style, styles.button, { borderColor: focused ? (selected ? colors.onPrimary : colors.focus) : 'transparent' }]}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.active,
      { backgroundColor: material.active, opacity: selected ? 1 : 0,
        transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>
      <View style={[styles.activeGlint, { backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.24)' }]} />
    </Animated.View>
    {children}
  </PlatformPressable>;
}

const styles = StyleSheet.create({
  surface: { overflow: 'hidden', borderWidth: 1, borderCurve: 'continuous' },
  innerRim: { position: 'absolute', left: 2, top: 2, right: 2, bottom: 2, borderWidth: 0.75 },
  button: { borderRadius: 29, borderCurve: 'continuous', borderWidth: 2, minHeight: 48,
    paddingTop: 6, paddingBottom: 4, justifyContent: 'center', overflow: 'hidden' },
  active: { borderRadius: 27, borderCurve: 'continuous' },
  activeGlint: { position: 'absolute', top: 2, left: 16, right: 16, height: 1, borderRadius: 1 },
});
