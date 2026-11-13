import type { Rect, SafeZone } from './types';
import type { ViewportSize } from '../layout/viewport';

export const rectRight = (r: Rect): number => r.x + r.width;
export const rectBottom = (r: Rect): number => r.y + r.height;
export const inflate = (r: Rect, amount: number): Rect => ({
  x: r.x - amount,
  y: r.y - amount,
  width: r.width + amount * 2,
  height: r.height + amount * 2,
});
export function intersect(a: Rect, b: Rect): boolean {
  return a.x < rectRight(b) && rectRight(a) > b.x && a.y < rectBottom(b) && rectBottom(a) > b.y;
}
export const contains = (outer: Rect, r: Rect): boolean =>
  r.x >= outer.x &&
  r.y >= outer.y &&
  rectRight(r) <= rectRight(outer) &&
  rectBottom(r) <= rectBottom(outer);
const finite = (n: number): boolean => Number.isFinite(n);

export function validateViewport(v: ViewportSize): void {
  if (
    ![v.width, v.height].every(finite) ||
    v.width < 240 ||
    v.height < 240 ||
    v.width > 4096 ||
    v.height > 4096 ||
    v.width / v.height > 5 ||
    v.height / v.width > 5
  ) {
    throw new RangeError(
      'Procedural viewport must be finite, 240..4096dp, and have a supported aspect ratio',
    );
  }
}

/** Clip zones to viewport, reject invalid inputs. Allow partially offscreen overlays. */
export function normalizeSafeZones(
  zones: readonly SafeZone[],
  viewport: ViewportSize,
): readonly Rect[] {
  if (zones.length > 32) throw new RangeError('Maximum 32 safe zones');
  return zones
    .map((z) => {
      const padding = z.padding ?? 8;
      if (
        !z.id ||
        z.id.length > 64 ||
        ![z.x, z.y, z.width, z.height, padding].every(finite) ||
        z.width <= 0 ||
        z.height <= 0 ||
        padding < 0 ||
        padding > 100
      ) {
        throw new RangeError(`Invalid safe zone`);
      }
      const padded = inflate(z, padding);
      const x = Math.max(0, padded.x);
      const y = Math.max(0, padded.y);
      const right = Math.min(viewport.width, rectRight(padded));
      const bottom = Math.min(viewport.height, rectBottom(padded));
      return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
    })
    .filter((z) => z.width > 0 && z.height > 0);
}

/** Bounded spatial hash avoids O(N²) comparisons for larger scenes. */
export class OccupancyGrid {
  private readonly cells = new Map<string, number[]>();
  private readonly occupied: Rect[] = [];
  constructor(
    private readonly viewport: ViewportSize,
    private readonly cellSize = 80,
  ) {
    validateViewport(viewport);
    if (!Number.isFinite(cellSize) || cellSize < 8 || cellSize > 512) {
      throw new RangeError('Occupancy cell size must be finite and within 8..512 dp');
    }
  }
  private keys(r: Rect): string[] {
    const left = Math.floor(r.x / this.cellSize),
      top = Math.floor(r.y / this.cellSize);
    const right = Math.floor((rectRight(r) - 1e-7) / this.cellSize);
    const bottom = Math.floor((rectBottom(r) - 1e-7) / this.cellSize);
    const keys: string[] = [];
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) keys.push(`${x}:${y}`);
    return keys;
  }
  canPlace(r: Rect): boolean {
    if (!contains({ x: 0, y: 0, ...this.viewport }, r)) return false;
    const seen = new Set<number>();
    for (const key of this.keys(r))
      for (const i of this.cells.get(key) ?? []) {
        if (!seen.has(i)) {
          seen.add(i);
          if (intersect(r, this.occupied[i]!)) return false;
        }
      }
    return true;
  }
  /** Reserve mandatory exclusions even when multiple UI regions overlap each other. */
  block(r: Rect): void {
    if (
      ![r.x, r.y, r.width, r.height].every(Number.isFinite) ||
      r.width <= 0 ||
      r.height <= 0 ||
      !contains({ x: 0, y: 0, ...this.viewport }, r)
    ) {
      throw new RangeError('Blocked rectangle must be finite, positive and inside viewport');
    }
    const id = this.occupied.push(r) - 1;
    for (const key of this.keys(r)) {
      const indices = this.cells.get(key) ?? [];
      indices.push(id);
      this.cells.set(key, indices);
    }
  }
  reserve(r: Rect): boolean {
    if (!this.canPlace(r)) return false;
    this.block(r);
    return true;
  }
}
