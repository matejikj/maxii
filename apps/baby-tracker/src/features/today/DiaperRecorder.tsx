import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { LumiChip, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import type { ChildId, DiaperContents, TimeZoneId } from '../../domain';
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
  DirectCareActions,
  FormSaveButton,
  FormSection,
  NoteField,
  PRODUCT_COPY,
  SaveFeedback,
  useUndoWindow,
  type DiaperDirectKind,
  type SaveFeedbackState,
} from '../ui';

import {
  buildRecordDiaperCommand,
  formatWallDateTime,
  mintDiaperIds,
  nowOccurrence,
  parseWallDateTime,
  type DiaperIntentIds,
} from './recordDiaperIntent';

type SavedDiaper = {
  eventId: string;
  revisionId: string;
  ids: DiaperIntentIds;
  contents: DiaperContents;
  note: string;
  wallTime: string;
};

export type DiaperRecorderProps = {
  childId: ChildId;
  timeZone: TimeZoneId;
  open: boolean;
  onClose: () => void;
  returnFocusRef?: React.RefObject<View | null>;
  onOpenEvent?: (eventId: string) => void;
  /** Fired only after a confirmed local commit — never for pending or failed writes. */
  onSavedLocally?: () => void;
};

/**
 * Plenka panel: opening never writes. Direct actions capture “now” on press;
 * detailed form uses an explicit time and a single Uložit.
 */
export function DiaperRecorder({
  childId,
  timeZone,
  open,
  onClose,
  returnFocusRef,
  onOpenEvent,
  onSavedLocally,
}: DiaperRecorderProps) {
  const { ui } = useLumiTheme();
  const { services } = useCompositionRoot();
  const runtime = usePersonalRuntime();
  const [detailedOpen, setDetailedOpen] = useState(false);
  const [feedback, setFeedback] = useState<SaveFeedbackState>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState<string | undefined>();
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState('');
  const [wallTime, setWallTime] = useState(() =>
    formatWallDateTime(services.clock.now().epochMs, timeZone),
  );
  const [contents, setContents] = useState<DiaperContents>('wet');
  const [timeError, setTimeError] = useState<string | undefined>();
  const [saved, setSaved] = useState<SavedDiaper | null>(null);
  const [editing, setEditing] = useState(false);
  const retryRef = useRef<null | (() => Promise<void>)>(null);
  const draftIds = useRef({
    draftId: asEntityId(services.ids.createId('draft')),
    revisionId: asRevisionId(services.ids.createId('rev')),
    originalMs: services.clock.now().epochMs,
  });
  const autosave = useRef(
    createDraftAutosave(runtime.commands, { nowMs: () => services.clock.now().epochMs }),
  );

  useEffect(() => {
    const current = autosave.current;
    return () => current.dispose();
  }, []);

  useUndoWindow(undoAvailable, UNDO_WINDOW_MS, () => setUndoAvailable(false));

  const scheduleDraft = useCallback(
    (payload: Record<string, unknown>) => {
      const nowMs = services.clock.now().epochMs;
      const draft = touchDraft(
        createDraft({
          draftId: draftIds.current.draftId,
          childId,
          formType: 'diaper',
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
    if (!detailedOpen) return;
    scheduleDraft({ note, wallTime, contents });
  }, [contents, detailedOpen, note, scheduleDraft, wallTime]);

  async function commit(
    kind: DiaperContents,
    occurred: ReturnType<typeof nowOccurrence>,
    intentMs: number,
    noteValue: string | null,
    intentIds: DiaperIntentIds,
    expectedRevisionId?: string,
  ) {
    setPending(true);
    setFeedback('pending');
    setFeedbackMessage(undefined);
    const command = buildRecordDiaperCommand({
      ids: intentIds,
      childId,
      contents: kind,
      occurredAt: occurred,
      intentCapturedAtMs: intentMs,
      note: noteValue,
      ...(expectedRevisionId
        ? { expectedRevisionId: asRevisionId(expectedRevisionId) }
        : {}),
    });
    retryRef.current = () =>
      commit(kind, occurred, intentMs, noteValue, intentIds, expectedRevisionId);
    const result = await runtime.commands.dispatch(command);
    setPending(false);
    if (!result.ok) {
      setFeedback('error');
      setFeedbackMessage(PRODUCT_COPY.feedback.saveFailed);
      return;
    }
    await autosave.current.flush();
    setFeedback('saved');
    setFeedbackMessage(PRODUCT_COPY.feedback.diaperSaved);
    onSavedLocally?.();
    setUndoAvailable(result.undo?.kind === 'undoCreateCare' && !expectedRevisionId);
    setSaved({
      eventId: command.eventId,
      // Keep the head revision so a following edit or undo targets the same write.
      revisionId: result.revisionIds[0] ?? command.revisionId,
      ids: intentIds,
      contents: kind,
      note: noteValue ?? '',
      wallTime: formatWallDateTime(occurred.instant.epochMs, timeZone),
    });
    setDetailedOpen(false);
    onClose();
  }

  async function onDirect(kind: DiaperDirectKind) {
    const intentMs = services.clock.now().epochMs;
    const ids = mintDiaperIds(services.ids);
    await commit(kind, nowOccurrence(intentMs, timeZone), intentMs, null, ids);
  }

  async function onDetailedSave() {
    const parsed = parseWallDateTime(wallTime, timeZone);
    if (!parsed.ok) {
      setTimeError(parsed.message);
      return;
    }
    setTimeError(undefined);
    const intentMs = services.clock.now().epochMs;
    if (editing && saved) {
      const ids = mintDiaperIds(services.ids);
      ids.eventId = asEntityId(saved.eventId);
      await commit(contents, parsed.occurredAt, intentMs, note || null, ids, saved.revisionId);
      setEditing(false);
      return;
    }
    const ids = mintDiaperIds(services.ids);
    await commit(contents, parsed.occurredAt, intentMs, note || null, ids);
  }

  async function onUndo() {
    if (!saved || !undoAvailable) return;
    const nowMs = services.clock.now().epochMs;
    const result = await runtime.commands.dispatch({
      type: 'undoCreateCare',
      operationId: asOperationId(services.ids.createId('op')),
      intentCapturedAt: { epochMs: nowMs },
      eventId: asEntityId(saved.eventId),
      expectedRevisionId: asRevisionId(saved.revisionId),
      deletionId: asEntityId(services.ids.createId('del')),
      revisionId: asRevisionId(services.ids.createId('rev')),
    });
    if (result.ok) {
      setUndoAvailable(false);
      setFeedback('idle');
      setSaved(null);
    } else {
      setFeedback('error');
      setFeedbackMessage(PRODUCT_COPY.feedback.saveFailed);
    }
  }

  function onEdit() {
    if (!saved) return;
    setContents(saved.contents);
    setNote(saved.note);
    setWallTime(saved.wallTime);
    setEditing(true);
    setDetailedOpen(true);
  }

  return (
    <>
      <SaveFeedback
        state={feedback}
        {...(feedbackMessage !== undefined ? { message: feedbackMessage } : {})}
        undoAvailable={undoAvailable}
        onUndo={() => void onUndo()}
        {...(saved
          ? {
              onEdit: () => {
                if (onOpenEvent) onOpenEvent(saved.eventId);
                onEdit();
              },
            }
          : {})}
      />
      {feedback === 'error' && retryRef.current ? (
        <View style={{ marginTop: ui.space.sm }}>
          <FormSaveButton
            label={PRODUCT_COPY.actions.retry}
            onSave={() => retryRef.current?.()}
            pending={pending}
          />
        </View>
      ) : null}

      <CareActionSheet
        visible={open && !detailedOpen}
        title={PRODUCT_COPY.sheets.diaperNow}
        subtitle="Přímá akce uloží teď. Otevření panelu samo nic nezapisuje."
        onClose={onClose}
        {...(returnFocusRef ? { returnFocusRef } : {})}
      >
        <DirectCareActions
          pending={pending}
          onRecord={onDirect}
          onOpenDetailed={() => {
            setWallTime(formatWallDateTime(services.clock.now().epochMs, timeZone));
            setDetailedOpen(true);
            onClose();
          }}
        />
      </CareActionSheet>

      <CareActionSheet
        visible={detailedOpen}
        title={PRODUCT_COPY.sheets.detailedDiaper}
        onClose={() => {
          setDetailedOpen(false);
          setEditing(false);
        }}
        footer={<FormSaveButton onSave={() => void onDetailedSave()} pending={pending} />}
      >
        <FormSection title="Podrobnosti">
          <DateTimeField
            value={wallTime}
            onChangeText={setWallTime}
            {...(timeError !== undefined ? { error: timeError } : {})}
          />
          <LumiText variant="label">{PRODUCT_COPY.fields.contents}</LumiText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ui.space.sm }}>
            {(
              [
                ['wet', PRODUCT_COPY.actions.recordWet],
                ['dirty', PRODUCT_COPY.actions.recordDirty],
                ['both', PRODUCT_COPY.actions.recordBoth],
              ] as const
            ).map(([id, label]) => (
              <LumiChip
                key={id}
                label={label}
                selected={contents === id}
                onPress={() => setContents(id)}
              />
            ))}
          </View>
          <NoteField value={note} onChangeText={setNote} />
        </FormSection>
      </CareActionSheet>
    </>
  );
}
