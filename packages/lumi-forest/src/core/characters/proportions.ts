import type {
  CharacterPart,
  CharacterProportions,
  CharacterRig,
  Point,
  ProportionChannel,
} from './blueprint';

/** Intentionally conservative: reject implausible anatomy rather than render artifacts. */
export const PROPORTION_LIMITS: Readonly<Record<ProportionChannel, readonly [number, number]>> = {
  body: [0.82, 1.16],
  head: [0.85, 1.15],
  ears: [0.76, 1.3],
  paws: [0.86, 1.14],
};

export function validateProportions(
  proportions: CharacterProportions | undefined,
  parts: readonly CharacterPart[],
): void {
  if (proportions === undefined) return;
  for (const [key, value] of Object.entries(proportions)) {
    if (!(key in PROPORTION_LIMITS)) throw new RangeError(`Unknown proportion channel: ${key}`);
    const [min, max] = PROPORTION_LIMITS[key as ProportionChannel];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      throw new RangeError(`Proportion ${key} must be between ${min} and ${max}`);
    }
    if (key === 'ears' && !parts.some((part) => part.role === 'ear')) {
      throw new RangeError('This character has no ears to scale');
    }
  }
}

const pivotScale = (pivot: Point, sx: number, sy = sx): string =>
  `translate(${pivot.x} ${pivot.y}) scale(${sx} ${sy}) translate(${-pivot.x} ${-pivot.y})`;

/** Compiled into a single SVG transform string, no geometry cloning. */
export function proportionTransform(
  part: CharacterPart,
  rig: CharacterRig,
  proportions: CharacterProportions | undefined,
): string | undefined {
  if (!proportions) return undefined;
  const { head, body, ears, paws } = proportions;
  const transforms: string[] = [];
  const isHead = ['head', 'eye', 'nose', 'mouth', 'cheek', 'muzzle', 'ear', 'face'].includes(
    part.role,
  );
  if (isHead && head !== undefined && head !== 1)
    transforms.push(pivotScale(rig.pivots.head, head));
  if (['body', 'belly', 'mark', 'spines'].includes(part.role) && body !== undefined && body !== 1) {
    transforms.push(pivotScale(rig.pivots.body, body));
  }
  if (part.role === 'ear' && ears !== undefined && ears !== 1) {
    transforms.push(
      pivotScale(part.id.includes('left') ? rig.pivots.leftEar : rig.pivots.rightEar, 1, ears),
    );
  }
  if (part.role === 'paw' && paws !== undefined && paws !== 1) {
    transforms.push(pivotScale(rig.pivots.paws, paws));
  }
  return transforms.length ? transforms.join(' ') : undefined;
}
