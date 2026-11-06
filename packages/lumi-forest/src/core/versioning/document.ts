import type { SceneDocument, SceneLayer, VectorNode, VectorProps } from '../vector/types';
import { serializeScene } from '../vector/serialize';

/** Protect the public persisted/remote JSON boundary; not part of animation/render loops. */
export class SceneDocumentValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'SceneDocumentValidationError'; }
}
const TYPES = ['rect', 'ellipse', 'circle', 'path', 'group'];
const LAYERS = ['canvas', 'landscape', 'microdetails', 'plants', 'sky', 'character', 'objects'];
const NUMERIC_PROPS = ['cx', 'cy', 'rx', 'ry', 'r', 'x', 'y', 'width', 'height', 'strokeWidth', 'opacity'];
const STRING_PROPS = ['d', 'fill', 'stroke', 'transform', 'strokeLinecap', 'strokeLinejoin', 'fillRule', 'clipRule'];
const NONNEGATIVE = ['rx', 'ry', 'r', 'width', 'height', 'strokeWidth'];
const numeric = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
function fail(message: string): never { throw new SceneDocumentValidationError(message); }
function obj(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function validateProps(value: unknown): VectorProps {
  if (!obj(value)) fail('VectorNode.props must be an object');
  const result: Record<string, string | number> = {};
  for (const [key, v] of Object.entries(value)) {
    if (NUMERIC_PROPS.includes(key)) {
      if (!numeric(v) || Math.abs(v) > 100000 || (NONNEGATIVE.includes(key) && v < 0)
          || (key === 'opacity' && (v < 0 || v > 1))) fail(`Invalid numeric SVG property: ${key}`);
      result[key] = v;
    } else if (STRING_PROPS.includes(key)) {
      if (typeof v !== 'string' || v.length > (key === 'd' ? 65536 : 2048)) fail(`Invalid SVG string: ${key}`);
      if (key === 'd' && !/^[MmLlHhVvCcSsQqTtAaZzEe\d\s.,+\-]*$/.test(v)) fail('Unsafe SVG path data');
      if ((key === 'fill' || key === 'stroke') && !/^(?:#(?:[\da-fA-F]{3}|[\da-fA-F]{4}|[\da-fA-F]{6}|[\da-fA-F]{8})|none|transparent|currentColor)$/.test(v)) fail('Unsafe SVG paint');
      if (key === 'transform' && !/^[a-zA-Z\d\s.,()\-+]*$/.test(v)) fail('Unsafe SVG transform');
      if (key === 'strokeLinecap' && !['butt', 'round', 'square'].includes(v)) fail('Invalid linecap');
      if (key === 'strokeLinejoin' && !['miter', 'round', 'bevel'].includes(v)) fail('Invalid linejoin');
      if ((key === 'fillRule' || key === 'clipRule') && !['evenodd', 'nonzero'].includes(v)) fail('Invalid fill rule');
      result[key] = v;
    } else fail(`Unsupported SVG property: ${key}`);
  }
  return result as VectorProps;
}
function readNode(input: unknown, state: { nodes: number; pathChars: number }, depth: number): VectorNode {
  if (!obj(input) || typeof input.kind !== 'string' || !TYPES.includes(input.kind)) fail('Invalid VectorNode.kind');
  if (depth > 32 || ++state.nodes > 4096) fail('SceneDocument geometry limit exceeded');
  const props = validateProps(input.props);
  if (props.d) {
    state.pathChars += props.d.length;
    if (state.pathChars > 250000) fail('SceneDocument path character budget exceeded');
  }
  if (input.kind === 'group') {
    if (!Array.isArray(input.children)) fail('Group.children must be an array');
    if (input.children.length > 4096) fail('Too many children');
    return { kind: 'group', props, children: input.children.map(child => readNode(child, state, depth + 1)) };
  }
  if ('children' in input && input.children !== undefined) fail('SVG leaf cannot have children');
  if (input.kind === 'path' && typeof props.d !== 'string') fail('Path requires d');
  return { kind: input.kind as 'path', props };
}

/** Validate unknown JSON + copy into a clean, detached SceneDocument v1. */
export function readSceneDocument(input: unknown): SceneDocument {
  if (!obj(input) || input.schemaVersion !== 1) fail('Unsupported SceneDocument schemaVersion');
  if (typeof input.scene !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(input.scene)) fail('Invalid SceneDocument.scene');
  if (!numeric(input.width) || !numeric(input.height) || input.width <= 0 || input.height <= 0 ||
      input.width > 8192 || input.height > 8192) fail('SceneDocument dimensions must be 1..8192');
  if (!Array.isArray(input.layers) || input.layers.length > 12) fail('Invalid layers');
  const state = { nodes: 0, pathChars: 0 };
  const seen = new Set<string>();
  const layers: SceneLayer[] = input.layers.map(layer => {
    if (!obj(layer) || typeof layer.id !== 'string' || !LAYERS.includes(layer.id) || seen.has(layer.id)) fail('Invalid/duplicate layer ID');
    seen.add(layer.id);
    if (!Array.isArray(layer.nodes) || layer.nodes.length > 4096) fail('Invalid layer nodes');
    return { id: layer.id as SceneLayer['id'], nodes: layer.nodes.map(n => readNode(n, state, 0)) };
  });
  return { schemaVersion: 1, scene: input.scene, width: input.width, height: input.height, layers };
}

/** Use this at file/API import boundaries; trust only engine-created in-memory documents in hot paths. */
export function serializeValidatedScene(input: unknown): string {
  return serializeScene(readSceneDocument(input));
}
