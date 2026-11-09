import { AppError } from '../errors';
import {
  ATTACHMENT_CONDITIONAL_INPUT_MIME,
  ATTACHMENT_LIMITS,
  ATTACHMENT_SUPPORTED_INPUT_MIME,
  type AttachmentSupportedInputMime,
} from './limits';
import type { PickedPhotoCandidate } from './types';

export type PhotoInputDecision =
  | { ok: true; mime: AttachmentSupportedInputMime }
  | { ok: false; code: string; message: string };

function normalizeMime(raw: string): string {
  return raw.trim().toLowerCase().split(';')[0] ?? '';
}

export function evaluatePhotoInput(
  candidate: PickedPhotoCandidate,
  options: { allowHeic?: boolean } = {},
): PhotoInputDecision {
  const mime = normalizeMime(candidate.mime);
  if (!mime) {
    return {
      ok: false,
      code: 'photo_mime_missing',
      message: 'Soubor nemá rozpoznatelný typ obrázku.',
    };
  }

  const supported = (ATTACHMENT_SUPPORTED_INPUT_MIME as readonly string[]).includes(mime);
  const conditional = (ATTACHMENT_CONDITIONAL_INPUT_MIME as readonly string[]).includes(mime);
  if (!supported && !(conditional && options.allowHeic)) {
    return {
      ok: false,
      code: 'photo_mime_unsupported',
      message: 'Tento formát fotografie aplikace neumí zpracovat bez sítě.',
    };
  }

  if (candidate.byteLength <= 0) {
    return {
      ok: false,
      code: 'photo_empty',
      message: 'Vybraný soubor je prázdný.',
    };
  }
  if (candidate.byteLength > ATTACHMENT_LIMITS.maxSourceBytes) {
    return {
      ok: false,
      code: 'photo_too_large',
      message: 'Fotografie je větší než povolených 30 MiB.',
    };
  }

  if (candidate.width != null && candidate.height != null) {
    if (candidate.width <= 0 || candidate.height <= 0) {
      return {
        ok: false,
        code: 'photo_dimensions_invalid',
        message: 'Rozměry fotografie jsou neplatné.',
      };
    }
    if (
      candidate.width > ATTACHMENT_LIMITS.maxSourceEdgePx ||
      candidate.height > ATTACHMENT_LIMITS.maxSourceEdgePx
    ) {
      return {
        ok: false,
        code: 'photo_edge_too_large',
        message: 'Jedna strana fotografie překračuje 16 384 px.',
      };
    }
    const megapixels = (candidate.width * candidate.height) / 1_000_000;
    if (megapixels > ATTACHMENT_LIMITS.maxSourceMegapixels) {
      return {
        ok: false,
        code: 'photo_megapixels_too_large',
        message: 'Fotografie překračuje 64 megapixelů.',
      };
    }
  }

  return { ok: true, mime: mime as AttachmentSupportedInputMime };
}

export function assertRemainingPhotoSlots(existingCount: number, incomingCount: number): void {
  if (existingCount < 0 || incomingCount < 0) {
    throw new AppError('VALIDATION', 'Photo counts cannot be negative', {
      details: { reason: 'photo_count_negative' },
    });
  }
  if (existingCount >= ATTACHMENT_LIMITS.maxPerEvent) {
    throw new AppError('VALIDATION', 'This entry already has the maximum of six photos', {
      details: { reason: 'photo_slots_full', existingCount },
    });
  }
  if (existingCount + incomingCount > ATTACHMENT_LIMITS.maxPerEvent) {
    throw new AppError('VALIDATION', 'Only six photos are allowed on one entry', {
      details: {
        reason: 'photo_slots_exceeded',
        existingCount,
        incomingCount,
        remaining: ATTACHMENT_LIMITS.maxPerEvent - existingCount,
      },
    });
  }
}

export function sanitizePhotoCaption(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > ATTACHMENT_LIMITS.captionMaxChars) {
    throw new AppError('VALIDATION', 'Photo caption is longer than 160 characters', {
      details: { reason: 'photo_caption_too_long', length: trimmed.length },
    });
  }
  return trimmed;
}

export function localAvailabilityLabel(input: {
  importState: string | null;
  hasDurableDisplay: boolean;
}): 'preparing' | 'local' | 'missing' | 'failed' {
  if (input.importState === 'failed') return 'failed';
  if (input.hasDurableDisplay) return 'local';
  if (
    input.importState === 'selected' ||
    input.importState === 'normalizing' ||
    input.importState === 'writing'
  ) {
    return 'preparing';
  }
  return 'missing';
}
