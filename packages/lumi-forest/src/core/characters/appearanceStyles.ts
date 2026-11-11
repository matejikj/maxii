import type { CharacterPart } from './blueprint';
import type { CharacterAppearanceStyle } from './studioCollection';

/**
 * Workshop and restrained looks keep the same species anatomy. Maturity comes
 * from quieter blush, calmer highlights and slightly upright posture — never a
 * costume swap or gendered recolor.
 */
export function applyAppearanceStylePolish(
  parts: readonly CharacterPart[],
  style: CharacterAppearanceStyle,
): readonly CharacterPart[] {
  if (style === 'forest') return parts;

  const cheekScale = style === 'workshop' ? 0.72 : 0.45;
  const highlightCap = style === 'workshop' ? 0.42 : 0.28;
  const upright = style === 'workshop' ? 1.01 : 1.02;

  return parts.map((part) => {
    const geometry = part.geometry;
    const props = { ...geometry.props } as Record<string, unknown>;
    let changed = false;

    if (part.role === 'cheek' && typeof props.opacity === 'number') {
      props.opacity = Math.max(0.2, props.opacity * cheekScale);
      changed = true;
    }

    if (part.id === 'highlight' && typeof props.opacity === 'number') {
      props.opacity = Math.min(props.opacity, highlightCap);
      changed = true;
    }

    if (part.id === 'head' && geometry.kind === 'ellipse' && typeof props.ry === 'number') {
      // Slightly taller head reading for workshop posture without changing species.
      props.ry = props.ry * upright;
      changed = true;
    }

    if (part.id === 'head' && geometry.kind === 'group') {
      // Sculpted heads use normalized local coordinates; keep all material
      // layers together when applying the same slight upright style bias.
      props.transform = `${geometry.props.transform ?? ''} scale(1 ${upright})`.trim();
      changed = true;
    }

    if (style === 'restrained' && part.role === 'mark') {
      props.opacity = Math.min(typeof props.opacity === 'number' ? props.opacity : 1, 0.35);
      changed = true;
    }

    if (!changed) return part;
    return {
      ...part,
      geometry: { ...geometry, props },
    };
  });
}

/** Compact portrait scale hint for restrained UI chips (24/32). */
export function restrainedPortraitScale(sizePx: number): number {
  if (sizePx <= 24) return 0.42;
  if (sizePx <= 32) return 0.55;
  if (sizePx <= 48) return 0.72;
  return 1;
}
