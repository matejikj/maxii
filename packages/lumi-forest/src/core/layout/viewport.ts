/** Pure counterpart of SVG preserveAspectRatio, for cross-device tests and QA. */
export type AspectMode = 'cover' | 'contain' | 'auto';
export type ResolvedAspectMode = Exclude<AspectMode, 'auto'>;
export interface ViewportSize { readonly width: number; readonly height: number }
export interface ViewportLayout {
  readonly mode: ResolvedAspectMode;
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  /** Visible fraction of the original document, with layout matching xMidYMax. */
  readonly visible: Readonly<{ x: number; y: number; width: number; height: number }>;
}

/** Wide aspect ratios avoid cropping the character; portrait phones use immersive cover. */
export function resolveAspectMode(viewport: ViewportSize, mode: AspectMode = 'auto'): ResolvedAspectMode {
  validateSize(viewport, 'viewport');
  return mode === 'auto' ? (viewport.width / viewport.height > 0.62 ? 'contain' : 'cover') : mode;
}

export function computeViewportLayout(
  document: ViewportSize,
  viewport: ViewportSize,
  mode: AspectMode = 'auto',
): ViewportLayout {
  validateSize(document, 'document');
  validateSize(viewport, 'viewport');
  const resolved = resolveAspectMode(viewport, mode);
  const sx = viewport.width / document.width;
  const sy = viewport.height / document.height;
  const scale = resolved === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy);
  const offsetX = (viewport.width - document.width * scale) / 2;
  const offsetY = viewport.height - document.height * scale;
  const visibleLeft = Math.max(0, -offsetX / scale);
  const visibleTop = Math.max(0, -offsetY / scale);
  const visibleRight = Math.min(document.width, (viewport.width - offsetX) / scale);
  const visibleBottom = Math.min(document.height, (viewport.height - offsetY) / scale);
  return {
    mode: resolved, scale, offsetX, offsetY,
    visible: { x: visibleLeft, y: visibleTop,
      width: Math.max(0, visibleRight - visibleLeft), height: Math.max(0, visibleBottom - visibleTop) },
  };
}

function validateSize(size: ViewportSize, label: string): void {
  if (!Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width <= 0 || size.height <= 0) {
    throw new RangeError(`Invalid ${label} dimensions`);
  }
}

export const LUMI_VIEWPORT_FIXTURES = {
  smallPhone: { width: 320, height: 568 },
  referencePhone: { width: 390, height: 844 },
  largePhone: { width: 430, height: 932 },
  portraitTablet: { width: 768, height: 1024 },
  landscapeTablet: { width: 1024, height: 768 },
  narrowLandscape: { width: 844, height: 390 },
} as const;
