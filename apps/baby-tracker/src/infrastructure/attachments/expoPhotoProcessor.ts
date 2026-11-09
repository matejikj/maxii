import { Platform } from 'react-native';
import {
  createPhotoNormalizeProcessor,
  type ManipulatedImage,
  type PhotoManipulateFn,
  type TempJpegHandle,
} from './photoNormalizeCodec';

export type { ManipulatedImage, PhotoManipulateFn, TempJpegHandle };

async function cleanupUri(uri: string): Promise<void> {
  if (uri.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(uri);
    } catch {
      // Ignore revoke failures — the page unload still drops blob URLs.
    }
    return;
  }
  if (!uri.startsWith('file:')) return;
  try {
    const FileSystem = await import('expo-file-system/legacy');
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Temp cleanup is best-effort; durable store never keeps picker URIs.
  }
}

async function writeTempJpeg(bytes: Uint8Array): Promise<TempJpegHandle> {
  if (Platform.OS === 'web' && typeof URL !== 'undefined' && typeof Blob !== 'undefined') {
    const copy = new Uint8Array(bytes);
    const blob = new Blob([copy], { type: 'image/jpeg' });
    const uri = URL.createObjectURL(blob);
    return {
      uri,
      cleanup: async () => {
        URL.revokeObjectURL(uri);
      },
    };
  }
  const FileSystem = await import('expo-file-system/legacy');
  const root = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!root) throw new Error('No writable cache directory for photo normalization');
  const uri = `${root}lumi-photo-normalize-${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`;
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  const btoaFn = (globalThis as { btoa?: (value: string) => string }).btoa;
  if (typeof btoaFn !== 'function') {
    throw new Error('No base64 encoder available for photo temp files');
  }
  const base64 = btoaFn(binary);
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return {
    uri,
    cleanup: async () => {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    },
  };
}

async function defaultManipulate(
  uri: string,
  actions: Array<{ resize: { width: number; height: number } }>,
  options: { compress: number; format: 'jpeg'; base64: true },
): Promise<ManipulatedImage> {
  const ImageManipulator = await import('expo-image-manipulator');
  return ImageManipulator.manipulateAsync(uri, actions, {
    compress: options.compress,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
}

/**
 * Runtime photo processor: decode with ImageManipulator, re-encode JPEG under
 * diary limits, then strip APP1/COM leftovers. HEIC is accepted only where the
 * platform decoder is known to work offline (iOS).
 */
export function createExpoPhotoProcessor(input?: {
  manipulate?: PhotoManipulateFn;
  allowHeic?: boolean;
}) {
  return createPhotoNormalizeProcessor({
    manipulate: input?.manipulate ?? defaultManipulate,
    writeTempJpeg,
    cleanupUri,
    allowHeic: input?.allowHeic ?? Platform.OS === 'ios',
  });
}
