import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useLumiTheme } from '../LumiThemeProvider';
import { LumiText } from './LumiText';
export interface LumiBottomSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Pass safe-area inset from your root if necessary (e.g. `useSafeAreaInsets().bottom`). */
  bottomInset?: number;
  testID?: string;
}
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduced(value); }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', value => setReduced(value));
    return () => { mounted = false; listener.remove(); };
  }, []);
  return reduced;
}
/** Native Modal handles Android back; background is hidden from screen readers. */
export function LumiBottomSheet({ visible, title, onClose, children, bottomInset = 0, testID }: LumiBottomSheetProps) {
  const { colors, ui } = useLumiTheme();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  return <Modal visible={visible} transparent animationType={reduced ? 'none' : 'slide'} onRequestClose={onClose}
    statusBarTranslucent navigationBarTranslucent>
    <View style={styles.fill}>
      <Pressable accessibilityRole="button" accessibilityLabel="Zavřít dialog" onPress={onClose}
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} />
      <View testID={testID} accessibilityViewIsModal style={[styles.sheet, { backgroundColor: colors.surface,
        borderTopLeftRadius: ui.radius.lg, borderTopRightRadius: ui.radius.lg,
        maxHeight: Math.max(240, height * .85), paddingBottom: Math.max(ui.space.xl, bottomInset) }]}>
        <View style={[styles.grabber, { backgroundColor: colors.border }]} />
        <View style={styles.header}>
          <LumiText variant="h2" accessibilityRole="header" style={styles.title}>{title}</LumiText>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Zavřít" hitSlop={10}
            style={[styles.close, { backgroundColor: colors.surfaceSubtle }]}>
            <LumiText variant="h3">×</LumiText>
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: ui.space.xl, paddingBottom: ui.space.md }}>
          {children}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({ fill: { flex: 1, justifyContent: 'flex-end' },
  sheet: { overflow: 'hidden', paddingTop: 8 }, grabber: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 15 },
  header: { paddingHorizontal: 24, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1 }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 } });
