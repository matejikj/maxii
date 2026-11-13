import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useLumiTheme } from '../LumiThemeProvider';
export type LumiCardVariant = 'surface' | 'soft' | 'outlined';
export interface LumiCardProps extends ViewProps {
  variant?: LumiCardVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}
/** Backwards-compatible with v0.4 LumiCard<ViewProps>; new variant/padding are opt-in. */
export const LumiCard = React.memo(function LumiCard({
  children,
  style,
  variant = 'surface',
  padding = 'lg',
  ...rest
}: LumiCardProps) {
  const { colors, ui } = useLumiTheme();
  const insets = { none: 0, sm: ui.space.sm, md: ui.space.lg, lg: ui.space.xl }[padding];
  return (
    <View
      {...rest}
      style={[
        styles.base,
        {
          borderRadius: ui.radius.card,
          padding: insets,
          borderColor: colors.border,
          backgroundColor:
            variant === 'soft'
              ? colors.surfaceSubtle
              : variant === 'outlined'
                ? 'transparent'
                : colors.surface,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
});
const styles = StyleSheet.create({ base: { borderWidth: 1 } });
