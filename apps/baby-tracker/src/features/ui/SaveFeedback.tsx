import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LumiText, useLumiTheme } from '@lumi/forest-design/native';
import { PRODUCT_COPY } from './productCopy';

export type SaveFeedbackState = 'idle' | 'pending' | 'saved' | 'error';

export type SaveFeedbackProps = {
  state: SaveFeedbackState;
  message?: string;
  onUndo?: () => void;
  onEdit?: () => void;
  /** Undo toast window; parent owns the timer so retries keep the same intent. */
  undoAvailable?: boolean;
};

/**
 * Post-commit confirmation only. Pending means the press is in flight; error
 * never claims success and keeps the form open upstream.
 */
export function SaveFeedback({
  state,
  message,
  onUndo,
  onEdit,
  undoAvailable = false,
}: SaveFeedbackProps) {
  const { colors, ui } = useLumiTheme();
  if (state === 'idle') return null;

  const body =
    message ??
    (state === 'pending'
      ? 'Ukládám…'
      : state === 'saved'
        ? PRODUCT_COPY.feedback.diaperSaved
        : PRODUCT_COPY.feedback.saveFailed);

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="summary"
      style={[
        styles.banner,
        {
          backgroundColor: colors.surface,
          borderColor: state === 'error' ? colors.danger : colors.controlBorder,
          borderRadius: ui.radius.md,
          gap: ui.space.sm,
          padding: ui.space.md,
        },
      ]}
    >
      <LumiText>{body}</LumiText>
      {state === 'saved' ? (
        <View style={styles.actions}>
          {undoAvailable && onUndo ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={PRODUCT_COPY.actions.undo}
              onPress={onUndo}
              style={styles.action}
            >
              <LumiText tone="accent">{PRODUCT_COPY.actions.undo}</LumiText>
            </Pressable>
          ) : null}
          {onEdit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={PRODUCT_COPY.actions.edit}
              onPress={onEdit}
              style={styles.action}
            >
              <LumiText tone="accent">{PRODUCT_COPY.actions.edit}</LumiText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Keeps undo affordance mounted for the product window without ticking the SR. */
export function useUndoWindow(active: boolean, durationMs: number, onExpire: () => void) {
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(onExpire, durationMs);
    return () => clearTimeout(timer);
  }, [active, durationMs, onExpire]);
}

const styles = StyleSheet.create({
  banner: { borderWidth: 1, width: '100%' },
  actions: { flexDirection: 'row', gap: 16 },
  action: { minHeight: 48, minWidth: 48, justifyContent: 'center' },
});
