import React, { useMemo } from 'react';
import { Platform } from 'react-native';
import Svg from 'react-native-svg';
import { compileBaby, type LumiBabyPose, type LumiBabyVariant } from '../core/play/baby';
import { VectorNodeView } from './VectorNodeView';
export interface LumiBabyProps {
  variant?: LumiBabyVariant;
  pose?: LumiBabyPose;
  width?: number;
  height?: number;
}
export const LumiBaby = React.memo(function LumiBaby({
  variant = 'neutral',
  pose = 'sitting',
  width = 120,
  height = 140,
}: LumiBabyProps) {
  const nodes = useMemo(() => [compileBaby(variant, pose)], [variant, pose]);
  return (
    <Svg
      width={width}
      height={height}
      viewBox="-115 -125 230 285"
      pointerEvents="none"
      {...(Platform.OS === 'web'
        ? { 'aria-hidden': true, focusable: false }
        : { accessible: false })}
    >
      <VectorNodeView nodes={nodes} />
    </Svg>
  );
});
