import React, { useState } from 'react';
import { View } from 'react-native';
import { LumiButton, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import {
  ATTACHMENT_LIMITS,
  attachmentHasDownloadWork,
  attachmentHasDurableRole,
  localAvailabilityLabel,
  presentOfflinePinReadiness,
  presentPhotoParentStatus,
  type AttachmentServices,
  type FamilyPhotoBlobTransferJob,
  type FamilyPhotoTransferLabel,
  type PhotoAttachment,
  type PickedPhotoCandidate,
} from '../../domain/attachments';
import { attachPhotosToSavedEvent } from '../../application/attachPhotos';
import type { ChildId, EntityId } from '../../domain';

export type PhotoAttachmentsFieldProps = {
  childId: ChildId;
  /** Null until the host note/milestone/experience is locally committed. */
  eventId: EntityId | null;
  hostEventType: 'note' | 'milestone' | 'experience';
  services: AttachmentServices | null;
  createId: (prefix: string) => string;
  nowMs: () => number;
  attachments: PhotoAttachment[];
  onChange: (next: PhotoAttachment[]) => void;
  /** Keeps pending picks so text can save first, then photos attach. */
  pendingCandidates: PickedPhotoCandidate[];
  onPendingCandidatesChange: (next: PickedPhotoCandidate[]) => void;
  /**
   * Optional family transfer label per attachment. Personal mode omits this and
   * keeps the local-only wording.
   */
  transferLabelFor?: (attachment: PhotoAttachment) => FamilyPhotoTransferLabel | null;
  /** Called after local photos are confirmed so family uploads can enqueue. */
  onLocalAttachmentsCommitted?: (attachments: PhotoAttachment[]) => void;
  /** Show keep-offline controls (family sync). Personal installs can omit. */
  enableOfflinePin?: boolean;
  transferJobs?: readonly FamilyPhotoBlobTransferJob[];
  onToggleOfflinePin?: (attachment: PhotoAttachment, pinned: boolean) => Promise<void> | void;
};

/**
 * Optional photos for notes, milestones and experiences. The care text can save
 * even when picker/normalize fails; parents see preparing vs local states.
 */
export function PhotoAttachmentsField({
  childId,
  eventId,
  hostEventType,
  services,
  createId,
  nowMs,
  attachments,
  onChange,
  pendingCandidates,
  onPendingCandidatesChange,
  transferLabelFor,
  onLocalAttachmentsCommitted,
  enableOfflinePin = false,
  transferJobs = [],
  onToggleOfflinePin,
}: PhotoAttachmentsFieldProps) {
  const { ui } = useLumiTheme();
  const [busy, setBusy] = useState(false);
  const [pinBusyId, setPinBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const remaining = ATTACHMENT_LIMITS.maxPerEvent - attachments.length - pendingCandidates.length;

  async function pickMore() {
    if (!services || remaining <= 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await services.picker.pickPhotos({ remainingSlots: remaining });
      if (result.status === 'cancelled') return;
      if (result.status === 'unavailable') {
        setMessage(result.message);
        return;
      }
      const nextPending = [...pendingCandidates, ...result.candidates].slice(
        0,
        ATTACHMENT_LIMITS.maxPerEvent - attachments.length,
      );
      onPendingCandidatesChange(nextPending);
      if (eventId) {
        const imported = await attachPhotosToSavedEvent(services, {
          childId,
          eventId,
          hostEventType,
          candidates: nextPending,
          nowMs: nowMs(),
          createId,
        });
        const nextAttachments = [...attachments, ...imported.attached];
        onChange(nextAttachments);
        onPendingCandidatesChange([]);
        if (imported.attached.length > 0) {
          onLocalAttachmentsCommitted?.(imported.attached);
        }
        if (imported.failed.length > 0) {
          setMessage(
            `Záznam je uložený. ${imported.failed.length} fotografií se nepodařilo připravit.`,
          );
        }
      } else {
        setMessage('Fotografie se připojí po uložení záznamu.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: ui.space.sm }}>
      <LumiText variant="label">Fotografie (volitelné, nejvýše 6)</LumiText>
      <LumiText variant="caption" tone="muted">
        Uložíme menší kopii. Originál ve vašich Fotkách zůstane.
      </LumiText>
      {attachments.map((attachment) => {
        const localLabel = localAvailabilityLabel({
          importState: 'linked',
          hasDurableDisplay: attachment.renditions.some(
            (item) => item.role === 'display' && item.availability === 'durable',
          ),
        });
        const status = presentPhotoParentStatus({
          localLabel,
          transferLabel: transferLabelFor?.(attachment) ?? null,
        });
        const pinReadiness = presentOfflinePinReadiness({
          offlinePinned: attachment.offlinePinned === true,
          hasDurableDisplay: attachmentHasDurableRole(attachment),
          downloadInFlightOrQueued: attachmentHasDownloadWork(
            attachment.attachmentId,
            transferJobs,
          ),
        });
        return (
          <View key={attachment.attachmentId} style={{ gap: ui.space.xs }}>
            <LumiText variant="body">
              {status}
              {attachment.caption ? ` — ${attachment.caption}` : ''}
            </LumiText>
            {enableOfflinePin ? (
              <View style={{ gap: ui.space.xs }}>
                <LumiButton
                  title={
                    attachment.offlinePinned
                      ? 'Zrušit uchování offline'
                      : 'Uchovat offline'
                  }
                  variant="secondary"
                  disabled={busy || pinBusyId === attachment.attachmentId || !onToggleOfflinePin}
                  onPress={() => {
                    if (!onToggleOfflinePin) return;
                    setPinBusyId(attachment.attachmentId);
                    void Promise.resolve(
                      onToggleOfflinePin(attachment, !attachment.offlinePinned),
                    )
                      .catch(() => {
                        setMessage('Uchování offline se nepodařilo změnit.');
                      })
                      .finally(() => setPinBusyId(null));
                  }}
                />
                {pinReadiness.label ? (
                  <LumiText variant="caption" tone="muted">
                    {pinReadiness.label}
                  </LumiText>
                ) : (
                  <LumiText variant="caption" tone="muted">
                    Přepínač sám nestačí — offline je hotové až po ověřené kopii v zařízení.
                  </LumiText>
                )}
              </View>
            ) : null}
          </View>
        );
      })}
      {pendingCandidates.map((candidate, index) => (
        <LumiText key={`${candidate.sourceUri}-${index}`} variant="body">
          Záznam uložený — fotka se připravuje
        </LumiText>
      ))}
      <LumiButton
        title={busy ? 'Připravuji…' : remaining > 0 ? 'Přidat fotky' : 'Maximum 6 fotek'}
        onPress={() => {
          void pickMore();
        }}
        disabled={busy || !services || remaining <= 0}
        variant="secondary"
      />
      {message ? (
        <LumiText variant="caption" tone="muted">
          {message}
        </LumiText>
      ) : null}
    </View>
  );
}
