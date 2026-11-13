import type { CharacterPart } from './blueprint';
import { sculptCharacterAnatomy } from './sculptedAnatomy';

/**
 * Pilot art direction for Lumi the rabbit. Three comparable variants share the
 * same pose, ids and theme so silhouette, personality and transferability can
 * be judged side by side. The selected variant becomes the shipped anatomy.
 */
export type RabbitArtVariantId = 'A' | 'B' | 'C';

export const SELECTED_RABBIT_ART_VARIANT: RabbitArtVariantId = 'B';

/** Graphic revision id — independent from blueprint schemaVersion. */
export const RABBIT_ARTWORK_REVISION = 'lumi.rabbit.art.b2' as const;

export type RabbitArtVariant = {
  readonly id: RabbitArtVariantId;
  readonly label: string;
  readonly summary: string;
  readonly parts: readonly CharacterPart[];
};

function cloneParts(parts: readonly CharacterPart[]): CharacterPart[] {
  return JSON.parse(JSON.stringify(parts)) as CharacterPart[];
}

function scaleEllipse(
  part: CharacterPart,
  axes: { rx?: number; ry?: number; cx?: number; cy?: number },
): void {
  if (part.geometry.kind !== 'ellipse') return;
  const props = part.geometry.props as Record<string, unknown>;
  if (axes.rx != null && typeof props.rx === 'number') props.rx = props.rx * axes.rx;
  if (axes.ry != null && typeof props.ry === 'number') props.ry = props.ry * axes.ry;
  if (axes.cx != null && typeof props.cx === 'number') props.cx = props.cx * axes.cx;
  if (axes.cy != null && typeof props.cy === 'number') props.cy = props.cy + axes.cy;
}

function setOpacity(part: CharacterPart, opacity: number): void {
  const props = part.geometry.props as Record<string, unknown>;
  props.opacity = opacity;
}

function setFill(part: CharacterPart, fill: string): void {
  const props = part.geometry.props as Record<string, unknown>;
  if ('fill' in props) props.fill = fill;
}

/**
 * A — gentle polish of the current anatomy: slightly longer ears, softer blush,
 * warmer head, unchanged overall silhouette.
 */
function buildVariantA(baseline: readonly CharacterPart[]): readonly CharacterPart[] {
  const parts = cloneParts(baseline);
  for (const part of parts) {
    if (part.id.startsWith('ear-') && part.id.includes('outer')) {
      scaleEllipse(part, { ry: 1.04, rx: 1.02 });
    }
    if (part.id.startsWith('ear-') && part.id.includes('inner')) {
      scaleEllipse(part, { ry: 1.03 });
    }
    if (part.id === 'head') setFill(part, '#F3E8DE');
    if (part.id.startsWith('cheek-')) setOpacity(part, 0.62);
    if (part.id === 'highlight') setOpacity(part, 0.7);
  }
  return parts;
}

/**
 * B — softer compact volumes with a clearer small-size silhouette. Shorter ears,
 * rounder head emphasis, calmer blush. Selected working direction for the pilot.
 */
function buildVariantB(baseline: readonly CharacterPart[]): readonly CharacterPart[] {
  const parts = cloneParts(baseline);
  for (const part of parts) {
    if (part.id.startsWith('ear-') && part.id.includes('outer')) {
      scaleEllipse(part, { ry: 0.86, rx: 1.06 });
    }
    if (part.id.startsWith('ear-') && part.id.includes('inner')) {
      scaleEllipse(part, { ry: 0.84, rx: 1.05 });
    }
    if (part.id === 'body') scaleEllipse(part, { rx: 0.96, ry: 0.94, cy: 2 });
    if (part.id === 'belly') scaleEllipse(part, { rx: 0.98, ry: 0.96 });
    if (part.id === 'head') {
      scaleEllipse(part, { rx: 1.03, ry: 1.05, cy: -1 });
      setFill(part, '#F4E9DF');
    }
    if (part.id.startsWith('cheek-')) {
      setOpacity(part, 0.78);
      scaleEllipse(part, { rx: 1.08, ry: 1.1 });
    }
    if (part.id === 'nose') {
      const props = part.geometry.props as Record<string, unknown>;
      if (typeof props.r === 'number') props.r = props.r * 1.08;
      setFill(part, '#B88884');
    }
    if (part.id === 'highlight') setOpacity(part, 0.55);
    if (part.id === 'seed-mark') {
      const props = part.geometry.props as Record<string, unknown>;
      props.transform = 'translate(0 88) scale(0.78)';
    }
  }
  return sculptCharacterAnatomy('rabbit', parts);
}

/**
 * C — leaner drawing with fewer competing planes: quieter cheeks and highlight,
 * slightly flatter body, reserved seed mark so the face carries the silhouette.
 */
function buildVariantC(baseline: readonly CharacterPart[]): readonly CharacterPart[] {
  const parts = cloneParts(baseline).filter((part) => part.id !== 'highlight');
  for (const part of parts) {
    if (part.id.startsWith('ear-') && part.id.includes('outer')) {
      scaleEllipse(part, { ry: 0.92, rx: 0.96 });
    }
    if (part.id === 'body') scaleEllipse(part, { rx: 0.94, ry: 0.92 });
    if (part.id === 'belly') setOpacity(part, 0.92);
    if (part.id.startsWith('cheek-')) setOpacity(part, 0.38);
    if (part.id === 'seed-mark') {
      const props = part.geometry.props as Record<string, unknown>;
      props.opacity = 0.55;
      props.transform = 'translate(0 91) scale(0.7)';
    }
    if (part.id === 'head') setFill(part, '#EFE4D9');
  }
  // Keep painter orders contiguous after dropping highlight.
  return parts.map((part, index) => (part.order === index ? part : { ...part, order: index }));
}

export function buildRabbitArtVariants(
  baseline: readonly CharacterPart[],
): readonly RabbitArtVariant[] {
  return [
    {
      id: 'A',
      label: 'Jemný polish',
      summary: 'Doladění současné anatomie: delší uši, teplejší hlava, klidnější tváře.',
      parts: buildVariantA(baseline),
    },
    {
      id: 'B',
      label: 'Měkký kompakt',
      summary:
        'Měkce modelované objemy, jemná srst a záhyby uší; čitelná silueta v 48 px i větší výjev.',
      parts: buildVariantB(baseline),
    },
    {
      id: 'C',
      label: 'Střídmá kresba',
      summary: 'Méně ploch a tišší detaily; osobnost nese obličej a silueta uší.',
      parts: buildVariantC(baseline),
    },
  ];
}

export function selectRabbitAnatomy(baseline: readonly CharacterPart[]): readonly CharacterPart[] {
  const variants = buildRabbitArtVariants(baseline);
  const selected = variants.find((variant) => variant.id === SELECTED_RABBIT_ART_VARIANT);
  if (!selected) {
    throw new RangeError(`Missing rabbit art variant ${SELECTED_RABBIT_ART_VARIANT}`);
  }
  return selected.parts;
}

export const RABBIT_ART_DIRECTION_NOTES = {
  selected: SELECTED_RABBIT_ART_VARIANT,
  artworkRevision: RABBIT_ARTWORK_REVISION,
  why: [
    'Small-size silhouette stays readable with shorter, wider ears.',
    'Softer compact volumes transfer to other species without cloning the rabbit.',
    'Calm face (no sad error pose) and room for UI beside the character.',
    'Sculpted curves and restrained material details belong to their anatomical part.',
  ],
  handoffForNextSpecies: [
    'Reuse eye/mouth recipes, shared light direction and matte fills.',
    'Keep ear/head/paw pivots semantic; change silhouette, not the rig contract.',
    'Static resting drawing must remain complete without motion.',
  ],
} as const;
