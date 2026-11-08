import React, { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { LumiButton, LumiChip, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import type { ActiveSession, ChildId, FeedingSide, TimeZoneId } from '../../domain';
import { asEntityId, asRevisionId, UNDO_WINDOW_MS } from '../../domain';
import { useCompositionRoot } from '../../app/providers';
import { usePersonalRuntime } from '../../app/session/BootstrapContext';
import {
  ActiveMeasurement,
  CareActionSheet,
  FormSaveButton,
  FormSection,
  NoteField,
  PRODUCT_COPY,
  SaveFeedback,
  useUndoWindow,
  type SaveFeedbackState,
} from '../ui';
import { formatElapsedUnits, sleepClockUncertainty } from './recordSleepIntent';
import {
  buildEndNursingCommand,
  buildPauseNursingCommand,
  buildResumeNursingCommand,
  buildStartNursingCommand,
  buildSwitchNursingSideCommand,
  buildUndoEndNursingCommand,
  captureMonotonicStartMs,
  mintFeedingIds,
  nowInZone,
  nursingElapsedMs,
  sideLabel,
} from './recordFeedingIntent';

type EndedSnapshot = {
  sessionId: string;
  eventId: string;
  careRevisionId: string;
  restoreStartedAtMs: number;
  restoreTimeZone: TimeZoneId;
  monotonicStartMs: number | null;
  restoreSide: FeedingSide | null;
};

export type NursingSessionControllerProps = {
  childId: ChildId;
  timeZone: TimeZoneId;
  activeNursing: ActiveSession | null;
  nowEpochMs: number;
  compact?: boolean;
  hideExpanded?: boolean;
  /** Fired only after a confirmed local commit — never for pending or failed writes. */
  onSavedLocally?: () => void;
};

/**
 * Durable nursing timer with pause, resume, and atomic side switch. Start lives
 * in `useNursingStarter` so the feeding panel can commit before chrome.
 */
export function NursingSessionController({
  childId,
  timeZone: _timeZone,
  activeNursing,
  nowEpochMs,
  compact = false,
  hideExpanded = false,
  onSavedLocally,
}: NursingSessionControllerProps) {
  void _timeZone;
  const { ui } = useLumiTheme();
  const { services } = useCompositionRoot();
  const runtime = usePersonalRuntime();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<SaveFeedbackState>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState<string | undefined>();
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [panel, setPanel] = useState<'none' | 'running'>('none');
  const [note, setNote] = useState('');
  const [ended, setEnded] = useState<EndedSnapshot | null>(null);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const endRetry = useRef<null | (() => Promise<void>)>(null);
  const runEndRef = useRef<(endedAtMs: number) => Promise<void>>(async () => {});
  const endIds = useRef<ReturnType<typeof mintFeedingIds> | null>(null);
  const intendedEndMs = useRef<number | null>(null);

  useUndoWindow(undoAvailable, UNDO_WINDOW_MS, () => setUndoAvailable(false));

  const uncertainty =
    activeNursing && activeNursing.status === 'running'
      ? sleepClockUncertainty({
          startedAtMs: activeNursing.startedAt.instant.epochMs,
          nowMs: nowEpochMs,
          monotonicStartMs: activeNursing.monotonicStartMs,
        })
      : 'ok';

  const uncertaintyNote =
    uncertainty === 'clock_moved_back'
      ? PRODUCT_COPY.feedback.clockMovedBack
      : uncertainty === 'monotonic_lost' && activeNursing
        ? PRODUCT_COPY.feedback.monotonicLost
        : null;

  const elapsedMs = activeNursing
    ? nursingElapsedMs({
        status: activeNursing.status === 'paused' ? 'paused' : 'running',
        activeSegments: activeNursing.activeSegments,
        ...(activeNursing.status === 'running'
          ? { currentSegmentStartedAtMs: activeNursing.currentSegmentStartedAtMs }
          : {}),
        nowMs: nowEpochMs,
      })
    : 0;

  const runEnd = useCallback(
    async (endedAtMs: number) => {
      if (!activeNursing) return;
      if (!endIds.current) endIds.current = mintFeedingIds(services.ids);
      if (intendedEndMs.current == null) intendedEndMs.current = endedAtMs;
      const frozenEnd = intendedEndMs.current;
      const ids = endIds.current;
      const command = buildEndNursingCommand({
        operationId: ids.operationId,
        revisionId: ids.revisionId,
        sessionId: activeNursing.sessionId,
        eventId: ids.eventId,
        careRevisionId: ids.careRevisionId,
        childId,
        intendedEndedAt: nowInZone(frozenEnd, activeNursing.startedAt.timeZone),
        intentCapturedAtMs: frozenEnd,
        note: note || null,
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
        sessionId: activeNursing.sessionId,
        eventId: ids.eventId,
        careRevisionId: result.revisionIds[1] ?? ids.careRevisionId,
        restoreStartedAtMs: activeNursing.startedAt.instant.epochMs,
        restoreTimeZone: activeNursing.startedAt.timeZone,
        monotonicStartMs: activeNursing.monotonicStartMs,
        restoreSide: activeNursing.side,
      });
      setUndoAvailable(result.undo?.kind === 'undoEndNursing');
      setFeedback('saved');
      onSavedLocally?.();
      setFeedbackMessage(PRODUCT_COPY.feedback.nursingEnded);
      setPanel('none');
      setRetryAvailable(false);
      intendedEndMs.current = null;
      endIds.current = null;
    },
    [activeNursing, childId, note, onSavedLocally, runtime.commands, services.ids],
  );

  React.useEffect(() => {
    runEndRef.current = runEnd;
  }, [runEnd]);

  async function onPause() {
    if (!activeNursing || activeNursing.status !== 'running') return;
    setPending(true);
    const intentMs = services.clock.now().epochMs;
    const ids = mintFeedingIds(services.ids);
    const result = await runtime.commands.dispatch(
      buildPauseNursingCommand({
        ids,
        childId,
        sessionId: activeNursing.sessionId,
        pausedAt: nowInZone(intentMs, activeNursing.startedAt.timeZone),
        intentCapturedAtMs: intentMs,
      }),
    );
    setPending(false);
    if (!result.ok) {
      setFeedback('error');
      setFeedbackMessage(PRODUCT_COPY.feedback.saveFailed);
    }
  }

  async function onResume() {
    if (!activeNursing || activeNursing.status !== 'paused') return;
    setPending(true);
    const intentMs = services.clock.now().epochMs;
    const ids = mintFeedingIds(services.ids);
    const result = await runtime.commands.dispatch(
      buildResumeNursingCommand({
        ids,
        childId,
        sessionId: activeNursing.sessionId,
        resumedAt: nowInZone(intentMs, activeNursing.startedAt.timeZone),
        intentCapturedAtMs: intentMs,
      }),
    );
    setPending(false);
    if (!result.ok) {
      setFeedback('error');
      setFeedbackMessage(PRODUCT_COPY.feedback.saveFailed);
    }
  }

  async function onSwitchSide(side: FeedingSide) {
    if (!activeNursing || activeNursing.status !== 'running') return;
    setPending(true);
    const intentMs = services.clock.now().epochMs;
    const ids = mintFeedingIds(services.ids);
    const result = await runtime.commands.dispatch(
      buildSwitchNursingSideCommand({
        ids,
        childId,
        sessionId: activeNursing.sessionId,
        switchedAt: nowInZone(intentMs, activeNursing.startedAt.timeZone),
        side,
        intentCapturedAtMs: intentMs,
      }),
    );
    setPending(false);
    if (!result.ok) {
      setFeedback('error');
      setFeedbackMessage(PRODUCT_COPY.feedback.saveFailed);
    }
  }

  async function onUndoEnd() {
    if (!ended || !undoAvailable) return;
    const ids = mintFeedingIds(services.ids);
    const result = await runtime.commands.dispatch(
      buildUndoEndNursingCommand({
        ids,
        childId,
        sessionId: asEntityId(ended.sessionId),
        eventId: asEntityId(ended.eventId),
        expectedCareRevisionId: asRevisionId(ended.careRevisionId),
        restoreStartedAt: nowInZone(ended.restoreStartedAtMs, ended.restoreTimeZone),
        monotonicStartMs: ended.monotonicStartMs,
        restoreSide: ended.restoreSide,
        intentCapturedAtMs: services.clock.now().epochMs,
      }),
    );
    if (!result.ok) {
      setFeedback('error');
      setFeedbackMessage(
        result.error.details?.reason === 'active_session_exists'
          ? 'Mezitím běží jiné kojení. Původní dokončený záznam necháváme.'
          : PRODUCT_COPY.feedback.saveFailed,
      );
      return;
    }
    setUndoAvailable(false);
    setEnded(null);
    setFeedback('idle');
  }

  const showExpanded = Boolean(activeNursing) && !hideExpanded;
  const title =
    activeNursing?.status === 'paused'
      ? PRODUCT_COPY.actions.nursingPaused
      : PRODUCT_COPY.actions.nursingRunning;

  return (
    <View style={{ gap: ui.space.sm }}>
      <SaveFeedback
        state={feedback}
        {...(feedbackMessage !== undefined ? { message: feedbackMessage } : {})}
        undoAvailable={undoAvailable}
        onUndo={() => void onUndoEnd()}
      />
      {feedback === 'error' && retryAvailable ? (
        <FormSaveButton
          label={PRODUCT_COPY.actions.retry}
          onSave={() => endRetry.current?.()}
          pending={pending}
        />
      ) : null}

      {showExpanded && activeNursing ? (
        <ActiveMeasurement
          title={title}
          startedAtEpochMs={activeNursing.startedAt.instant.epochMs}
          nowEpochMs={nowEpochMs}
          compact={compact}
          stopLabel={PRODUCT_COPY.actions.endNursing}
          openLabel={title}
          elapsedLabel={formatElapsedUnits(elapsedMs)}
          uncertaintyNote={uncertaintyNote}
          onOpen={() => setPanel('running')}
          onStop={() => void runEnd(services.clock.now().epochMs)}
        />
      ) : null}

      <CareActionSheet
        visible={panel === 'running' && activeNursing != null}
        title={title}
        onClose={() => setPanel('none')}
      >
        <LumiText tone="muted">
          {sideLabel(activeNursing?.side)} · aktivní {formatElapsedUnits(elapsedMs)}
        </LumiText>
        <FormSection title={PRODUCT_COPY.fields.side}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ui.space.sm }}>
            {(['left', 'right', 'unspecified'] as const).map((side) => (
              <LumiChip
                key={side}
                label={sideLabel(side)}
                selected={activeNursing?.side === side}
                disabled={activeNursing?.status !== 'running' || pending}
                onPress={() => void onSwitchSide(side)}
              />
            ))}
          </View>
        </FormSection>
        {activeNursing?.status === 'running' ? (
          <LumiButton
            title={PRODUCT_COPY.actions.pauseNursing}
            variant="secondary"
            fullWidth
            disabled={pending}
            onPress={() => void onPause()}
          />
        ) : (
          <LumiButton
            title={PRODUCT_COPY.actions.resumeNursing}
            variant="secondary"
            fullWidth
            disabled={pending}
            onPress={() => void onResume()}
          />
        )}
        <NoteField value={note} onChangeText={setNote} />
        <LumiButton
          title={PRODUCT_COPY.actions.endNursing}
          fullWidth
          disabled={pending}
          onPress={() => void runEnd(services.clock.now().epochMs)}
        />
      </CareActionSheet>
    </View>
  );
}

/** One-tap nursing start — side optional; never invents a preferred breast. */
export function useNursingStarter(
  childId: ChildId | null,
  timeZone: TimeZoneId,
  activeNursing: ActiveSession | null,
) {
  const { services } = useCompositionRoot();
  const runtime = usePersonalRuntime();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const start = useCallback(
    async (side?: FeedingSide | null) => {
      if (!childId || pending) return { ok: false as const, alreadyRunning: Boolean(activeNursing) };
      if (activeNursing) return { ok: false as const, alreadyRunning: true as const };
      setPending(true);
      setMessage(null);
      const intentMs = services.clock.now().epochMs;
      const ids = mintFeedingIds(services.ids);
      const result = await runtime.commands.dispatch(
        buildStartNursingCommand({
          ids,
          childId,
          startedAt: nowInZone(intentMs, timeZone),
          intentCapturedAtMs: intentMs,
          monotonicStartMs: captureMonotonicStartMs(),
          ...(side !== undefined ? { side } : {}),
        }),
      );
      setPending(false);
      if (!result.ok) {
        const already = result.error.details?.reason === 'active_session_exists';
        setMessage(already ? null : PRODUCT_COPY.feedback.saveFailed);
        return { ok: false as const, alreadyRunning: Boolean(already) };
      }
      setMessage(PRODUCT_COPY.feedback.nursingStarted);
      return { ok: true as const, alreadyRunning: false as const };
    },
    [activeNursing, childId, pending, runtime.commands, services.clock, services.ids, timeZone],
  );

  return { start, pending, message, clearMessage: () => setMessage(null) };
}
