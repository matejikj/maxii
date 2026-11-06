import { compileCharacter } from '../characters/compiler';
import type { CharacterBlueprintV2, CharacterCompileOptions, CharacterPart, Point } from '../characters/blueprint';
import { group } from '../vector/nodes';
import type { VectorNode, VectorProps } from '../vector/types';

export type AnimatedPartChannel = 'leftEye' | 'rightEye' | 'leftEar' | 'rightEar' | 'static';
export interface MotionPart {
  readonly id: string;
  readonly role: CharacterPart['role'] | 'accessory';
  readonly node: VectorNode;
  readonly channel: AnimatedPartChannel;
  readonly pivot: Point | null;
}
export interface PreparedMotionCharacter {
  readonly parts: readonly MotionPart[];
  readonly innerProps: VectorProps;
  readonly outerProps?: VectorProps;
  readonly source: VectorNode;
}

/**
 * Compilation is done ONCE on semantic-prop changes, never from a frame callback.
 * All part order and shapes are preserved; the animation adapter owns only transforms.
 * For legacy/v1 callers use LumiCharacter; motion needs named anatomy (schema v2).
 */
export function prepareCharacterMotion(
  blueprint: CharacterBlueprintV2,
  options: CharacterCompileOptions = {},
): PreparedMotionCharacter {
  const source = compileCharacter(blueprint, options);
  if (source.kind !== 'group') throw new RangeError('Expected compiled character group');
  const sleeping = options.pose === 'sleeping';
  const inner = sleeping ? source.children[0] : source;
  if (!inner || inner.kind !== 'group') throw new RangeError('Expected inner character group');
  const ordered = blueprint.base.parts
    .map((part, index) => ({ part, index }))
    .sort((a,b) => a.part.order - b.part.order || a.index - b.index);
  if (inner.children.length < ordered.length) throw new RangeError('Animated character anatomy is incomplete');
  const parts: MotionPart[] = inner.children.map((node, index) => {
    const part = ordered[index]?.part;
    if (!part) return { id: `accessory-${index - ordered.length}`, role: 'accessory', node, channel: 'static', pivot: null };
    const channel: AnimatedPartChannel =
      part.id === 'eye-left' ? 'leftEye' : part.id === 'eye-right' ? 'rightEye' :
      part.role === 'ear' && part.id.includes('left') ? 'leftEar' :
      part.role === 'ear' && part.id.includes('right') ? 'rightEar' : 'static';
    const pivot = channel === 'leftEye' ? blueprint.rig.leftEye :
      channel === 'rightEye' ? blueprint.rig.rightEye :
      channel === 'leftEar' ? blueprint.rig.pivots.leftEar :
      channel === 'rightEar' ? blueprint.rig.pivots.rightEar : null;
    return { id: part.id, role: part.role, node, channel, pivot };
  });
  return {
    parts,
    innerProps: inner.props,
    ...(sleeping ? { outerProps: source.props } : {}),
    source,
  };
}

/** Regression utility: motion-disabled topology must equal the compiled artwork exactly. */
export function reconstructPreparedCharacter(prepared: PreparedMotionCharacter): VectorNode {
  const inner = group(prepared.parts.map(part => part.node), prepared.innerProps);
  return prepared.outerProps ? group([inner], prepared.outerProps) : inner;
}
