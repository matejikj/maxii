import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { LumiChip, LumiInput, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import type { ChildId, TimeZoneId } from '../../domain';
import {
  UNDO_WINDOW_MS,
  asEntityId,
  asOperationId,
  asRevisionId,
  createDraft,
  touchDraft,
  type LengthDisplayUnit,
  type WeightDisplayUnit,
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
import { formatWallDateTime, parseWallDateTime } from '../today/recordDiaperIntent';
import {
  buildRecordGrowthCommand,
  mintGrowthIds,
  parseGrowthFormFields,
  type GrowthIntentIds,
} from '../today/recordGrowthIntent';

export type GrowthRecorderProps = {
  childId: ChildId;
  timeZone: TimeZoneId;
  open: boolean;
  onClose: () => void;
  weightUnit: WeightDisplayUnit;
  lengthUnit: LengthDisplayUnit;
  onChangeWeightUnit: (unit: WeightDisplayUnit) => void;
  onChangeLengthUnit: (unit: LengthDisplayUnit) => void;
};

export function GrowthRecorder({
  childId,
  timeZone,
  open,
  onClose,
  weightUnit,
  lengthUnit,
  onChangeWeightUnit,
  onChangeLengthUnit,
}: GrowthRecorderProps) {
  const { ui } = useLumiTheme();
  const { services } = useCompositionRoot();
  const runtime = usePersonalRuntime();
  const [feedback, setFeedback] = useState<SaveFeedbackState>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState<string | undefined>();
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [pending, setPending] = useState(false);
  const [wallTime, setWallTime] = useState('');
  const [weightRaw, setWeightRaw] = useState('');
  const [lengthRaw, setLengthRaw] = useState('');
  const [headRaw, setHeadRaw] = useState('');
  const [note, setNote] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [savedIds, setSavedIds] = useState<GrowthIntentIds | null>(null);
  const [savedRevisionId, setSavedRevisionId] = useState<string | null>(null);
  const [savedEventId, setSavedEventId] = useState<string | null>(null);
  const retryRef = useRef<null | (() => Promise<void>)>(null);
  const draftIds = useRef({
    draftId: asEntityId(services.ids.createId('draft')),
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

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Defer reset so opening the sheet syncs from the clock, not from render.
    queueMicrotask(() => {
      if (cancelled) return;
      const now = formatWallDateTime(services.clock.now().epochMs, timeZone);
      setWallTime(now);
      setWeightRaw('');
      setLengthRaw('');
      setHeadRaw('');
      setNote('');
      setFieldError(undefined);
      setFeedback('idle');
      setFeedbackMessage(undefined);
      setUndoAvailable(false);
      setSavedIds(null);
      setSavedRevisionId(null);
      setSavedEventId(null);
      draftIds.current = {
        draftId: asEntityId(services.ids.createId('draft')),
        originalMs: services.clock.now().epochMs,
      };
    });
    return () => {
      cancelled = true;
    };
  }, [open, services.clock, services.ids, timeZone]);

  const scheduleDraft = useCallback(
    (payload: Record<string, unknown>) => {
      const nowMs = services.clock.now().epochMs;
      const draft = touchDraft(
        createDraft({
          draftId: draftIds.current.draftId,
          childId,
          formType: 'growth',
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
    if (!open) return;
    scheduleDraft({
      wallTime,
      weightRaw,
      lengthRaw,
      headRaw,
      note,
      weightUnit,
      lengthUnit,
      originalMs: draftIds.current.originalMs,
    });
  }, [headRaw, lengthRaw, lengthUnit, note, open, scheduleDraft, wallTime, weightRaw, weightUnit]);

  async function commit(expectedRevisionId?: string) {
    const parsedTime = parseWallDateTime(wallTime, timeZone);
    if (!parsedTime.ok) {
      setFieldError(parsedTime.message);
      return;
    }
    const parsed = parseGrowthFormFields({
      weightRaw,
      lengthRaw,
      headRaw,
      weightUnit,
      lengthUnit,
    });
    if (!parsed.ok) {
      setFieldError(parsed.message);
      return;
    }
    setFieldError(undefined);
    const intentMs = services.clock.now().epochMs;
    const ids = savedIds ?? mintGrowthIds(services.ids);
    setSavedIds(ids);
    setPending(true);
    setFeedback('pending');
    retryRef.current = () => commit(expectedRevisionId);
    const result = await runtime.commands.dispatch(
      buildRecordGrowthCommand({
        ids,
        childId,
        measuredOn: parsedTime.occurredAt,
        intentCapturedAtMs: intentMs,
        weightKg: parsed.weightKg,
        lengthCm: parsed.lengthCm,
        headCm: parsed.headCm,
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
    setFeedbackMessage(PRODUCT_COPY.feedback.growthSaved);
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

  return (
    <CareActionSheet
      visible={open}
      title={PRODUCT_COPY.actions.recordGrowth}
      onClose={onClose}
      footer={
        <FormSaveButton
          onSave={() => void commit(savedRevisionId ?? undefined)}
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
      {feedback === 'error' && retryRef.current ? (
        <FormSaveButton
          label={PRODUCT_COPY.actions.retry}
          onSave={() => retryRef.current?.()}
          pending={pending}
        />
      ) : null}
      <LumiText tone="muted">{PRODUCT_COPY.growth.oneValueEnough}</LumiText>
      <FormSection title={PRODUCT_COPY.fields.eventTime}>
        <DateTimeField
          value={wallTime}
          onChangeText={setWallTime}
          {...(fieldError !== undefined ? { error: fieldError } : {})}
        />
      </FormSection>
      <FormSection title={PRODUCT_COPY.fields.weight}>
        <LumiInput
          label={PRODUCT_COPY.fields.weight}
          value={weightRaw}
          onChangeText={setWeightRaw}
          keyboardType="decimal-pad"
          hint={`Jednotka: ${weightUnit}`}
          testID="growth-weight-input"
        />
        <View style={{ flexDirection: 'row', gap: ui.space.sm }}>
          {(['kg', 'lb'] as const).map((unit) => (
            <LumiChip
              key={unit}
              label={unit}
              selected={weightUnit === unit}
              onPress={() => onChangeWeightUnit(unit)}
            />
          ))}
        </View>
      </FormSection>
      <FormSection title={PRODUCT_COPY.fields.length}>
        <LumiInput
          label={PRODUCT_COPY.fields.length}
          value={lengthRaw}
          onChangeText={setLengthRaw}
          keyboardType="decimal-pad"
          hint={`Jednotka: ${lengthUnit}`}
        />
        <View style={{ flexDirection: 'row', gap: ui.space.sm }}>
          {(['cm', 'in'] as const).map((unit) => (
            <LumiChip
              key={unit}
              label={unit}
              selected={lengthUnit === unit}
              onPress={() => onChangeLengthUnit(unit)}
            />
          ))}
        </View>
      </FormSection>
      <FormSection title={PRODUCT_COPY.fields.head}>
        <LumiInput
          label={PRODUCT_COPY.fields.head}
          value={headRaw}
          onChangeText={setHeadRaw}
          keyboardType="decimal-pad"
          hint={`Volitelné · ${lengthUnit}`}
        />
      </FormSection>
      <NoteField value={note} onChangeText={setNote} />
    </CareActionSheet>
  );
}
