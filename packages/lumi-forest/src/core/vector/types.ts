/** Renderer-neutral, JSON-serializable vector IR (v1). */
export interface VectorProps {
  readonly d?: string;
  readonly cx?: number;
  readonly cy?: number;
  readonly rx?: number;
  readonly ry?: number;
  readonly r?: number;
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly strokeLinecap?: 'butt' | 'round' | 'square';
  readonly strokeLinejoin?: 'miter' | 'round' | 'bevel';
  readonly opacity?: number;
  readonly transform?: string;
  readonly fillRule?: 'nonzero' | 'evenodd';
  readonly clipRule?: 'nonzero' | 'evenodd';
}

type Leaf<T extends string> = {
  readonly kind: T;
  readonly props: VectorProps;
  readonly children?: never;
};
export type VectorNode =
  | Leaf<'path'>
  | Leaf<'ellipse'>
  | Leaf<'circle'>
  | Leaf<'rect'>
  | {
      readonly kind: 'group';
      readonly props: VectorProps;
      readonly children: readonly VectorNode[];
    };

export type LayerId =
  'canvas' | 'landscape' | 'microdetails' | 'plants' | 'sky' | 'character' | 'objects';
export interface SceneLayer {
  readonly id: LayerId;
  readonly nodes: readonly VectorNode[];
}

export interface SceneDocument {
  readonly schemaVersion: 1;
  readonly scene: string;
  readonly width: number;
  readonly height: number;
  readonly layers: readonly SceneLayer[];
}
