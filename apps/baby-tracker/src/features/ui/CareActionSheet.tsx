import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LumiBottomSheet, LumiText, useLumiTheme } from '@lumi/forest-design/native';
export type CareActionSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Keeps the primary action above the open keyboard / home indicator. */
  footer?: React.ReactNode;
  returnFocusRef?: React.RefObject<unknown>;
};

/**
 * Product wrapper around LumiBottomSheet: safe-area footer, keyboard-friendly
 * scroll, and optional focus return to the opener.
 */
export function CareActionSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
  returnFocusRef,
}: CareActionSheetProps) {
  const insets = useSafeAreaInsets();
  const { ui } = useLumiTheme();
  return (
    <LumiBottomSheet
      visible={visible}
      title={title}
      onClose={onClose}
      bottomInset={insets.bottom}
      {...(returnFocusRef ? { returnFocusRef } : {})}
    >
      <View style={{ gap: ui.space.lg, paddingBottom: ui.space.lg }}>
        {subtitle ? (
          <LumiText tone="muted" variant="caption">
            {subtitle}
          </LumiText>
        ) : null}
        {children}
        {footer ? (
          <View
            style={{
              gap: ui.space.sm,
              paddingTop: ui.space.md,
              // Keep confirm actions reachable while the keyboard is open.
              marginBottom: Math.max(insets.bottom, ui.space.md),
            }}
          >
            {footer}
          </View>
        ) : null}
      </View>
    </LumiBottomSheet>
  );
}
