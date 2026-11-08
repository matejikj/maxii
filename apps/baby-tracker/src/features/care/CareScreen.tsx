import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LumiButton, LumiChip, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import {
  asEntityId,
  asOperationId,
  asRevisionId,
  asTimeZoneId,
  sleepOccurrenceFromInterval,
  sleepOccurrenceWithoutDuration,
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

/**
 * Care tab hosts past / no-duration sleep writes. Live timers stay on Today and
 * the compact strip — not duplicated here as a second expanded measurement.
 */
export function CareScreen() {
  const { colors, ui } = useLumiTheme();
  const { profile } = useBootstrap();
  const runtime = usePersonalRuntime();
  const { services } = useCompositionRoot();
  const zone = asTimeZoneId(profile?.settings.summaryTimeZone ?? 'Europe/Prague');
  const childId = profile?.childId ?? null;
  const [sheet, setSheet] = useState<'none' | 'past' | 'noduration'>('none');
  const [startWall, setStartWall] = useState('');
  const [endWall, setEndWall] = useState('');
  const [observedWall, setObservedWall] = useState('');
  const [note, setNote] = useState('');
  const [approximate, setApproximate] = useState(false);
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

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, { gap: ui.space.md }]}>
        <LumiText variant="h1" accessibilityRole="header">
          Péče
        </LumiText>
        <LumiText tone="muted">
          Minulý spánek a zápis bez délky. Probíhající měření zůstává na Dnes.
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 24, maxWidth: 600, width: '100%', alignSelf: 'center' },
});
