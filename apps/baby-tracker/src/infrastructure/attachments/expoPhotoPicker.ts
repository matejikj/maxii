import { Platform } from 'react-native';
import type { PhotoPicker, PhotoPickerResult } from '../../domain/attachments';
import { ATTACHMENT_LIMITS } from '../../domain/attachments';

/**
 * System library picker. Microphone and camera permissions stay disabled for
 * the first local release — only selected photo files are requested.
 */
export function createExpoPhotoPicker(): PhotoPicker {
  return {
    async pickPhotos({ remainingSlots }): Promise<PhotoPickerResult> {
      if (remainingSlots <= 0) {
        return {
          status: 'unavailable',
          message: 'U tohoto záznamu už je maximálně šest fotografií.',
        };
      }
      if (Platform.OS === 'web') {
        // Web uses the document/file input path separately; keep API honest.
        return {
          status: 'unavailable',
          message: 'Výběr fotografií na webu zatím není v této sestavě zapnutý.',
        };
      }
      try {
        const ImagePicker = await import('expo-image-picker');
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          return {
            status: 'unavailable',
            message: 'Bez přístupu k vybraným fotografiím nelze nic přidat.',
          };
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          selectionLimit: Math.min(remainingSlots, ATTACHMENT_LIMITS.maxPerEvent),
          exif: false,
          quality: 1,
          // Explicitly avoid microphone/camera entry points in this release.
          preferredAssetRepresentationMode:
            ImagePicker.UIImagePickerPreferredAssetRepresentationMode?.Compatible,
        });
        if (result.canceled) return { status: 'cancelled' };
        return {
          status: 'picked',
          candidates: result.assets.map((asset) => ({
            sourceUri: asset.uri,
            mime: asset.mimeType ?? 'image/jpeg',
            byteLength: asset.fileSize ?? 0,
            width: asset.width ?? null,
            height: asset.height ?? null,
            fileName: asset.fileName ?? null,
          })),
        };
      } catch {
        return {
          status: 'unavailable',
          message: 'Systémový výběr fotografií se nepodařilo otevřít.',
        };
      }
    },
  };
}
