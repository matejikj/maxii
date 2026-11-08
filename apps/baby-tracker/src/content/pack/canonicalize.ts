/**
 * RFC 8785 JSON Canonicalization Scheme for deterministic Ed25519 payloads.
 * Sorts object keys by UTF-16 code units and emits compact JSON.
 */
export function canonicalizeJson(value: unknown, depth = 0, maxDepth = 16): string {
  if (depth > maxDepth) {
    throw new RangeError('JSON depth exceeds content pack limit');
  }
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new RangeError('Non-finite numbers are not allowed in JCS');
    }
    // Match JSON.stringify for finite numbers (no -0 distinction beyond JSON).
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item, depth + 1, maxDepth)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const parts: string[] = [];
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
      parts.push(`${JSON.stringify(key)}:${canonicalizeJson(record[key], depth + 1, maxDepth)}`);
    }
    return `{${parts.join(',')}}`;
  }
  throw new TypeError(`Unsupported JCS value type: ${typeof value}`);
}

export function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}
