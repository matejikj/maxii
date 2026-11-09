import {
  ATTACHMENT_LIMITS,
  assertRemainingPhotoSlots,
  asAttachmentId,
  asAttachmentJobId,
  asRenditionId,
  evaluatePhotoInput,
  jpegContainsAsciiCanary,
  sanitizePhotoCaption,
  type AttachmentServices,
  type AttachPhotosInput,
  type AttachPhotosResult,
  type PhotoAttachment,
} from '../domain/attachments';
import type { ActorId } from '../domain';

/**
 * Import picked photos after the host care event has already been saved.
 * Text commits are independent: a photo failure never rolls back the note.
 */
export async function attachPhotosToSavedEvent(
  services: AttachmentServices,
  input: AttachPhotosInput & { recordedBy?: ActorId | null },
): Promise<AttachPhotosResult> {
  const existing = await services.repository.listForEvent(input.eventId);
  assertRemainingPhotoSlots(existing.length, input.candidates.length);

  const attached: PhotoAttachment[] = [];
  const failed: AttachPhotosResult['failed'] = [];
  let nextOrder = existing.length;

  for (const [index, candidate] of input.candidates.entries()) {
    const attachmentId = asAttachmentId(input.createId('att'));
    const jobId = asAttachmentJobId(input.createId('attjob'));
    const decision = evaluatePhotoInput(candidate);
    if (!decision.ok) {
      failed.push({ index, code: decision.code, message: decision.message });
      continue;
    }

    await services.repository.saveJob({
      jobId,
      attachmentId,
      childId: input.childId,
      eventId: input.eventId,
      state: 'normalizing',
      errorCode: null,
      sourceMime: decision.mime,
      createdAtMs: input.nowMs,
      updatedAtMs: input.nowMs,
    });

    try {
      const display = await services.processor.normalizeDisplay(candidate);
      if (
        jpegContainsAsciiCanary(display.bytes, 'GPS:') ||
        jpegContainsAsciiCanary(display.bytes, 'Exif')
      ) {
        throw new Error('photo_metadata_retained');
      }
      if (display.byteLength > ATTACHMENT_LIMITS.displayMaxBytes) {
        throw new Error('photo_display_too_large');
      }

      await services.repository.saveJob({
        jobId,
        attachmentId,
        childId: input.childId,
        eventId: input.eventId,
        state: 'writing',
        errorCode: null,
        sourceMime: decision.mime,
        createdAtMs: input.nowMs,
        updatedAtMs: input.nowMs,
      });

      const thumbnail = await services.processor.normalizeThumbnail(display);
      const displayKey = `att/${attachmentId}/display.jpe.sealed`;
      const thumbKey = `att/${attachmentId}/thumb.jpe.sealed`;
      await services.blobs.writeDurable({
        blobKey: displayKey,
        bytes: display.bytes,
        aad: displayKey,
      });
      await services.blobs.writeDurable({
        blobKey: thumbKey,
        bytes: thumbnail.bytes,
        aad: thumbKey,
      });

      let caption: string | null = null;
      try {
        caption = sanitizePhotoCaption(input.captions?.[index] ?? null);
      } catch (error) {
        await services.blobs.deleteDurable(displayKey);
        await services.blobs.deleteDurable(thumbKey);
        throw error;
      }

      const attachment: PhotoAttachment = {
        attachmentId,
        childId: input.childId,
        eventId: input.eventId,
        hostEventType: input.hostEventType,
        orderIndex: nextOrder,
        caption,
        recordedBy: input.recordedBy ?? null,
        createdAtMs: input.nowMs,
        deletedAtMs: null,
        retainUntilMs: null,
        // Own imports stay durable without an explicit keep-offline pin.
        offlinePinned: false,
        localOrigin: 'imported',
        renditions: [
          {
            renditionId: asRenditionId(input.createId('rend')),
            attachmentId,
            role: 'display',
            mime: 'image/jpeg',
            width: display.width,
            height: display.height,
            byteLength: display.bytes.byteLength,
            sha256: display.sha256,
            normalizationVersion: ATTACHMENT_LIMITS.normalizationVersion,
            blobKey: displayKey,
            availability: 'durable',
          },
          {
            renditionId: asRenditionId(input.createId('rend')),
            attachmentId,
            role: 'thumbnail',
            mime: 'image/jpeg',
            width: thumbnail.width,
            height: thumbnail.height,
            byteLength: thumbnail.bytes.byteLength,
            sha256: thumbnail.sha256,
            normalizationVersion: ATTACHMENT_LIMITS.normalizationVersion,
            blobKey: thumbKey,
            availability: 'durable',
          },
        ],
      };

      await services.repository.save(attachment);
      await services.repository.saveJob({
        jobId,
        attachmentId,
        childId: input.childId,
        eventId: input.eventId,
        state: 'linked',
        errorCode: null,
        sourceMime: decision.mime,
        createdAtMs: input.nowMs,
        updatedAtMs: input.nowMs,
      });
      attached.push(attachment);
      nextOrder += 1;
    } catch (error) {
      const code =
        error instanceof Error && error.message.startsWith('photo_')
          ? error.message
          : 'photo_import_failed';
      const message =
        error instanceof Error ? error.message : 'Photograph could not be saved locally';
      await services.repository.saveJob({
        jobId,
        attachmentId,
        childId: input.childId,
        eventId: input.eventId,
        state: 'failed',
        errorCode: code,
        sourceMime: decision.mime,
        createdAtMs: input.nowMs,
        updatedAtMs: input.nowMs,
      });
      failed.push({ index, code, message });
    }
  }

  return { attached, failed };
}
