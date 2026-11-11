import React, { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg from 'react-native-svg';
import { compileLumiIcon, type LumiIconId } from '../../core/icons';
import { LUMI_UI_TOKENS } from '../../core/ui/tokens';
import { VectorNodeView } from '../VectorNodeView';

export interface LumiIconProps {
  readonly name: LumiIconId;
  readonly color: string;
  readonly accentColor?: string;
  readonly size?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly accessibilityLabel?: string;
}

/** Renders a compiled forest UI icon. Color and size come from the caller (e.g. tab tint). */
export const LumiIcon = React.memo(function LumiIcon({
  name,
  color,
  accentColor,
  size = LUMI_UI_TOKENS.size.iconLarge,
  style,
  accessibilityLabel,
}: LumiIconProps) {
  const document = useMemo(() => compileLumiIcon(name, {
    color, ...(accentColor === undefined ? {} : { accentColor }),
  }), [name, color, accentColor]);
  const labeled = accessibilityLabel != null && accessibilityLabel.length > 0;
  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible={labeled}
      accessibilityRole={labeled ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={labeled ? 'yes' : 'no-hide-descendants'}
      pointerEvents="none"
    >
      <Svg width={size} height={size} viewBox={`0 0 ${document.width} ${document.height}`}>
        <VectorNodeView nodes={document.nodes} />
      </Svg>
    </View>
  );
});
