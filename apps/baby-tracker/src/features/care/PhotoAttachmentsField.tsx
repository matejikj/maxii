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
import { guardPhotoImportSpace } from '../../application/guardPhotoImportSpace';
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
  /**
   * Soft-delete a saved photo into trash. Pending picks are dropped locally
   * without trash. Personal mode never needs a backend for remove/undo.
   */
  onSoftDeleteAttachment?: (attachment: PhotoAttachment) => Promise<void> | void;
  onUndoSoftDeleteAttachment?: (attachmentId: string) => Promise<boolean> | boolean;
  /**
   * Conscious full-photo download for one missing item (open / “Stáhnout fotku”).
   * Must not hydrate the whole album.
   */
  onRequestDisplayDownload?: (attachment: PhotoAttachment) => Promise<void> | void;
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
  onSoftDeleteAttachment,
  onUndoSoftDeleteAttachment,
  onRequestDisplayDownload,
}: PhotoAttachmentsFieldProps) {
  const { ui } = useLumiTheme();
  const [busy, setBusy] = useState(false);
  const [pinBusyId, setPinBusyId] = useState<string | null>(null);
  const [downloadBusyId, setDownloadBusyId] = useState<string | null>(null);
  const [removeBusyId, setRemoveBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastRemovedId, setLastRemovedId] = useState<string | null>(null);
  const remaining = ATTACHMENT_LIMITS.maxPerEvent - attachments.length - pendingCandidates.length;

  async function pickMore() {
    if (!services || remaining <= 0) return;
    setBusy(true);
    setMessage(null);
    try {
      // Worst-case probe before opening the system picker — refuse when free
      // space is known to be below one full-size import.
      const preflight = await guardPhotoImportSpace({
        attachments: services,
        candidateCount: Math.max(1, remaining),
      });
      if (!preflight.allow) {
        setMessage(preflight.message);
        return;
      }

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
          const spaceMessage = imported.failed.find(
            (row) => row.code === 'photo_insufficient_space',
          )?.message;
          setMessage(
            spaceMessage ??
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ui.space.xs }}>
              {onSoftDeleteAttachment ? (
                <LumiButton
                  title="Odebrat fotku"
                  variant="ghost"
                  disabled={busy || removeBusyId === attachment.attachmentId}
                  onPress={() => {
                    setRemoveBusyId(attachment.attachmentId);
                    setMessage(null);
                    void Promise.resolve(onSoftDeleteAttachment(attachment))
                      .then(() => {
                        onChange(
                          attachments.filter(
                            (row) => row.attachmentId !== attachment.attachmentId,
                          ),
                        );
                        setLastRemovedId(attachment.attachmentId);
                        setMessage(
                          'Fotka je v koši na 7 dní. Zpět obnoví místní kopii, pokud ještě nevypršela lhůta.',
                        );
                      })
                      .catch(() => {
                        setMessage('Fotku se nepodařilo odebrat.');
                      })
                      .finally(() => setRemoveBusyId(null));
                  }}
                />
              ) : null}
              {enableOfflinePin ? (
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
              ) : null}
              {onRequestDisplayDownload &&
              transferLabelFor?.(attachment) === 'missing_download' ? (
                <LumiButton
                  title="Stáhnout fotku"
                  variant="secondary"
                  disabled={busy || downloadBusyId === attachment.attachmentId}
                  onPress={() => {
                    setDownloadBusyId(attachment.attachmentId);
                    setMessage(null);
                    void Promise.resolve(onRequestDisplayDownload(attachment))
                      .then(() => {
                        setMessage('Stahuji plnou fotku — jen tuto, ne celé album.');
                      })
                      .catch(() => {
                        setMessage('Fotku se nepodařilo zařadit ke stažení.');
                      })
                      .finally(() => setDownloadBusyId(null));
                  }}
                />
              ) : null}
            </View>
            {enableOfflinePin ? (
              pinReadiness.label ? (
                <LumiText variant="caption" tone="muted">
                  {pinReadiness.label}
                </LumiText>
              ) : (
                <LumiText variant="caption" tone="muted">
                  Přepínač sám nestačí — offline je hotové až po ověřené kopii v zařízení.
                </LumiText>
              )
            ) : null}
          </View>
        );
      })}
      {pendingCandidates.map((candidate, index) => (
        <View key={`${candidate.sourceUri}-${index}`} style={{ gap: ui.space.xs }}>
          <LumiText variant="body">Záznam uložený — fotka se připravuje</LumiText>
          <LumiButton
            title="Zrušit výběr"
            variant="ghost"
            disabled={busy}
            onPress={() => {
              onPendingCandidatesChange(
                pendingCandidates.filter((_, pendingIndex) => pendingIndex !== index),
              );
            }}
          />
        </View>
      ))}
      {lastRemovedId && onUndoSoftDeleteAttachment ? (
        <LumiButton
          title="Zpět — obnovit fotku"
          variant="secondary"
          disabled={busy}
          onPress={() => {
            const attachmentId = lastRemovedId;
            void Promise.resolve(onUndoSoftDeleteAttachment(attachmentId)).then((ok) => {
              if (!ok) {
                setMessage('Obnova už není dostupná — lhůta koše vypršela nebo bajty chybí.');
                setLastRemovedId(null);
                return;
              }
              setLastRemovedId(null);
              setMessage('Fotka je znovu v záznamu.');
            });
          }}
        />
      ) : null}
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
