import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { LumiButton, LumiChip, LumiInput, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import type { BottleContents, ChildId, FeedingSide, TimeZoneId } from '../../domain';
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
  QuantityField,
  SaveFeedback,
  useUndoWindow,
  type QuantityUnitOption,
  type SaveFeedbackState,
} from '../ui';
import { formatWallDateTime, parseWallDateTime } from './recordDiaperIntent';
import {
  loadLastFeedingKind,
  saveLastFeedingKind,
  type FeedingKind,
} from './feedingTypeMemory';
import {
  buildRecordBottleCommand,
  buildRecordFoodCommand,
  buildRecordNursingNoDurationCommand,
  buildRecordNursingPastCommand,
  mintFeedingIds,
  parseMeasuredAmount,
  sideLabel,
  type FeedingIntentIds,
} from './recordFeedingIntent';
import { useNursingStarter } from './NursingSessionController';
import type { ActiveSession } from '../../domain';

export type FeedingRecorderProps = {
  childId: ChildId;
  timeZone: TimeZoneId;
  open: boolean;
  onClose: () => void;
  activeNursing: ActiveSession | null;
  onOpenEvent?: (eventId: string) => void;
  /** Fired only after a confirmed local commit — never for pending or failed writes. */
  onSavedLocally?: () => void;
};

type BottleContentsOption = { id: BottleContents; label: string };

const BOTTLE_CONTENTS: BottleContentsOption[] = [
  { id: 'formula', label: 'Umělé' },
  { id: 'breastMilk', label: 'Mateřské' },
  { id: 'mixed', label: 'Smíšené' },
  { id: 'other', label: 'Jiné' },
];

/**
 * Feeding panel remembers last kind only. Amount, contents, and wall time stay
 * blank/current — never copied from the previous event.
 */
export function FeedingRecorder({
  childId,
  timeZone,
  open,
  onClose,
  activeNursing,
  onOpenEvent,
  onSavedLocally,
}: FeedingRecorderProps) {
  const { ui } = useLumiTheme();
  const { services } = useCompositionRoot();
  const runtime = usePersonalRuntime();
  const nursingStarter = useNursingStarter(childId, timeZone, activeNursing);
  const [kind, setKind] = useState<FeedingKind>('nursing');
  const [panel, setPanel] = useState<'picker' | 'bottle' | 'food' | 'nursingManual' | 'nursingNoDuration'>(
    'picker',
  );
  const [feedback, setFeedback] = useState<SaveFeedbackState>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState<string | undefined>();
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState('');
  const [wallTime, setWallTime] = useState('');
  const [startWall, setStartWall] = useState('');
  const [endWall, setEndWall] = useState('');
  const [timeError, setTimeError] = useState<string | undefined>();
  const [amountError, setAmountError] = useState<string | undefined>();
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<QuantityUnitOption>('ml');
  const [contents, setContents] = useState<BottleContents>('formula');
  const [description, setDescription] = useState('');
  const [side, setSide] = useState<FeedingSide>('unspecified');
  const [savedEventId, setSavedEventId] = useState<string | null>(null);
  const [savedRevisionId, setSavedRevisionId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<FeedingIntentIds | null>(null);
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

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void loadLastFeedingKind(runtime.unitOfWork).then((stored) => {
      if (!cancelled) {
        setKind(stored);
        setPanel('picker');
        resetFormFields();
      }
    });
    return () => {
      cancelled = true;
    };
    // Opening resets to last kind; do not re-run on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, runtime.unitOfWork]);

  function resetFormFields() {
    const now = formatWallDateTime(services.clock.now().epochMs, timeZone);
    setWallTime(now);
    setStartWall(now);
    setEndWall(now);
    setNote('');
    setAmount('');
    setUnit('ml');
    setContents('formula');
    setDescription('');
    setSide('unspecified');
    setTimeError(undefined);
    setAmountError(undefined);
    setFeedback('idle');
    setFeedbackMessage(undefined);
    setUndoAvailable(false);
    setSavedEventId(null);
    setSavedRevisionId(null);
    setSavedIds(null);
    draftIds.current = {
      draftId: asEntityId(services.ids.createId('draft')),
      revisionId: asRevisionId(services.ids.createId('rev')),
      originalMs: services.clock.now().epochMs,
    };
  }

  const scheduleDraft = useCallback(
    (payload: Record<string, unknown>) => {
      const nowMs = services.clock.now().epochMs;
      const draft = touchDraft(
        createDraft({
          draftId: draftIds.current.draftId,
          childId,
          formType: kind === 'nursing' ? 'nursing' : kind === 'bottle' ? 'bottle' : 'food',
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
    [childId, kind, services.clock, services.ids],
  );

  useEffect(() => {
    if (!open || panel === 'picker') return;
    scheduleDraft({
      kind,
      panel,
      note,
      wallTime,
      startWall,
      endWall,
      amount,
      unit,
      contents,
      description,
      side,
      originalMs: draftIds.current.originalMs,
    });
  }, [
    amount,
    contents,
    description,
    endWall,
    kind,
    note,
    open,
    panel,
    scheduleDraft,
    side,
    startWall,
    unit,
    wallTime,
  ]);

  async function selectKind(next: FeedingKind) {
    setKind(next);
    await saveLastFeedingKind(runtime.unitOfWork, next);
  }

  async function startNursingNow() {
    const result = await nursingStarter.start('unspecified');
    if (result.ok) {
      onSavedLocally?.();
      onClose();
      return;
    }
    if (result.alreadyRunning) {
      onClose();
      return;
    }
    if (nursingStarter.message) {
      setFeedback('error');
      setFeedbackMessage(nursingStarter.message);
    }
  }

  async function commitBottle(expectedRevisionId?: string) {
    const parsedTime = parseWallDateTime(wallTime, timeZone);
    if (!parsedTime.ok) {
      setTimeError(parsedTime.message);
      return;
    }
    const parsedAmount = parseMeasuredAmount(amount, unit);
    if (!parsedAmount.ok) {
      setAmountError(parsedAmount.message);
      return;
    }
    setTimeError(undefined);
    setAmountError(undefined);
    const intentMs = services.clock.now().epochMs;
    const ids = savedIds ?? mintFeedingIds(services.ids);
    setSavedIds(ids);
    setPending(true);
    setFeedback('pending');
    retryRef.current = () => commitBottle(expectedRevisionId);
    const result = await runtime.commands.dispatch(
      buildRecordBottleCommand({
        ids,
        childId,
        occurredAt: parsedTime.occurredAt,
        contents,
        intentCapturedAtMs: intentMs,
        amount: parsedAmount.amount,
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
    setFeedbackMessage(
      parsedAmount.amount == null
        ? PRODUCT_COPY.feedback.bottleSavedUnknownAmount
        : PRODUCT_COPY.feedback.bottleSaved,
    );
  }

  async function commitFood(expectedRevisionId?: string) {
    if (!description.trim()) {
      setAmountError(PRODUCT_COPY.feedback.foodDescriptionRequired);
      return;
    }
    const parsedTime = parseWallDateTime(wallTime, timeZone);
    if (!parsedTime.ok) {
      setTimeError(parsedTime.message);
      return;
    }
    const parsedAmount = parseMeasuredAmount(amount, unit);
    if (!parsedAmount.ok) {
      setAmountError(parsedAmount.message);
      return;
    }
    setTimeError(undefined);
    setAmountError(undefined);
    const intentMs = services.clock.now().epochMs;
    const ids = savedIds ?? mintFeedingIds(services.ids);
    setSavedIds(ids);
    setPending(true);
    setFeedback('pending');
    retryRef.current = () => commitFood(expectedRevisionId);
    const result = await runtime.commands.dispatch(
      buildRecordFoodCommand({
        ids,
        childId,
        occurredAt: parsedTime.occurredAt,
        description,
        intentCapturedAtMs: intentMs,
        amount: parsedAmount.amount,
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
    setFeedbackMessage(PRODUCT_COPY.feedback.foodSaved);
  }

  async function commitNursingPast() {
    const start = parseWallDateTime(startWall, timeZone);
    const end = parseWallDateTime(endWall, timeZone);
    if (!start.ok) {
      setTimeError(start.message);
      return;
    }
    if (!end.ok) {
      setTimeError(end.message);
      return;
    }
    if (end.occurredAt.instant.epochMs < start.occurredAt.instant.epochMs) {
      setTimeError('Konec nemůže být dříve než začátek.');
      return;
    }
    setTimeError(undefined);
    const intentMs = services.clock.now().epochMs;
    const ids = mintFeedingIds(services.ids);
    setPending(true);
    setFeedback('pending');
    const result = await runtime.commands.dispatch(
      buildRecordNursingPastCommand({
        ids,
        childId,
        start: start.occurredAt,
        end: end.occurredAt,
        intentCapturedAtMs: intentMs,
        side,
        note: note || null,
      }),
    );
    setPending(false);
    if (!result.ok) {
      setFeedback('error');
      setFeedbackMessage(PRODUCT_COPY.feedback.saveFailed);
      return;
    }
    setSavedEventId(ids.eventId);
    setUndoAvailable(result.undo?.kind === 'undoCreateCare');
    setFeedback('saved');
    onSavedLocally?.();
    setFeedbackMessage(PRODUCT_COPY.feedback.nursingEnded);
  }

  async function commitNursingNoDuration() {
    const observed = parseWallDateTime(wallTime, timeZone);
    if (!observed.ok) {
      setTimeError(observed.message);
      return;
    }
    setTimeError(undefined);
    const intentMs = services.clock.now().epochMs;
    const ids = mintFeedingIds(services.ids);
    setPending(true);
    setFeedback('pending');
    const result = await runtime.commands.dispatch(
      buildRecordNursingNoDurationCommand({
        ids,
        childId,
        observedAt: observed.occurredAt,
        intentCapturedAtMs: intentMs,
        side,
        note: note || null,
      }),
    );
    setPending(false);
    if (!result.ok) {
      setFeedback('error');
      setFeedbackMessage(PRODUCT_COPY.feedback.saveFailed);
      return;
    }
    setSavedEventId(ids.eventId);
    setUndoAvailable(result.undo?.kind === 'undoCreateCare');
    setFeedback('saved');
    onSavedLocally?.();
    setFeedbackMessage(PRODUCT_COPY.feedback.savedLocally);
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
        title={PRODUCT_COPY.sheets.feeding}
        onClose={closeAll}
      >
        <SaveFeedback
          state={feedback}
          {...(feedbackMessage !== undefined ? { message: feedbackMessage } : {})}
          undoAvailable={undoAvailable}
          onUndo={() => void onUndo()}
          {...(savedEventId && onOpenEvent
            ? { onEdit: () => onOpenEvent(savedEventId) }
            : {})}
        />
        <LumiText tone="muted">{PRODUCT_COPY.feeding.rememberKindOnly}</LumiText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ui.space.sm }}>
          {(
            [
              ['nursing', PRODUCT_COPY.actions.nursing],
              ['bottle', PRODUCT_COPY.actions.bottle],
              ['food', PRODUCT_COPY.actions.food],
            ] as const
          ).map(([id, label]) => (
            <LumiChip
              key={id}
              label={label}
              selected={kind === id}
              onPress={() => void selectKind(id)}
            />
          ))}
        </View>
        {kind === 'nursing' ? (
          <>
            <LumiButton
              title={PRODUCT_COPY.actions.startNursing}
              fullWidth
              loading={nursingStarter.pending}
              onPress={() => void startNursingNow()}
              testID="feeding-start-nursing"
            />
            <LumiButton
              title={PRODUCT_COPY.actions.recordPastNursing}
              variant="secondary"
              fullWidth
              onPress={() => {
                resetFormFields();
                setPanel('nursingManual');
              }}
            />
            <LumiButton
              title={PRODUCT_COPY.actions.recordNursingNoDuration}
              variant="ghost"
              fullWidth
              onPress={() => {
                resetFormFields();
                setPanel('nursingNoDuration');
              }}
            />
          </>
        ) : null}
        {kind === 'bottle' ? (
          <LumiButton
            title={PRODUCT_COPY.actions.recordBottle}
            fullWidth
            onPress={() => {
              resetFormFields();
              setPanel('bottle');
            }}
            testID="feeding-open-bottle"
          />
        ) : null}
        {kind === 'food' ? (
          <LumiButton
            title={PRODUCT_COPY.actions.recordFood}
            fullWidth
            onPress={() => {
              resetFormFields();
              setPanel('food');
            }}
          />
        ) : null}
      </CareActionSheet>

      <CareActionSheet
        visible={open && panel === 'bottle'}
        title={PRODUCT_COPY.actions.recordBottle}
        onClose={() => setPanel('picker')}
        footer={
          <FormSaveButton
            onSave={() => void commitBottle(savedRevisionId ?? undefined)}
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
        <FormSection title={PRODUCT_COPY.fields.eventTime}>
          <DateTimeField
            value={wallTime}
            onChangeText={setWallTime}
            {...(timeError !== undefined ? { error: timeError } : {})}
          />
        </FormSection>
        <FormSection title={PRODUCT_COPY.fields.bottleContents}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ui.space.sm }}>
            {BOTTLE_CONTENTS.map((option) => (
              <LumiChip
                key={option.id}
                label={option.label}
                selected={contents === option.id}
                onPress={() => setContents(option.id)}
              />
            ))}
          </View>
        </FormSection>
        <QuantityField
          amount={amount}
          unit={unit}
          onChangeAmount={setAmount}
          onChangeUnit={setUnit}
          {...(amountError !== undefined ? { error: amountError } : {})}
        />
        <NoteField value={note} onChangeText={setNote} />
      </CareActionSheet>

      <CareActionSheet
        visible={open && panel === 'food'}
        title={PRODUCT_COPY.actions.recordFood}
        onClose={() => setPanel('picker')}
        footer={
          <FormSaveButton
            onSave={() => void commitFood(savedRevisionId ?? undefined)}
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
        <FormSection title={PRODUCT_COPY.fields.eventTime}>
          <DateTimeField
            value={wallTime}
            onChangeText={setWallTime}
            {...(timeError !== undefined ? { error: timeError } : {})}
          />
        </FormSection>
        <LumiInput
          label={PRODUCT_COPY.fields.foodDescription}
          value={description}
          onChangeText={setDescription}
          {...(amountError !== undefined ? { error: amountError } : {})}
        />
        <QuantityField
          amount={amount}
          unit={unit}
          onChangeAmount={setAmount}
          onChangeUnit={setUnit}
        />
        <NoteField value={note} onChangeText={setNote} />
      </CareActionSheet>

      <CareActionSheet
        visible={open && panel === 'nursingManual'}
        title={PRODUCT_COPY.actions.recordPastNursing}
        onClose={() => setPanel('picker')}
        footer={<FormSaveButton onSave={() => void commitNursingPast()} pending={pending} />}
      >
        <FormSection title="Interval">
          <DateTimeField
            label="Začátek"
            value={startWall}
            onChangeText={setStartWall}
            {...(timeError !== undefined ? { error: timeError } : {})}
          />
          <DateTimeField label="Konec" value={endWall} onChangeText={setEndWall} />
        </FormSection>
        <FormSection title={PRODUCT_COPY.fields.side}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ui.space.sm }}>
            {(['left', 'right', 'unspecified'] as const).map((option) => (
              <LumiChip
                key={option}
                label={sideLabel(option)}
                selected={side === option}
                onPress={() => setSide(option)}
              />
            ))}
          </View>
        </FormSection>
        <NoteField value={note} onChangeText={setNote} />
      </CareActionSheet>

      <CareActionSheet
        visible={open && panel === 'nursingNoDuration'}
        title={PRODUCT_COPY.actions.recordNursingNoDuration}
        onClose={() => setPanel('picker')}
        footer={
          <FormSaveButton onSave={() => void commitNursingNoDuration()} pending={pending} />
        }
      >
        <FormSection
          title="Pozorování"
          description="Dokončený zápis bez délky — ne běžící timer a ne nula minut."
        >
          <DateTimeField
            label="Čas pozorování"
            value={wallTime}
            onChangeText={setWallTime}
            {...(timeError !== undefined ? { error: timeError } : {})}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ui.space.sm }}>
            {(['left', 'right', 'unspecified'] as const).map((option) => (
              <LumiChip
                key={option}
                label={sideLabel(option)}
                selected={side === option}
                onPress={() => setSide(option)}
              />
            ))}
          </View>
          <NoteField value={note} onChangeText={setNote} />
        </FormSection>
      </CareActionSheet>
    </>
  );
}
