import React, { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { compileLumiMotifLandscape } from '../core/ui/motifLandscape';
import type { LumiMotif, LumiMotifVariant } from '../core/ui/motifs';
import type { LumiResolvedMode } from '../core/ui/theme';
import { useLumiTheme } from './LumiThemeProvider';
import { LumiVectorDocument } from './LumiVectorDocument';

export interface LumiMotifLandscapeProps {
  readonly motif?: LumiMotif;
  readonly variant?: LumiMotifVariant;
  readonly colorMode?: LumiResolvedMode;
  readonly style?: StyleProp<ViewStyle>;
}

/** Decorative card-sized world, prepared only when motif or appearance changes. */
export const LumiMotifLandscape = React.memo(function LumiMotifLandscape({
  motif, variant = 'day', colorMode, style,
}: LumiMotifLandscapeProps) {
  const theme = useLumiTheme();
  const world = motif ?? theme.motif;
  const mode = colorMode ?? theme.mode;
  const document = useMemo(() => compileLumiMotifLandscape(world, { mode, variant }), [world, mode, variant]);
  return <LumiVectorDocument document={document} mode="cover" {...(style === undefined ? {} : { style })} />;
});
