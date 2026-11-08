/**
 * Stable non-crypto fingerprint for migration SQL. Used to detect accidental
 * edits to an already-shipped migration body, not as a security boundary.
 */
export function createHash(source: string): string {
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
