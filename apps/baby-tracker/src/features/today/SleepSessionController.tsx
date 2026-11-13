import React, { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { LumiButton, LumiChip, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import type { ActiveSession, ChildId, TimeZoneId } from '../../domain';
import { asEntityId, asRevisionId, UNDO_WINDOW_MS } from '../../domain';
import { useCompositionRoot } from '../../app/providers';
import { usePersonalRuntime } from '../../app/session/BootstrapContext';
import {
  ActiveMeasurement,
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
import { formatWallDateTime, parseWallDateTime } from './recordDiaperIntent';
import {
  buildAdjustSleepStartCommand,
  buildEndSleepCommand,
  buildStartSleepCommand,
  buildUndoEndSleepCommand,
  captureMonotonicStartMs,
  formatElapsedUnits,
  mintSleepIds,
  nowInZone,
  sleepClockUncertainty,
} from './recordSleepIntent';

/** Prompt forgotten-end choices after twelve hours of continuous sleep. */
const LONG_SESSION_MS = 12 * 60 * 60 * 1000;

type EndedSnapshot = {
  sessionId: string;
  eventId: string;
  careRevisionId: string;
  restoreStartedAtMs: number;
  restoreTimeZone: TimeZoneId;
  monotonicStartMs: number | null;
};

export type SleepSessionControllerProps = {
  childId: ChildId;
  timeZone: TimeZoneId;
  activeSleep: ActiveSession | null;
  nowEpochMs: number;
  compact?: boolean;
  hideExpanded?: boolean;
  /** Fired only after a confirmed local commit — never for pending or failed writes. */
  onSavedLocally?: () => void;
};

/**
 * Durable sleep end/edit for a running session. Start lives in `useSleepStarter`
 * so the quick action can commit before any success chrome.
 */
export function SleepSessionController({
  childId,
  timeZone,
  activeSleep,
  nowEpochMs,
  compact = false,
  hideExpanded = false,
  onSavedLocally,
}: SleepSessionControllerProps) {
  const { ui } = useLumiTheme();
  const { services } = useCompositionRoot();
  const runtime = usePersonalRuntime();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<SaveFeedbackState>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState<string | undefined>();
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [panel, setPanel] = useState<
    'none' | 'running' | 'forgotten' | 'editStart' | 'endedEarlier'
  >('none');
  const [startWall, setStartWall] = useState('');
  const [endWall, setEndWall] = useState('');
  const [note, setNote] = useState('');
  const [approximate, setApproximate] = useState(false);
  const [timeError, setTimeError] = useState<string | undefined>();
  const [ended, setEnded] = useState<EndedSnapshot | null>(null);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const endRetry = useRef<null | (() => Promise<void>)>(null);
  const runEndRef = useRef<(endedAtMs: number) => Promise<void>>(async () => {});
  const endIds = useRef<ReturnType<typeof mintSleepIds> | null>(null);
  const intendedEndMs = useRef<number | null>(null);

  useUndoWindow(undoAvailable, UNDO_WINDOW_MS, () => setUndoAvailable(false));

  const uncertainty =
    activeSleep && activeSleep.status === 'running'
      ? sleepClockUncertainty({
          startedAtMs: activeSleep.startedAt.instant.epochMs,
          nowMs: nowEpochMs,
          monotonicStartMs: activeSleep.monotonicStartMs,
        })
      : 'ok';

  const uncertaintyNote =
    uncertainty === 'clock_moved_back'
      ? PRODUCT_COPY.feedback.clockMovedBack
      : uncertainty === 'monotonic_lost' && activeSleep
        ? PRODUCT_COPY.feedback.monotonicLost
        : null;

  const runEnd = useCallback(
    async (endedAtMs: number) => {
      if (!activeSleep || activeSleep.status !== 'running') return;
      if (!endIds.current) endIds.current = mintSleepIds(services.ids);
      if (intendedEndMs.current == null) intendedEndMs.current = endedAtMs;
      const frozenEnd = intendedEndMs.current;
      const ids = endIds.current;
      const command = buildEndSleepCommand({
        operationId: ids.operationId,
        revisionId: ids.revisionId,
        sessionId: activeSleep.sessionId,
        eventId: ids.eventId,
        careRevisionId: ids.careRevisionId,
        childId,
        intendedEndedAt: nowInZone(frozenEnd, activeSleep.startedAt.timeZone),
        intentCapturedAtMs: frozenEnd,
        note: note || null,
        approximateEnd: approximate,
      });
      endRetry.current = () => runEndRef.current(frozenEnd);
      setRetryAvailable(true);
      setPending(true);
      setFeedback('pending');
      const result = await runtime.commands.dispatch(command);
      setPending(false);
      if (!result.ok) {
        setFeedback('error');
        setFeedbackMessage(PRODUCT_COPY.feedback.endNotSaved);
        return;
      }
      setEnded({
        sessionId: activeSleep.sessionId,
        eventId: ids.eventId,
        careRevisionId: result.revisionIds[1] ?? ids.careRevisionId,
        restoreStartedAtMs: activeSleep.startedAt.instant.epochMs,
        restoreTimeZone: activeSleep.startedAt.timeZone,
        monotonicStartMs: activeSleep.monotonicStartMs,
      });
      setUndoAvailable(result.undo?.kind === 'undoEndSleep');
      setFeedback('saved');
      onSavedLocally?.();
      setFeedbackMessage(PRODUCT_COPY.feedback.sleepEnded);
      setPanel('none');
      setRetryAvailable(false);
      intendedEndMs.current = null;
      endIds.current = null;
    },
    [activeSleep, approximate, childId, note, onSavedLocally, runtime.commands, services.ids],
  );

  React.useEffect(() => {
    runEndRef.current = runEnd;
  }, [runEnd]);

  function requestStop() {
    if (!activeSleep) return;
    const elapsed = nowEpochMs - activeSleep.startedAt.instant.epochMs;
    if (elapsed >= LONG_SESSION_MS) {
      setPanel('forgotten');
      return;
    }
    void runEnd(services.clock.now().epochMs);
  }

  async function saveEndedEarlier() {
    const parsed = parseWallDateTime(endWall, timeZone);
    if (!parsed.ok) {
      setTimeError(parsed.message);
      return;
    }
    setTimeError(undefined);
    intendedEndMs.current = parsed.occurredAt.instant.epochMs;
    endIds.current = mintSleepIds(services.ids);
    await runEnd(parsed.occurredAt.instant.epochMs);
  }

  async function saveAdjustedStart() {
    if (!activeSleep) return;
    const parsed = parseWallDateTime(startWall, timeZone);
    if (!parsed.ok) {
      setTimeError(parsed.message);
      return;
    }
    setTimeError(undefined);
    setPending(true);
    const ids = mintSleepIds(services.ids);
    const result = await runtime.commands.dispatch(
      buildAdjustSleepStartCommand({
        ids,
        childId,
        sessionId: activeSleep.sessionId,
        startedAt: parsed.occurredAt,
        intentCapturedAtMs: services.clock.now().epochMs,
        approximateStart: approximate,
      }),
    );
    setPending(false);
    if (!result.ok) {
      setFeedback('error');
      setFeedbackMessage(PRODUCT_COPY.feedback.saveFailed);
      return;
    }
    setPanel('none');
    setFeedback('saved');
    onSavedLocally?.();
    setFeedbackMessage(PRODUCT_COPY.feedback.savedLocally);
  }

  async function onUndoEnd() {
    if (!ended || !undoAvailable) return;
    const ids = mintSleepIds(services.ids);
    const result = await runtime.commands.dispatch(
      buildUndoEndSleepCommand({
        ids,
        childId,
        sessionId: asEntityId(ended.sessionId),
        eventId: asEntityId(ended.eventId),
        expectedCareRevisionId: asRevisionId(ended.careRevisionId),
        restoreStartedAt: nowInZone(ended.restoreStartedAtMs, ended.restoreTimeZone),
        monotonicStartMs: ended.monotonicStartMs,
        intentCapturedAtMs: services.clock.now().epochMs,
      }),
    );
    if (!result.ok) {
      setFeedback('error');
      setFeedbackMessage(
        result.error.details?.reason === 'active_session_exists'
          ? 'Mezitím běží jiný spánek. Původní dokončený záznam necháváme.'
          : PRODUCT_COPY.feedback.saveFailed,
      );
      return;
    }
    setUndoAvailable(false);
    setEnded(null);
    setFeedback('idle');
  }

  const showExpanded = Boolean(activeSleep) && !hideExpanded;

  return (
    <View style={{ gap: ui.space.sm }}>
      <SaveFeedback
        state={feedback}
        {...(feedbackMessage !== undefined ? { message: feedbackMessage } : {})}
        undoAvailable={undoAvailable}
        onUndo={() => void onUndoEnd()}
        {...(activeSleep
          ? {
              onEdit: () => {
                setStartWall(formatWallDateTime(activeSleep.startedAt.instant.epochMs, timeZone));
                setPanel('editStart');
              },
            }
          : {})}
      />
      {feedback === 'error' && retryAvailable ? (
        <FormSaveButton
          label={PRODUCT_COPY.actions.retry}
          onSave={() => endRetry.current?.()}
          pending={pending}
        />
      ) : null}

      {showExpanded && activeSleep ? (
        <ActiveMeasurement
          icon="sleep"
          title={PRODUCT_COPY.actions.sleepRunning}
          startedAtEpochMs={activeSleep.startedAt.instant.epochMs}
          nowEpochMs={nowEpochMs}
          compact={compact}
          stopLabel={PRODUCT_COPY.actions.endSleep}
          openLabel={PRODUCT_COPY.actions.sleepRunning}
          elapsedLabel={formatElapsedUnits(
            Math.max(0, nowEpochMs - activeSleep.startedAt.instant.epochMs),
          )}
          uncertaintyNote={uncertaintyNote}
          onOpen={() => setPanel('running')}
          onStop={requestStop}
        />
      ) : null}

      <CareActionSheet
        visible={panel === 'running' && activeSleep != null}
        title={PRODUCT_COPY.sheets.sleepRunning}
        onClose={() => setPanel('none')}
      >
        <LumiText tone="muted">
          Začátek {formatWallDateTime(activeSleep?.startedAt.instant.epochMs ?? 0, timeZone)}
        </LumiText>
        <LumiButton
          title={PRODUCT_COPY.actions.editStart}
          variant="secondary"
          fullWidth
          onPress={() => {
            setStartWall(
              formatWallDateTime(activeSleep?.startedAt.instant.epochMs ?? nowEpochMs, timeZone),
            );
            setPanel('editStart');
          }}
        />
        <LumiButton title={PRODUCT_COPY.actions.endSleep} fullWidth onPress={requestStop} />
      </CareActionSheet>

      <CareActionSheet
        visible={panel === 'forgotten'}
        title={PRODUCT_COPY.sheets.forgottenEnd}
        onClose={() => setPanel('none')}
      >
        <LumiButton
          title={PRODUCT_COPY.actions.stillRunning}
          variant="secondary"
          fullWidth
          onPress={() => setPanel('none')}
        />
        <LumiButton
          title={PRODUCT_COPY.actions.endNow}
          fullWidth
          onPress={() => void runEnd(services.clock.now().epochMs)}
        />
        <LumiButton
          title={PRODUCT_COPY.actions.endedEarlier}
          variant="ghost"
          fullWidth
          onPress={() => {
            setEndWall(formatWallDateTime(services.clock.now().epochMs, timeZone));
            setPanel('endedEarlier');
          }}
        />
      </CareActionSheet>

      <CareActionSheet
        visible={panel === 'editStart'}
        title={PRODUCT_COPY.actions.editStart}
        onClose={() => setPanel('none')}
        footer={<FormSaveButton onSave={() => void saveAdjustedStart()} pending={pending} />}
      >
        <FormSection title="Začátek spánku">
          <DateTimeField
            value={startWall}
            onChangeText={setStartWall}
            {...(timeError !== undefined ? { error: timeError } : {})}
          />
          <LumiChip
            label={PRODUCT_COPY.actions.approximate}
            selected={approximate}
            onPress={() => setApproximate((value) => !value)}
          />
        </FormSection>
      </CareActionSheet>

      <CareActionSheet
        visible={panel === 'endedEarlier'}
        title={PRODUCT_COPY.actions.endedEarlier}
        onClose={() => setPanel('none')}
        footer={<FormSaveButton onSave={() => void saveEndedEarlier()} pending={pending} />}
      >
        <FormSection title="Konec spánku">
          <DateTimeField
            value={endWall}
            onChangeText={setEndWall}
            {...(timeError !== undefined ? { error: timeError } : {})}
          />
          <NoteField value={note} onChangeText={setNote} />
          <LumiChip
            label={PRODUCT_COPY.actions.approximate}
            selected={approximate}
            onPress={() => setApproximate((value) => !value)}
          />
        </FormSection>
      </CareActionSheet>
    </View>
  );
}

/** One-tap start used by Today quick actions — no optimistic running UI. */
export function useSleepStarter(
  childId: ChildId | null,
  timeZone: TimeZoneId,
  activeSleep: ActiveSession | null,
) {
  const { services } = useCompositionRoot();
  const runtime = usePersonalRuntime();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const start = useCallback(async () => {
    if (!childId || pending) return { ok: false as const, alreadyRunning: Boolean(activeSleep) };
    if (activeSleep) return { ok: false as const, alreadyRunning: true as const };
    setPending(true);
    setMessage(null);
    const intentMs = services.clock.now().epochMs;
    const ids = mintSleepIds(services.ids);
    const result = await runtime.commands.dispatch(
      buildStartSleepCommand({
        ids,
        childId,
        startedAt: nowInZone(intentMs, timeZone),
        intentCapturedAtMs: intentMs,
        monotonicStartMs: captureMonotonicStartMs(),
      }),
    );
    setPending(false);
    if (!result.ok) {
      const already = result.error.details?.reason === 'active_session_exists';
      setMessage(already ? null : PRODUCT_COPY.feedback.saveFailed);
      return { ok: false as const, alreadyRunning: Boolean(already) };
    }
    setMessage(PRODUCT_COPY.feedback.sleepStarted);
    return { ok: true as const, alreadyRunning: false as const };
  }, [activeSleep, childId, pending, runtime.commands, services.clock, services.ids, timeZone]);

  return { start, pending, message, clearMessage: () => setMessage(null) };
}
