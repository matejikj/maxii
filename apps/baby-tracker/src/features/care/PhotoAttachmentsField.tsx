import React, { useState } from 'react';
import { View } from 'react-native';
import { LumiButton, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import {
  ATTACHMENT_LIMITS,
  localAvailabilityLabel,
  type AttachmentServices,
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
}: PhotoAttachmentsFieldProps) {
  const { ui } = useLumiTheme();
  const [busy, setBusy] = useState(false);
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
        onChange([...attachments, ...imported.attached]);
        onPendingCandidatesChange([]);
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
        const label = localAvailabilityLabel({
          importState: 'linked',
          hasDurableDisplay: attachment.renditions.some(
            (item) => item.role === 'display' && item.availability === 'durable',
          ),
        });
        return (
          <LumiText key={attachment.attachmentId} variant="body">
            {label === 'local' ? 'Fotka uložená v zařízení' : 'Fotka není dostupná'}
            {attachment.caption ? ` — ${attachment.caption}` : ''}
          </LumiText>
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
