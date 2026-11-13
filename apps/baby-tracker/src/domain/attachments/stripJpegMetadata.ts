/**
 * Removes APP1/APP2 (EXIF/XMP/ICC) and COM segments from a JPEG bitstream while
 * preserving SOF/SOS image data. Used after re-encode and for synthetic canaries.
 */
export function stripJpegMetadata(input: Uint8Array): Uint8Array {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) {
    throw new Error('Not a JPEG bitstream');
  }

  const out: number[] = [0xff, 0xd8];
  let offset = 2;
  while (offset + 3 < input.length) {
    if (input[offset] !== 0xff) {
      // Entropy-coded data or malformed segment — copy the remainder.
      for (let i = offset; i < input.length; i += 1) out.push(input[i]!);
      break;
    }
    const marker = input[offset + 1]!;
    if (marker === 0xd9) {
      out.push(0xff, 0xd9);
      break;
    }
    if (marker === 0xda) {
      // Start of scan — copy through end.
      for (let i = offset; i < input.length; i += 1) out.push(input[i]!);
      break;
    }
    // Standalone markers without length.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(0xff, marker);
      offset += 2;
      continue;
    }
    if (offset + 3 >= input.length) break;
    const length = (input[offset + 2]! << 8) | input[offset + 3]!;
    const next = offset + 2 + length;
    if (next > input.length) {
      throw new Error('Truncated JPEG segment');
    }
    const drop =
      marker === 0xe1 || // APP1 EXIF/XMP
      marker === 0xe2 || // APP2
      marker === 0xfe; // COM
    if (!drop) {
      for (let i = offset; i < next; i += 1) out.push(input[i]!);
    }
    offset = next;
  }
  return Uint8Array.from(out);
}

/** Minimal valid grayscale JPEG used by metadata/canary tests. */
export function buildMinimalJpeg(
  options: { withExifGps?: boolean; comment?: string } = {},
): Uint8Array {
  const soi = [0xff, 0xd8];
  const app0 = [
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01,
    0x00, 0x00,
  ];
  const segments: number[] = [...soi, ...app0];
  if (options.withExifGps) {
    // Synthetic APP1 with a GPS canary string — stripJpegMetadata must remove it.
    const payload = utf8Bytes('Exif\0\0GPS:CANARY-50.0875N');
    const length = payload.length + 2;
    segments.push(0xff, 0xe1, (length >> 8) & 0xff, length & 0xff, ...payload);
  }
  if (options.comment) {
    const payload = utf8Bytes(options.comment);
    const length = payload.length + 2;
    segments.push(0xff, 0xfe, (length >> 8) & 0xff, length & 0xff, ...payload);
  }
  // Tiny SOF0 + empty SOS + EOI — enough for structural tests, not decoding.
  segments.push(
    0xff,
    0xc0,
    0x00,
    0x0b,
    0x08,
    0x00,
    0x01,
    0x00,
    0x01,
    0x01,
    0x01,
    0x11,
    0x00,
    0xff,
    0xda,
    0x00,
    0x08,
    0x01,
    0x01,
    0x00,
    0x00,
    0x3f,
    0x00,
    0x7f,
    0xff,
    0xd9,
  );
  return Uint8Array.from(segments);
}

function utf8Bytes(value: string): number[] {
  return Array.from(new TextEncoder().encode(value));
}

export function jpegContainsAsciiCanary(bytes: Uint8Array, canary: string): boolean {
  const haystack = new TextDecoder('latin1').decode(bytes);
  return haystack.includes(canary);
}
