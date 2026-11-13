import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLumiTheme } from '../LumiThemeProvider';
import { LumiText } from './LumiText';

export interface LumiBottomSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /**
   * Primary actions stay pinned below the scroll region so confirm/save remains
   * reachable without scrolling past long forms (keyboard + small screens).
   */
  footer?: React.ReactNode;
  /** Pass safe-area inset from your root if necessary (e.g. `useSafeAreaInsets().bottom`). */
  bottomInset?: number;
  testID?: string;
  /**
   * Optional host that should regain accessibility focus after close (the
   * control that opened the sheet). Without it, focus stays wherever the OS left it.
   */
  returnFocusRef?: React.RefObject<unknown>;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) =>
      setReduced(value),
    );
    return () => {
      mounted = false;
      listener.remove();
    };
  }, []);
  return reduced;
}

/** Native Modal handles Android back; Escape closes on web; backdrop is inert for SRs. */
export function LumiBottomSheet({
  visible,
  title,
  onClose,
  children,
  footer,
  bottomInset = 0,
  testID,
  returnFocusRef,
}: LumiBottomSheetProps) {
  const { colors, ui } = useLumiTheme();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const titleRef = useRef(null);
  const wasVisible = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, onClose]);

  useEffect(() => {
    // findNodeHandle is native-only; calling it on web throws and would tear down
    // the open sheet before caregivers can confirm a care write.
    if (Platform.OS === 'web') {
      wasVisible.current = visible;
      return;
    }
    if (visible) {
      wasVisible.current = true;
      const handle = findNodeHandle(titleRef.current);
      if (handle != null) {
        AccessibilityInfo.setAccessibilityFocus(handle);
      }
      return;
    }
    if (wasVisible.current && returnFocusRef?.current) {
      const handle = findNodeHandle(returnFocusRef.current as never);
      if (handle != null) {
        AccessibilityInfo.setAccessibilityFocus(handle);
      }
    }
    wasVisible.current = false;
  }, [visible, returnFocusRef]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduced ? 'none' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.fill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zavřít dialog"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
        />
        <View
          testID={testID}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: ui.radius.lg,
              borderTopRightRadius: ui.radius.lg,
              maxHeight: Math.max(240, height * 0.85),
              paddingBottom: Math.max(ui.space.xl, bottomInset),
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <View style={styles.header}>
            <View ref={titleRef} collapsable={false} style={styles.title}>
              <LumiText variant="h2" accessibilityRole="header">
                {title}
              </LumiText>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Zavřít"
              hitSlop={10}
              style={[styles.close, { backgroundColor: colors.surfaceSubtle }]}
            >
              <LumiText variant="h3">×</LumiText>
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={{ paddingHorizontal: ui.space.xl, paddingBottom: ui.space.md }}
          >
            {children}
          </ScrollView>
          {footer ? (
            <View
              style={{
                paddingHorizontal: ui.space.xl,
                paddingTop: ui.space.md,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
                gap: ui.space.sm,
              }}
            >
              {footer}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  sheet: { overflow: 'hidden', paddingTop: 8 },
  grabber: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 15 },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { flex: 1 },
  close: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
});
