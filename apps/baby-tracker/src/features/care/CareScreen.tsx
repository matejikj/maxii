import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LumiButton, LumiChip, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import {
  asEntityId,
  asOperationId,
  asRevisionId,
  asTimeZoneId,
  sleepOccurrenceFromInterval,
  sleepOccurrenceWithoutDuration,
  type FeedingSide,
} from '../../domain';
import { useBootstrap, usePersonalRuntime } from '../../app/session/BootstrapContext';
import { useCompositionRoot } from '../../app/providers';
import {
  CareActionSheet,
  DateTimeField,
  FormSaveButton,
  FormSection,
  NoteField,
  PRODUCT_COPY,
  SaveFeedback,
  type SaveFeedbackState,
} from '../ui';
import { formatWallDateTime, parseWallDateTime } from '../today/recordDiaperIntent';
import {
  buildRecordNursingNoDurationCommand,
  buildRecordNursingPastCommand,
  mintFeedingIds,
  sideLabel,
} from '../today/recordFeedingIntent';

/**
 * Care tab hosts past / no-duration sleep and nursing writes. Live timers stay
 * on Today and the compact strip — not duplicated here as a second measurement.
 */
export function CareScreen() {
  const { colors, ui } = useLumiTheme();
  const { profile } = useBootstrap();
  const runtime = usePersonalRuntime();
  const { services } = useCompositionRoot();
  const zone = asTimeZoneId(profile?.settings.summaryTimeZone ?? 'Europe/Prague');
  const childId = profile?.childId ?? null;
  const [sheet, setSheet] = useState<
    'none' | 'past' | 'noduration' | 'nursingPast' | 'nursingNoDuration'
  >('none');
  const [startWall, setStartWall] = useState('');
  const [endWall, setEndWall] = useState('');
  const [observedWall, setObservedWall] = useState('');
  const [note, setNote] = useState('');
  const [approximate, setApproximate] = useState(false);
  const [side, setSide] = useState<FeedingSide>('unspecified');
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<SaveFeedbackState>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState<string | undefined>();

  function openPast() {
    const now = formatWallDateTime(services.clock.now().epochMs, zone);
    setStartWall(now);
    setEndWall(now);
    setSheet('past');
  }

  function openNoDuration() {
    setObservedWall(formatWallDateTime(services.clock.now().epochMs, zone));
    setSheet('noduration');
  }

  function openNursingPast() {
    const now = formatWallDateTime(services.clock.now().epochMs, zone);
    setStartWall(now);
    setEndWall(now);
    setSide('unspecified');
    setSheet('nursingPast');
  }

  function openNursingNoDuration() {
    setObservedWall(formatWallDateTime(services.clock.now().epochMs, zone));
    setSide('unspecified');
    setSheet('nursingNoDuration');
  }

  async function savePast() {
    if (!childId) return;
    const start = parseWallDateTime(startWall, zone);
    const end = parseWallDateTime(endWall, zone);
    if (!start.ok) {
      setError(start.message);
      return;
    }
    if (!end.ok) {
      setError(end.message);
      return;
    }
    if (end.occurredAt.instant.epochMs < start.occurredAt.instant.epochMs) {
      setError('Konec nemůže být dříve než začátek.');
      return;
    }
    setError(undefined);
    setPending(true);
    setFeedback('pending');
    const intentMs = services.clock.now().epochMs;
    const result = await runtime.commands.dispatch({
      type: 'recordSleep',
      operationId: asOperationId(services.ids.createId('op')),
      intentCapturedAt: { epochMs: intentMs },
      eventId: asEntityId(services.ids.createId('evt')),
      revisionId: asRevisionId(services.ids.createId('rev')),
      childId,
      occurrence: sleepOccurrenceFromInterval(start.occurredAt, end.occurredAt),
      note: note
        ? `${approximate ? `[${PRODUCT_COPY.actions.approximate}] ` : ''}${note}`
        : approximate
          ? `[${PRODUCT_COPY.actions.approximate}]`
          : null,
    });
    setPending(false);
    if (!result.ok) {
      setFeedback('error');
      setFeedbackMessage(PRODUCT_COPY.feedback.saveFailed);
      return;
    }
    setFeedback('saved');
    setFeedbackMessage(PRODUCT_COPY.feedback.sleepEnded);
    setSheet('none');
  }

  async function saveNoDuration() {
    if (!childId) return;
    const observed = parseWallDateTime(observedWall, zone);
    if (!observed.ok) {
      setError(observed.message);
      return;
    }
    setError(undefined);
    setPending(true);
    setFeedback('pending');
    const intentMs = services.clock.now().epochMs;
    const result = await runtime.commands.dispatch({
      type: 'recordSleep',
      operationId: asOperationId(services.ids.createId('op')),
      intentCapturedAt: { epochMs: intentMs },
      eventId: asEntityId(services.ids.createId('evt')),
      revisionId: asRevisionId(services.ids.createId('rev')),
      childId,
      occurrence: sleepOccurrenceWithoutDuration(observed.occurredAt),
      note: note || null,
    });
    setPending(false);
    if (!result.ok) {
      setFeedback('error');
      setFeedbackMessage(PRODUCT_COPY.feedback.saveFailed);
      return;
    }
    setFeedback('saved');
    setFeedbackMessage(PRODUCT_COPY.feedback.savedLocally);
    setSheet('none');
  }

  async function saveNursingPast() {
    if (!childId) return;
    const start = parseWallDateTime(startWall, zone);
    const end = parseWallDateTime(endWall, zone);
    if (!start.ok) {
      setError(start.message);
      return;
    }
    if (!end.ok) {
      setError(end.message);
      return;
    }
    if (end.occurredAt.instant.epochMs < start.occurredAt.instant.epochMs) {
      setError('Konec nemůže být dříve než začátek.');
      return;
    }
    setError(undefined);
    setPending(true);
    setFeedback('pending');
    const intentMs = services.clock.now().epochMs;
    const ids = mintFeedingIds(services.ids);
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
    setFeedback('saved');
    setFeedbackMessage(PRODUCT_COPY.feedback.nursingEnded);
    setSheet('none');
  }

  async function saveNursingNoDuration() {
    if (!childId) return;
    const observed = parseWallDateTime(observedWall, zone);
    if (!observed.ok) {
      setError(observed.message);
      return;
    }
    setError(undefined);
    setPending(true);
    setFeedback('pending');
    const intentMs = services.clock.now().epochMs;
    const ids = mintFeedingIds(services.ids);
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
    setFeedback('saved');
    setFeedbackMessage(PRODUCT_COPY.feedback.savedLocally);
    setSheet('none');
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, { gap: ui.space.md }]}>
        <LumiText variant="h1" accessibilityRole="header">
          Péče
        </LumiText>
        <LumiText tone="muted">
          Minulý spánek a kojení bez běžícího timeru. Probíhající měření zůstává na Dnes.
        </LumiText>
        <SaveFeedback
          state={feedback}
          {...(feedbackMessage !== undefined ? { message: feedbackMessage } : {})}
        />
        <LumiButton
          title={PRODUCT_COPY.actions.recordPastSleep}
          fullWidth
          onPress={openPast}
          testID="care-past-sleep"
        />
        <LumiButton
          title={PRODUCT_COPY.actions.recordSleepNoDuration}
          variant="secondary"
          fullWidth
          onPress={openNoDuration}
        />
        <LumiButton
          title={PRODUCT_COPY.actions.recordPastNursing}
          variant="secondary"
          fullWidth
          onPress={openNursingPast}
          testID="care-past-nursing"
        />
        <LumiButton
          title={PRODUCT_COPY.actions.recordNursingNoDuration}
          variant="ghost"
          fullWidth
          onPress={openNursingNoDuration}
        />
      </ScrollView>

      <CareActionSheet
        visible={sheet === 'past'}
        title={PRODUCT_COPY.actions.recordPastSleep}
        onClose={() => setSheet('none')}
        footer={<FormSaveButton onSave={() => void savePast()} pending={pending} />}
      >
        <FormSection title="Interval">
          <DateTimeField
            label="Začátek"
            value={startWall}
            onChangeText={setStartWall}
            {...(error !== undefined ? { error } : {})}
          />
          <DateTimeField label="Konec" value={endWall} onChangeText={setEndWall} />
          <NoteField value={note} onChangeText={setNote} />
          <LumiChip
            label={PRODUCT_COPY.actions.approximate}
            selected={approximate}
            onPress={() => setApproximate((value) => !value)}
          />
        </FormSection>
      </CareActionSheet>

      <CareActionSheet
        visible={sheet === 'noduration'}
        title={PRODUCT_COPY.actions.recordSleepNoDuration}
        onClose={() => setSheet('none')}
        footer={<FormSaveButton onSave={() => void saveNoDuration()} pending={pending} />}
      >
        <FormSection
          title="Pozorování"
          description="Dokončený zápis bez délky — ne běžící timer a ne nula minut."
        >
          <DateTimeField
            label="Čas pozorování"
            value={observedWall}
            onChangeText={setObservedWall}
            {...(error !== undefined ? { error } : {})}
          />
          <NoteField value={note} onChangeText={setNote} />
        </FormSection>
      </CareActionSheet>

      <CareActionSheet
        visible={sheet === 'nursingPast'}
        title={PRODUCT_COPY.actions.recordPastNursing}
        onClose={() => setSheet('none')}
        footer={<FormSaveButton onSave={() => void saveNursingPast()} pending={pending} />}
      >
        <FormSection title="Interval">
          <DateTimeField
            label="Začátek"
            value={startWall}
            onChangeText={setStartWall}
            {...(error !== undefined ? { error } : {})}
          />
          <DateTimeField label="Konec" value={endWall} onChangeText={setEndWall} />
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

      <CareActionSheet
        visible={sheet === 'nursingNoDuration'}
        title={PRODUCT_COPY.actions.recordNursingNoDuration}
        onClose={() => setSheet('none')}
        footer={<FormSaveButton onSave={() => void saveNursingNoDuration()} pending={pending} />}
      >
        <FormSection
          title="Pozorování"
          description="Dokončený zápis bez délky — ne běžící timer a ne nula minut."
        >
          <DateTimeField
            label="Čas pozorování"
            value={observedWall}
            onChangeText={setObservedWall}
            {...(error !== undefined ? { error } : {})}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 24, maxWidth: 600, width: '100%', alignSelf: 'center' },
});
