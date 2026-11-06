/** FNV-1a + xorshift32: deterministic visuals only (not cryptographically secure). */
export function seededRandom(seed: string): () => number {
  let state = 2166136261;
  // Upper bound guards rendering cost from unexpectedly large external input.
  for (let i = 0, end = Math.min(seed.length, 256); i < end; i++) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  // Avoid absorbing xorshift's zero state.
  if (state === 0) state = 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}
