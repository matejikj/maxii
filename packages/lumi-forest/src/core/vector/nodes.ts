import type { VectorNode, VectorProps } from './types';

export const path = (d: string, props: VectorProps = {}): VectorNode => ({ kind: 'path', props: { d, ...props } });
export const circle = (cx: number, cy: number, r: number, props: VectorProps = {}): VectorNode =>
  ({ kind: 'circle', props: { cx, cy, r, ...props } });
export const ellipse = (cx: number, cy: number, rx: number, ry: number, props: VectorProps = {}): VectorNode =>
  ({ kind: 'ellipse', props: { cx, cy, rx, ry, ...props } });
export const rect = (width: number, height: number, props: VectorProps = {}): VectorNode =>
  ({ kind: 'rect', props: { width, height, ...props } });
export const group = (children: readonly VectorNode[], props: VectorProps = {}): VectorNode =>
  ({ kind: 'group', props, children });
