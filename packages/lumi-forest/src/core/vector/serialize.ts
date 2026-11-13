/** Offline export / screenshot tooling; NOT used by the native runtime renderer. */
import type { SceneDocument, VectorNode, VectorProps } from './types';

const attrNames: Readonly<Record<keyof VectorProps, string>> = {
  d: 'd',
  cx: 'cx',
  cy: 'cy',
  rx: 'rx',
  ry: 'ry',
  r: 'r',
  x: 'x',
  y: 'y',
  width: 'width',
  height: 'height',
  fill: 'fill',
  stroke: 'stroke',
  strokeWidth: 'stroke-width',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin',
  opacity: 'opacity',
  transform: 'transform',
  fillRule: 'fill-rule',
  clipRule: 'clip-rule',
};
const tagNames = {
  group: 'g',
  path: 'path',
  circle: 'circle',
  ellipse: 'ellipse',
  rect: 'rect',
} as const;

export function escapeSvgAttribute(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;');
}

export function serializeVectorNode(node: VectorNode): string {
  const name = tagNames[node.kind];
  const attrs = Object.entries(node.props)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(
      ([key, value]) =>
        ` ${attrNames[key as keyof VectorProps]}="${escapeSvgAttribute(value as string | number)}"`,
    )
    .join('');
  if (node.kind !== 'group') return `<${name}${attrs}/>`;
  return `<${name}${attrs}>${node.children.map(serializeVectorNode).join('')}</${name}>`;
}

export function serializeScene(document: SceneDocument): string {
  const all = document.layers.flatMap((layer) => layer.nodes.map(serializeVectorNode)).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${document.width}" height="${document.height}" ` +
    `viewBox="0 0 ${document.width} ${document.height}" preserveAspectRatio="xMidYMax slice">${all}</svg>`
  );
}
