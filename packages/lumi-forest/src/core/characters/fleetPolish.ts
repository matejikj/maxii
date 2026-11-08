import type { CharacterPart } from './blueprint';

/**
 * Soft-compact fleet polish for the original five species so they share the
 * rabbit pilot bar: calmer blush, slightly rounder heads, quieter highlights.
 * Silhouettes stay species-specific — never a recolor of the same body.
 */
export function applySoftCompactFleetPolish(
  parts: readonly CharacterPart[],
): readonly CharacterPart[] {
  return parts.map((part) => {
    const geometry = part.geometry;
    if (geometry.kind !== 'ellipse' && geometry.kind !== 'circle' && geometry.kind !== 'path') {
      return part;
    }

    const props = { ...geometry.props } as Record<string, unknown>;
    let changed = false;

    if (part.id === 'head' && geometry.kind === 'ellipse') {
      if (typeof props.rx === 'number') {
        props.rx = props.rx * 1.02;
        changed = true;
      }
      if (typeof props.ry === 'number') {
        props.ry = props.ry * 1.03;
        changed = true;
      }
    }

    if (part.role === 'cheek' && typeof props.opacity === 'number') {
      props.opacity = Math.min(0.78, Math.max(0.62, props.opacity * 1.08));
      changed = true;
    }

    if (part.id === 'highlight' && typeof props.opacity === 'number') {
      props.opacity = Math.min(props.opacity, 0.55);
      changed = true;
    }

    if (!changed) return part;
    return {
      ...part,
      geometry: { ...geometry, props },
    };
  });
}
