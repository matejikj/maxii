import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { LumiButton, LumiChip, LumiInput, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import type { ChildId, DevelopmentArea, TimeZoneId } from '../../domain';
import {
  UNDO_WINDOW_MS,
  asEntityId,
  asOperationId,
  asRevisionId,
  createDraft,
  touchDraft,
} from '../../domain';
import { createDraftAutosave } from '../../application';
import { useCompositionRoot } from '../../app/providers';
import { usePersonalRuntime } from '../../app/session/BootstrapContext';
import {
  CareActionSheet,
  DateTimeField,
  FormSaveButton,
  FormSection,
  NoteField,
  PRODUCT_COPY,
  SaveFeedback,
  useUndoWindow,
  type SaveFeedbackState,
} from '../ui';
import { PhotoAttachmentsField } from '../care/PhotoAttachmentsField';
import type { PhotoAttachment, PickedPhotoCandidate } from '../../domain/attachments';
import { formatWallDateTime, parseWallDateTime } from './recordDiaperIntent';
import {
  DEVELOPMENT_AREA_OPTIONS,
  buildRecordExperienceCommand,
  buildRecordMilestoneCommand,
  buildRecordNoteCommand,
  mintMomentIds,
  type MomentIntentIds,
} from './recordMomentIntent';

export type ExperienceRecorderProps = {
  childId: ChildId;
  timeZone: TimeZoneId;
  open: boolean;
  onClose: () => void;
  /** Fired only after a confirmed local commit — never for pending or failed writes. */
  onSavedLocally?: () => void;
};

type MomentKind = 'play' | 'milestone' | 'note';

/**
 * Experience quick action: free play, parental milestone, or evening note.
 * Dictation is only whatever the system keyboard offers inside NoteField.
 */
export function ExperienceRecorder({
  childId,
  timeZone,
  open,
  onClose,
  onSavedLocally,
}: ExperienceRecorderProps) {
  const { ui } = useLumiTheme();
  const { services } = useCompositionRoot();
  const runtime = usePersonalRuntime();
  const [panel, setPanel] = useState<'picker' | MomentKind>('picker');
  const [feedback, setFeedback] = useState<SaveFeedbackState>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState<string | undefined>();
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [pending, setPending] = useState(false);
  const [wallTime, setWallTime] = useState('');
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [area, setArea] = useState<DevelopmentArea | null>(null);
  const [note, setNote] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [savedIds, setSavedIds] = useState<MomentIntentIds | null>(null);
  const [savedRevisionId, setSavedRevisionId] = useState<string | null>(null);
  const [savedEventId, setSavedEventId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<PhotoAttachment[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<PickedPhotoCandidate[]>([]);
  const retryRef = useRef<null | (() => Promise<void>)>(null);
  const draftIds = useRef({
    draftId: asEntityId(services.ids.createId('draft')),
    originalMs: services.clock.now().epochMs,
    formType: 'note' as 'note' | 'experience' | 'milestone',
  });
  const autosave = useRef(
    createDraftAutosave(runtime.commands, { nowMs: () => services.clock.now().epochMs }),
  );

  useEffect(() => {
    const current = autosave.current;
    return () => current.dispose();
  }, []);

  useUndoWindow(undoAvailable, UNDO_WINDOW_MS, () => setUndoAvailable(false));

  function resetFields(kind: MomentKind | 'picker') {
    const now = formatWallDateTime(services.clock.now().epochMs, timeZone);
    setWallTime(now);
    setBody('');
    setTitle('');
    setArea(null);
    setNote('');
    setFieldError(undefined);
    setFeedback('idle');
    setFeedbackMessage(undefined);
    setUndoAvailable(false);
    setSavedIds(null);
    setSavedRevisionId(null);
    setSavedEventId(null);
    setAttachments([]);
    setPendingPhotos([]);
    draftIds.current = {
      draftId: asEntityId(services.ids.createId('draft')),
      originalMs: services.clock.now().epochMs,
      formType: kind === 'play' ? 'experience' : kind === 'milestone' ? 'milestone' : 'note',
    };
  }

  async function attachPendingAfterSave(
    eventId: string,
    hostEventType: 'note' | 'milestone' | 'experience',
  ) {
    if (!runtime.attachments || pendingPhotos.length === 0) return;
    const { attachPhotosToSavedEvent } = await import('../../application/attachPhotos');
    const imported = await attachPhotosToSavedEvent(runtime.attachments, {
      childId,
      eventId: asEntityId(eventId),
      hostEventType,
      candidates: pendingPhotos,
      nowMs: services.clock.now().epochMs,
      createId: (prefix) => services.ids.createId(prefix),
    });
    setAttachments((current) => [...current, ...imported.attached]);
    setPendingPhotos([]);
    if (imported.failed.length > 0) {
      setFeedbackMessage(
        `Záznam je uložený. ${imported.failed.length} fotografií se nepodařilo připravit.`,
      );
    }
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setPanel('picker');
      resetFields('picker');
    });
    return () => {
      cancelled = true;
    };
    // Opening resets; avoid re-running on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const scheduleDraft = useCallback(
    (payload: Record<string, unknown>) => {
      const nowMs = services.clock.now().epochMs;
      const draft = touchDraft(
        createDraft({
          draftId: draftIds.current.draftId,
          childId,
          formType: draftIds.current.formType,
          originalEventTime: { epochMs: draftIds.current.originalMs },
          updatedAt: { epochMs: nowMs },
          payload,
        }),
        { epochMs: nowMs },
        payload,
      );
      autosave.current.schedule({
        type: 'saveDraft',
        operationId: asOperationId(services.ids.createId('op')),
        intentCapturedAt: { epochMs: nowMs },
        draft,
        revisionId: asRevisionId(services.ids.createId('rev')),
      });
    },
    [childId, services.clock, services.ids],
  );

  useEffect(() => {
    if (!open || panel === 'picker') return;
    scheduleDraft({
      panel,
      wallTime,
      body,
      title,
      area,
      note,
      originalMs: draftIds.current.originalMs,
    });
  }, [area, body, note, open, panel, scheduleDraft, title, wallTime]);

  async function commitNote(expectedRevisionId?: string) {
    if (!body.trim()) {
      setFieldError(PRODUCT_COPY.feedback.noteRequired);
      return;
    }
    const parsedTime = parseWallDateTime(wallTime, timeZone);
    if (!parsedTime.ok) {
      setFieldError(parsedTime.message);
      return;
    }
    setFieldError(undefined);
    const intentMs = services.clock.now().epochMs;
    const ids = savedIds ?? mintMomentIds(services.ids);
    setSavedIds(ids);
    setPending(true);
    setFeedback('pending');
    retryRef.current = () => commitNote(expectedRevisionId);
    const result = await runtime.commands.dispatch(
      buildRecordNoteCommand({
        ids,
        childId,
        occurredAt: parsedTime.occurredAt,
        body,
        intentCapturedAtMs: intentMs,
        ...(expectedRevisionId
          ? { expectedRevisionId: asRevisionId(expectedRevisionId) }
          : {}),
      }),
    );
    setPending(false);
    if (!result.ok) {
      setFeedback('error');
      setFeedbackMessage(PRODUCT_COPY.feedback.saveFailed);
      return;
    }
    setSavedEventId(ids.eventId);
    setSavedRevisionId(result.revisionIds[0] ?? ids.revisionId);
    setUndoAvailable(result.undo?.kind === 'undoCreateCare');
    setFeedback('saved');
    onSavedLocally?.();
    setFeedbackMessage(PRODUCT_COPY.feedback.noteSaved);
    await attachPendingAfterSave(ids.eventId, 'note');
  }

  async function commitMilestone(expectedRevisionId?: string) {
    if (!body.trim()) {
      setFieldError(PRODUCT_COPY.feedback.milestoneRequired);
      return;
    }
    const parsedTime = parseWallDateTime(wallTime, timeZone);
    if (!parsedTime.ok) {
      setFieldError(parsedTime.message);
      return;
    }
    setFieldError(undefined);
    const intentMs = services.clock.now().epochMs;
    const ids = savedIds ?? mintMomentIds(services.ids);
    setSavedIds(ids);
    setPending(true);
    setFeedback('pending');
    retryRef.current = () => commitMilestone(expectedRevisionId);
    const result = await runtime.commands.dispatch(
      buildRecordMilestoneCommand({
        ids,
        childId,
        occurredAt: parsedTime.occurredAt,
        body,
        intentCapturedAtMs: intentMs,
        ...(expectedRevisionId
          ? { expectedRevisionId: asRevisionId(expectedRevisionId) }
          : {}),
      }),
    );
    setPending(false);
    if (!result.ok) {
      setFeedback('error');
      setFeedbackMessage(PRODUCT_COPY.feedback.saveFailed);
      return;
    }
    setSavedEventId(ids.eventId);
    setSavedRevisionId(result.revisionIds[0] ?? ids.revisionId);
    setUndoAvailable(result.undo?.kind === 'undoCreateCare');
    setFeedback('saved');
    onSavedLocally?.();
    setFeedbackMessage(PRODUCT_COPY.feedback.milestoneSaved);
    await attachPendingAfterSave(ids.eventId, 'milestone');
  }

  async function commitPlay(expectedRevisionId?: string) {
    if (!area && !title.trim() && !note.trim()) {
      setFieldError(PRODUCT_COPY.feedback.experienceRequired);
      return;
    }
    const parsedTime = parseWallDateTime(wallTime, timeZone);
    if (!parsedTime.ok) {
      setFieldError(parsedTime.message);
      return;
    }
    setFieldError(undefined);
    const intentMs = services.clock.now().epochMs;
    const ids = savedIds ?? mintMomentIds(services.ids);
    setSavedIds(ids);
    setPending(true);
    setFeedback('pending');
    retryRef.current = () => commitPlay(expectedRevisionId);
    const result = await runtime.commands.dispatch(
      buildRecordExperienceCommand({
        ids,
        childId,
        occurredAt: parsedTime.occurredAt,
        intentCapturedAtMs: intentMs,
        title: title || null,
        area,
        note: note || null,
        ...(expectedRevisionId
          ? { expectedRevisionId: asRevisionId(expectedRevisionId) }
          : {}),
      }),
    );
    setPending(false);
    if (!result.ok) {
      setFeedback('error');
      setFeedbackMessage(PRODUCT_COPY.feedback.saveFailed);
      return;
    }
    setSavedEventId(ids.eventId);
    setSavedRevisionId(result.revisionIds[0] ?? ids.revisionId);
    setUndoAvailable(result.undo?.kind === 'undoCreateCare');
    setFeedback('saved');
    onSavedLocally?.();
    setFeedbackMessage(PRODUCT_COPY.feedback.experienceSaved);
    await attachPendingAfterSave(ids.eventId, 'experience');
  }

  async function onUndo() {
    if (!savedEventId || !savedRevisionId || !undoAvailable) return;
    const intentMs = services.clock.now().epochMs;
    const result = await runtime.commands.dispatch({
      type: 'undoCreateCare',
      operationId: asOperationId(services.ids.createId('op')),
      intentCapturedAt: { epochMs: intentMs },
      eventId: asEntityId(savedEventId),
      expectedRevisionId: asRevisionId(savedRevisionId),
      deletionId: asEntityId(services.ids.createId('del')),
      revisionId: asRevisionId(services.ids.createId('rev')),
    });
    if (!result.ok) {
      setFeedback('error');
      setFeedbackMessage(PRODUCT_COPY.feedback.saveFailed);
      return;
    }
    setUndoAvailable(false);
    setFeedback('idle');
    setSavedEventId(null);
  }

  function closeAll() {
    setPanel('picker');
    onClose();
  }

  return (
    <>
      <CareActionSheet
        visible={open && panel === 'picker'}
        title={PRODUCT_COPY.sheets.experience}
        onClose={closeAll}
      >
        <SaveFeedback
          state={feedback}
          {...(feedbackMessage !== undefined ? { message: feedbackMessage } : {})}
          undoAvailable={undoAvailable}
          onUndo={() => void onUndo()}
        />
        <LumiText tone="muted">{PRODUCT_COPY.experience.pickerHint}</LumiText>
        <LumiButton
          title={PRODUCT_COPY.actions.wePlayed}
          fullWidth
          onPress={() => {
            resetFields('play');
            setPanel('play');
          }}
          testID="experience-play"
        />
        <LumiButton
          title={PRODUCT_COPY.actions.newMoment}
          variant="secondary"
          fullWidth
          onPress={() => {
            resetFields('milestone');
            setPanel('milestone');
          }}
        />
        <LumiButton
          title={PRODUCT_COPY.actions.eveningNote}
          variant="ghost"
          fullWidth
          onPress={() => {
            resetFields('note');
            setPanel('note');
          }}
          testID="experience-note"
        />
      </CareActionSheet>

      <CareActionSheet
        visible={open && panel === 'play'}
        title={PRODUCT_COPY.actions.wePlayed}
        onClose={() => setPanel('picker')}
        footer={
          <FormSaveButton
            onSave={() => void commitPlay(savedRevisionId ?? undefined)}
            pending={pending}
          />
        }
      >
        <SaveFeedback
          state={feedback}
          {...(feedbackMessage !== undefined ? { message: feedbackMessage } : {})}
          undoAvailable={undoAvailable}
          onUndo={() => void onUndo()}
        />
        <LumiText tone="muted">{PRODUCT_COPY.experience.playHint}</LumiText>
        <FormSection title={PRODUCT_COPY.fields.eventTime}>
          <DateTimeField
            value={wallTime}
            onChangeText={setWallTime}
            {...(fieldError !== undefined ? { error: fieldError } : {})}
          />
        </FormSection>
        <FormSection title={PRODUCT_COPY.fields.area}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ui.space.sm }}>
            {DEVELOPMENT_AREA_OPTIONS.map((option) => (
              <LumiChip
                key={option.id}
                label={option.label}
                selected={area === option.id}
                onPress={() => setArea((current) => (current === option.id ? null : option.id))}
              />
            ))}
          </View>
        </FormSection>
        <LumiInput
          label={PRODUCT_COPY.fields.experienceTitle}
          value={title}
          onChangeText={setTitle}
        />
        <NoteField value={note} onChangeText={setNote} label={PRODUCT_COPY.fields.optionalNote} />
        <PhotoAttachmentsField
          childId={childId}
          eventId={savedEventId ? asEntityId(savedEventId) : null}
          hostEventType="experience"
          services={runtime.attachments}
          createId={(prefix) => services.ids.createId(prefix)}
          nowMs={() => services.clock.now().epochMs}
          attachments={attachments}
          onChange={setAttachments}
          pendingCandidates={pendingPhotos}
          onPendingCandidatesChange={setPendingPhotos}
        />
      </CareActionSheet>

      <CareActionSheet
        visible={open && panel === 'milestone'}
        title={PRODUCT_COPY.actions.newMoment}
        onClose={() => setPanel('picker')}
        footer={
          <FormSaveButton
            onSave={() => void commitMilestone(savedRevisionId ?? undefined)}
            pending={pending}
          />
        }
      >
        <SaveFeedback
          state={feedback}
          {...(feedbackMessage !== undefined ? { message: feedbackMessage } : {})}
          undoAvailable={undoAvailable}
          onUndo={() => void onUndo()}
        />
        <LumiText tone="muted">{PRODUCT_COPY.experience.milestoneHint}</LumiText>
        <FormSection title={PRODUCT_COPY.fields.eventTime}>
          <DateTimeField
            value={wallTime}
            onChangeText={setWallTime}
            {...(fieldError !== undefined ? { error: fieldError } : {})}
          />
        </FormSection>
        <NoteField
          value={body}
          onChangeText={setBody}
          label={PRODUCT_COPY.fields.milestoneBody}
          {...(fieldError !== undefined ? { error: fieldError } : {})}
        />
        <PhotoAttachmentsField
          childId={childId}
          eventId={savedEventId ? asEntityId(savedEventId) : null}
          hostEventType="milestone"
          services={runtime.attachments}
          createId={(prefix) => services.ids.createId(prefix)}
          nowMs={() => services.clock.now().epochMs}
          attachments={attachments}
          onChange={setAttachments}
          pendingCandidates={pendingPhotos}
          onPendingCandidatesChange={setPendingPhotos}
        />
      </CareActionSheet>

      <CareActionSheet
        visible={open && panel === 'note'}
        title={PRODUCT_COPY.actions.eveningNote}
        onClose={() => setPanel('picker')}
        footer={
          <FormSaveButton
            onSave={() => void commitNote(savedRevisionId ?? undefined)}
            pending={pending}
          />
        }
      >
        <SaveFeedback
          state={feedback}
          {...(feedbackMessage !== undefined ? { message: feedbackMessage } : {})}
          undoAvailable={undoAvailable}
          onUndo={() => void onUndo()}
        />
        <LumiText tone="muted">{PRODUCT_COPY.experience.noteHint}</LumiText>
        <FormSection title={PRODUCT_COPY.fields.eventTime}>
          <DateTimeField
            value={wallTime}
            onChangeText={setWallTime}
            {...(fieldError !== undefined ? { error: fieldError } : {})}
          />
        </FormSection>
        <NoteField
          value={body}
          onChangeText={setBody}
          label={PRODUCT_COPY.fields.noteBody}
          {...(fieldError !== undefined ? { error: fieldError } : {})}
        />
        <PhotoAttachmentsField
          childId={childId}
          eventId={savedEventId ? asEntityId(savedEventId) : null}
          hostEventType="note"
          services={runtime.attachments}
          createId={(prefix) => services.ids.createId(prefix)}
          nowMs={() => services.clock.now().epochMs}
          attachments={attachments}
          onChange={setAttachments}
          pendingCandidates={pendingPhotos}
          onPendingCandidatesChange={setPendingPhotos}
        />
      </CareActionSheet>
    </>
  );
}
