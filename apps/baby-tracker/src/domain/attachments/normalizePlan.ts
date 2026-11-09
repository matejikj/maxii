import { ATTACHMENT_LIMITS } from './limits';

export type NormalizeAttempt = {
  maxEdgePx: number;
  jpegQuality: number;
};

/**
 * Ordered attempts that keep diary copies under 3 MiB without upscaling smaller
 * inputs. Quality numbers are encoder hints, not guaranteed byte counts.
 */
export function buildNormalizeAttempts(sourceMaxEdge: number): NormalizeAttempt[] {
  const cappedEdge = Math.min(sourceMaxEdge, ATTACHMENT_LIMITS.displayMaxEdgePx);
  const attempts: NormalizeAttempt[] = [
    { maxEdgePx: cappedEdge, jpegQuality: 0.82 },
    { maxEdgePx: cappedEdge, jpegQuality: 0.72 },
  ];
  if (cappedEdge > 1_600) {
    attempts.push({ maxEdgePx: 1_600, jpegQuality: 0.72 });
  }
  if (cappedEdge > 1_280) {
    attempts.push({ maxEdgePx: 1_280, jpegQuality: 0.72 });
  }
  return attempts.slice(0, 4);
}

export function buildThumbnailAttempts(sourceMaxEdge: number): NormalizeAttempt[] {
  const cappedEdge = Math.min(sourceMaxEdge, ATTACHMENT_LIMITS.thumbnailMaxEdgePx);
  const attempts: NormalizeAttempt[] = [{ maxEdgePx: cappedEdge, jpegQuality: 0.7 }];
  if (cappedEdge > 320) {
    attempts.push({ maxEdgePx: 320, jpegQuality: 0.65 });
  }
  return attempts;
}

export function scaledSize(
  width: number,
  height: number,
  maxEdgePx: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdgePx) return { width, height };
  const scale = maxEdgePx / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
