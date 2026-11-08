import { group } from '../vector/nodes';
import type { VectorNode, VectorProps } from '../vector/types';
import { applyAppearanceStylePolish } from './appearanceStyles';
import { compileAccessory, ACCESSORY_SLOTS } from './accessories';
import type {
  CharacterBlueprint, CharacterBlueprintV2, CharacterCompileOptions,
  CharacterComposition, CharacterExpression, CharacterPart, CharacterAccessory,
  CharacterPose,
} from './blueprint';
import { isCharacterRole } from './blueprint';
import type { CharacterPropId } from './collection';
import { CHARACTER_PROP_IDS } from './collection';
import { expressionEye, expressionMouth } from './expressions';
import { poseTransform, wholePoseTransform } from './poses';
import { compileCharacterProp } from './props';
import { proportionTransform, validateProportions } from './proportions';
import type { CharacterAppearanceStyle, StudioActionId } from './studioCollection';
import { resolveStudioAction } from './studioCollection';

/** Safe retained default render: the source blueprints are treated as immutable. */
const preparedPartsCache = new WeakMap<CharacterBlueprintV2, readonly CharacterPart[]>();
const defaultCache = new WeakMap<CharacterBlueprintV2, VectorNode>();
const variantCache = new WeakMap<CharacterBlueprintV2, Map<string, VectorNode>>();
const MAX_CACHED_VARIANTS_PER_BLUEPRINT = 48;
const MAX_PARTS = 96;
const MAX_VECTOR_NODES = 256;
const MAX_DEPTH = 14;

function validateNodeBudget(node: VectorNode, remaining: { budget: number }, depth = 0): void {
  if (++remaining.budget > MAX_VECTOR_NODES || depth > MAX_DEPTH) {
    throw new RangeError('Character exceeds complexity or nesting budget');
  }
  if (node.kind === 'group') node.children.forEach(child => validateNodeBudget(child, remaining, depth + 1));
}

function checkedParts(parts: readonly CharacterPart[]): readonly CharacterPart[] {
  if (!Array.isArray(parts) || parts.length > MAX_PARTS) throw new RangeError('Invalid character part count');
  const seen = new Set<string>();
  const budget = { budget: 0 };
  parts.forEach(part => {
    if (!part.id || seen.has(part.id)) throw new RangeError(`Duplicate/empty character part ID: ${part.id}`);
    if (!isCharacterRole(part.role)) throw new RangeError(`Unknown character part role: ${part.role}`);
    if (!Number.isFinite(part.order)) throw new RangeError(`Non-finite z-order in part: ${part.id}`);
    if (part.opacity !== undefined && (!Number.isFinite(part.opacity) || part.opacity < 0 || part.opacity > 1)) {
      throw new RangeError(`Invalid opacity in part: ${part.id}`);
    }
    if (part.transform !== undefined && typeof part.transform !== 'string') {
      throw new TypeError(`Transform must be a string in part: ${part.id}`);
    }
    validateNodeBudget(part.geometry, budget);
    seen.add(part.id);
  });
  return parts.map((part, index) => ({ part, index }))
    .sort((a, b) => a.part.order - b.part.order || a.index - b.index)
    .map(({ part }) => part);
}

/** Validate structural rig contracts once for each immutable blueprint identity. */
function preparedParts(blueprint: CharacterBlueprintV2): readonly CharacterPart[] {
  const previous = preparedPartsCache.get(blueprint);
  if (previous) return previous;
  const parts = checkedParts(blueprint.base.parts);
  const roleForId: Readonly<Record<string, CharacterPart['role']>> = {
    'eye-left': 'eye', 'eye-right': 'eye', mouth: 'mouth', body: 'body', head: 'head',
  };
  for (const [id, role] of Object.entries(roleForId)) {
    if (!parts.some(part => part.id === id && part.role === role)) {
      throw new RangeError(`Character ${blueprint.species} is missing anatomical ${id}:${role}`);
    }
  }
  for (const point of [blueprint.rig.leftEye, blueprint.rig.rightEye, blueprint.rig.mouth,
    ...Object.values(blueprint.rig.pivots), ...Object.values(blueprint.rig.accessoryAnchors)]) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new RangeError(`Invalid character rig landmark: ${blueprint.species}`);
    }
  }
  preparedPartsCache.set(blueprint, parts);
  return parts;
}

function groupWithProps(node: VectorNode, transforms: readonly (string | undefined)[], opacity?: number): VectorNode {
  const transform = transforms.filter((item): item is string => !!item).join(' ');
  if (!transform && opacity === undefined) return node;
  const props: VectorProps = {
    ...(transform ? { transform } : {}),
    ...(opacity !== undefined ? { opacity } : {}),
  };
  return group([node], props);
}

function compileV1(composition: CharacterComposition): VectorNode {
  if (composition.kind === 'legacy') return composition.geometry;
  const parts = checkedParts(composition.parts);
  return group(parts.map(part => groupWithProps(part.geometry, [part.transform], part.opacity)));
}

function resolvePropList(options: CharacterCompileOptions): readonly CharacterPropId[] {
  const list: CharacterPropId[] = [];
  if (options.prop != null) list.push(options.prop);
  if (options.props) {
    for (const prop of options.props) {
      if (!list.includes(prop)) list.push(prop);
    }
  }
  if (list.length > 2) {
    throw new RangeError('A character supports at most two props at once');
  }
  for (const prop of list) {
    if (!(CHARACTER_PROP_IDS as readonly string[]).includes(prop)) {
      throw new RangeError(`Unsupported character prop: ${String(prop)}`);
    }
  }
  return list;
}

function validateV2(blueprint: CharacterBlueprintV2, options: CharacterCompileOptions): {
  pose: CharacterPose;
  expression: CharacterExpression;
  accessories: readonly CharacterAccessory[];
  props: readonly CharacterPropId[];
  appearanceStyle: CharacterAppearanceStyle;
} {
  const pose = options.pose === undefined || options.pose === 'default' ? 'sitting' : options.pose;
  const expression = options.expression ?? (pose === 'sleeping' ? 'sleepy' : 'neutral');
  if (!blueprint.supportedPoses.includes(pose as Exclude<CharacterPose, 'default'>)) {
    throw new RangeError(`Unsupported pose for ${blueprint.species}: ${String(pose)}`);
  }
  if (!blueprint.supportedExpressions.includes(expression)) {
    throw new RangeError(`Unsupported expression for ${blueprint.species}: ${String(expression)}`);
  }
  const accessories: readonly CharacterAccessory[] = options.accessories ?? [];
  if (!Array.isArray(accessories) || accessories.length > 3) {
    throw new RangeError('A character supports up to 3 accessories');
  }
  const usedSlots = new Set<string>();
  for (const accessory of accessories as readonly CharacterAccessory[]) {
    if (!blueprint.supportedAccessories.includes(accessory)) {
      throw new RangeError(`Unsupported accessory: ${String(accessory)}`);
    }
    const slot = ACCESSORY_SLOTS[accessory];
    if (usedSlots.has(slot)) throw new RangeError(`Accessory slot already occupied: ${slot}`);
    usedSlots.add(slot);
  }
  const props = resolvePropList(options);
  const appearanceStyle = options.appearanceStyle ?? 'forest';
  validateProportions(options.proportions, preparedParts(blueprint));
  return { pose, expression, accessories, props, appearanceStyle };
}

function compileV2(blueprint: CharacterBlueprintV2, options: CharacterCompileOptions): VectorNode {
  const { pose, expression, accessories, props, appearanceStyle } = validateV2(blueprint, options);
  const proportional = options.proportions !== undefined &&
    Object.values(options.proportions).some(value => value !== undefined && value !== 1);
  const pristine =
    pose === 'sitting' &&
    expression === 'neutral' &&
    accessories.length === 0 &&
    props.length === 0 &&
    appearanceStyle === 'forest' &&
    !proportional;
  if (pristine) {
    const previous = defaultCache.get(blueprint);
    if (previous) return previous;
  }
  // Cache only low-cardinality, immutable presets, never arbitrary proportions.
  const cacheKey = !proportional && accessories.length <= 1 && props.length <= 1
    ? `${pose}/${expression}/${accessories[0] ?? 'none'}/${props[0] ?? 'none'}/${appearanceStyle}`
    : undefined;
  const cached = cacheKey === undefined ? undefined : variantCache.get(blueprint)?.get(cacheKey);
  if (cached) return cached;
  const parts = applyAppearanceStylePolish(preparedParts(blueprint), appearanceStyle);
  const rig = blueprint.rig;
  const rendered = parts.map(part => {
    let geometry: VectorNode = part.geometry;
    if (expression !== 'neutral') {
      if (part.id === 'eye-left') geometry = expressionEye(expression, rig.leftEye, rig);
      else if (part.id === 'eye-right') geometry = expressionEye(expression, rig.rightEye, rig);
      else if (part.id === 'mouth') geometry = expressionMouth(expression, rig);
    }
    const transforms = [poseTransform(part, pose), proportionTransform(part, rig, options.proportions), part.transform];
    return groupWithProps(geometry, transforms, part.opacity);
  });
  for (const accessory of accessories) rendered.push(compileAccessory(accessory, rig));
  for (const prop of props) rendered.push(compileCharacterProp(prop, rig));
  const base = group(rendered);
  const whole = wholePoseTransform(pose);
  const result = whole ? group([base], { transform: whole }) : base;
  if (pristine) defaultCache.set(blueprint, result);
  if (cacheKey !== undefined) {
    let cache = variantCache.get(blueprint);
    if (!cache) { cache = new Map(); variantCache.set(blueprint, cache); }
    if (cache.size >= MAX_CACHED_VARIANTS_PER_BLUEPRINT) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(cacheKey, result);
  }
  return result;
}

/**
 * Compile a workshop action as a static offline drawing. Unknown action IDs
 * return null so callers can fall back to a calm forest pose.
 */
export function compileStudioActionStatic(
  blueprint: CharacterBlueprint,
  actionId: StudioActionId | string,
  appearanceStyle: CharacterAppearanceStyle = 'workshop',
): VectorNode | null {
  const action = resolveStudioAction(actionId);
  if (!action) return null;
  if (blueprint.schemaVersion !== 2 || blueprint.species !== action.species) return null;
  return compileCharacter(blueprint, {
    pose: action.pose,
    expression: action.expression,
    props: action.props as readonly CharacterPropId[],
    appearanceStyle,
  });
}

/**
 * Pure, deterministic, renderer-agnostic character compiler.
 * V1 retains authored variants. V2 applies independent expression, pose,
 * proportions and accessory passes to stable named anatomical parts.
 */
export function compileCharacter(
  blueprint: CharacterBlueprint,
  options: CharacterCompileOptions = {},
): VectorNode {
  if (blueprint.schemaVersion === 1) {
    if (options.accessories?.length || options.proportions !== undefined) {
      throw new RangeError('Accessories and proportions require blueprint schema v2');
    }
    const pose = options.pose ?? 'default';
    const expression = options.expression ?? 'neutral';
    const composition = pose === 'default' && expression === 'neutral'
      ? blueprint.base
      : blueprint.variants?.find(v => v.pose === pose && v.expression === expression)?.composition;
    if (!composition) throw new RangeError(`No authored variant for ${blueprint.species}: ${pose}/${expression}`);
    return compileV1(composition);
  }
  if (blueprint.schemaVersion === 2) return compileV2(blueprint, options);
  throw new RangeError('Unsupported character blueprint version');
}
