import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LumiButton,
  LumiCard,
  LumiChip,
  LumiInput,
  LumiText,
  useLumiTheme,
} from '@lumi/forest-design/native';
import {
  UNDO_WINDOW_MS,
  asEntityId,
  asOperationId,
  asRevisionId,
  asTimeZoneId,
  buildAuthorshipLine,
  buildSyncTransferPresentation,
  type CareEvent,
  type DiaperContents,
} from '../../domain';
import { isOpaqueEntityId } from '../../app/navigation/linking';
import {
  resolveRemoteServicesBoundary,
  shouldInitializeRemoteClients,
} from '../../app/remoteServicesBoundary';
import { useBootstrap, usePersonalRuntime } from '../../app/session/BootstrapContext';
import { useCompositionRoot } from '../../app/providers';
import { presentCareEvent } from '../today/carePresentation';
import { RecordProvenanceBlock } from '../family/RecordProvenanceBlock';
import { PRODUCT_COPY, SaveFeedback, useUndoWindow, type SaveFeedbackState } from '../ui';
import { buildEditCareCommand } from './buildEditCareCommand';

type EventDetailScreenProps = {
  eventId: string | undefined;
  onClose: () => void;
};

/**
 * Deep-linked detail with edit/delete against the live revision. Unknown or
 * non-opaque ids show an empty safe state without leaking path contents.
 */
export function EventDetailScreen({ eventId, onClose }: EventDetailScreenProps) {
  const { colors, ui } = useLumiTheme();
  const { profile } = useBootstrap();
  const runtime = usePersonalRuntime();
  const { services } = useCompositionRoot();
  const zone = asTimeZoneId(profile?.settings.summaryTimeZone ?? 'Europe/Prague');
  const valid = eventId != null && isOpaqueEntityId(eventId);
  const [event, setEvent] = useState<CareEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState('');
  const [note, setNote] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contents, setContents] = useState<DiaperContents>('wet');
  const [feedback, setFeedback] = useState<SaveFeedbackState>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState<string | undefined>();
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [pendingDeletionId, setPendingDeletionId] = useState<string | null>(null);
  const [pendingDeletionRevisionId, setPendingDeletionRevisionId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (!valid || !eventId) {
        setEvent(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      void runtime.unitOfWork
        .run((uow) => uow.care.getById(asEntityId(eventId)))
        .then((row) => {
          if (cancelled) return;
          setEvent(row);
          if (row) {
            setNote(row.note ?? '');
            if (row.type === 'note' || row.type === 'milestone') setBody(row.body);
            if (row.type === 'experience') setTitle(row.title ?? '');
            if (row.type === 'food') setDescription(row.description);
            if (row.type === 'diaper') setContents(row.contents);
          }
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setEvent(null);
          setLoading(false);
        });
    });
    const unsubscribe = runtime.readModels.subscribe((topics) => {
      if (topics.includes('care') || topics.includes('revisions')) {
        setReloadToken((token) => token + 1);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [eventId, reloadToken, runtime.readModels, runtime.unitOfWork, valid]);

  async function reload() {
    setReloadToken((token) => token + 1);
  }

  useUndoWindow(undoAvailable, UNDO_WINDOW_MS, () => setUndoAvailable(false));

  const presentation = event ? presentCareEvent(event, zone) : null;
  const boundary = useMemo(() => resolveRemoteServicesBoundary(), []);
  const familySyncOn =
    shouldInitializeRemoteClients(boundary) && boundary.syncConfigured;
  const authorship = useMemo(() => {
    if (!event) return null;
    const transfer = familySyncOn
      ? buildSyncTransferPresentation({
          pendingTransferCount: 0,
          inFlight: false,
          lastSuccessfulSyncAt: null,
        })
      : null;
    return buildAuthorshipLine({
      originalAuthorLabel: event.recordedBy ? String(event.recordedBy) : 'Toto zařízení',
      lastEditorLabel: null,
      transfer,
      lastSuccessfulSyncAtLabel: null,
    });
  }, [event, familySyncOn]);

  async function saveEdit() {
    if (!event) return;
    const intentMs = services.clock.now().epochMs;
    const command = buildEditCareCommand({
      event,
      expectedRevisionId: event.revisionId,
      operationId: asOperationId(services.ids.createId('op')),
      revisionId: asRevisionId(services.ids.createId('rev')),
      intentCapturedAtMs: intentMs,
      patch: {
        body,
        note: note.trim() ? note : null,
        title: title.trim() ? title : null,
        description,
        contents,
      },
    });
    setFeedback('pending');
    const result = await runtime.commands.dispatch(command);
    if (!result.ok) {
      setFeedback('error');
      setFeedbackMessage(PRODUCT_COPY.feedback.saveFailed);
      return;
    }
    setFeedback('saved');
    setFeedbackMessage(PRODUCT_COPY.feedback.editSaved);
    setEditing(false);
    await reload();
  }

  function confirmDelete() {
    if (!event || !presentation) return;
    Alert.alert(
      PRODUCT_COPY.actions.delete,
      `${PRODUCT_COPY.feedback.deleteConfirmPrefix} „${presentation.title}“?`,
      [
        { text: PRODUCT_COPY.actions.close, style: 'cancel' },
        {
          text: PRODUCT_COPY.actions.delete,
          style: 'destructive',
          onPress: () => void runDelete(),
        },
      ],
    );
  }

  async function runDelete() {
    if (!event) return;
    const intentMs = services.clock.now().epochMs;
    const deletionId = asEntityId(services.ids.createId('del'));
    const revisionId = asRevisionId(services.ids.createId('rev'));
    setFeedback('pending');
    const result = await runtime.commands.dispatch({
      type: 'softDeleteCare',
      operationId: asOperationId(services.ids.createId('op')),
      intentCapturedAt: { epochMs: intentMs },
      eventId: event.eventId,
      deletionId,
      revisionId,
    });
    if (!result.ok) {
      setFeedback('error');
      setFeedbackMessage(PRODUCT_COPY.feedback.saveFailed);
      return;
    }
    setPendingDeletionId(deletionId);
    setPendingDeletionRevisionId(revisionId);
    setUndoAvailable(true);
    setFeedback('saved');
    setFeedbackMessage(PRODUCT_COPY.feedback.deletedNamed);
    setEvent(null);
  }

  async function undoDelete() {
    if (!eventId || !pendingDeletionId || !pendingDeletionRevisionId) return;
    const intentMs = services.clock.now().epochMs;
    const result = await runtime.commands.dispatch({
      type: 'undoSoftDelete',
      operationId: asOperationId(services.ids.createId('op')),
      intentCapturedAt: { epochMs: intentMs },
      eventId: asEntityId(eventId),
      deletionId: asEntityId(pendingDeletionId),
      expectedDeletionRevisionId: asRevisionId(pendingDeletionRevisionId),
      revisionId: asRevisionId(services.ids.createId('rev')),
    });
    setUndoAvailable(false);
    setPendingDeletionId(null);
    setPendingDeletionRevisionId(null);
    if (!result.ok) {
      setFeedback('error');
      setFeedbackMessage(PRODUCT_COPY.feedback.saveFailed);
      return;
    }
    setFeedback('saved');
    setFeedbackMessage(PRODUCT_COPY.feedback.restored);
    await reload();
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.content, { gap: ui.space.md }]}>
        <LumiText variant="h1" accessibilityRole="header">
          Detail záznamu
        </LumiText>
        <LumiCard>
          {!valid ? (
            <LumiText tone="muted">
              Odkaz je neplatný. V adrese smí být jen neprůhledné ID, nikoli jméno nebo poznámka.
            </LumiText>
          ) : loading ? (
            <LumiText tone="muted">Načítám záznam…</LumiText>
          ) : presentation && event ? (
            <View style={{ gap: ui.space.sm }}>
              <LumiText variant="h2">{presentation.title}</LumiText>
              <LumiText>{presentation.detail}</LumiText>
              {event.type === 'sleep' || event.type === 'nursing' ? (
                <LumiText tone="muted">
                  {event.occurrence.kind === 'known'
                    ? `Přesnost: známý interval (${event.occurrence.start.precision} → ${event.occurrence.end.precision})`
                    : `Přesnost: ${event.occurrence.observedAt.precision}; konec neznámý`}
                </LumiText>
              ) : null}
              {event.type === 'note' || event.type === 'milestone' ? (
                <LumiText>{event.body}</LumiText>
              ) : null}
              {event.type === 'experience' ? (
                <>
                  {event.title ? <LumiText>{event.title}</LumiText> : null}
                  {event.area ? <LumiText tone="muted">Oblast: {event.area}</LumiText> : null}
                  {event.note ? <LumiText>{event.note}</LumiText> : null}
                </>
              ) : null}
              {event.type === 'growth' ? (
                <LumiText tone="muted">
                  {[
                    event.weightKg != null ? `${event.weightKg} kg` : null,
                    event.lengthCm != null ? `${event.lengthCm} cm` : null,
                    event.headCm != null ? `hlava ${event.headCm} cm` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Bez doplňujících hodnot'}
                </LumiText>
              ) : null}
              {event.note && event.type !== 'experience' ? (
                <LumiText tone="muted">{event.note}</LumiText>
              ) : null}
              {authorship ? <RecordProvenanceBlock authorship={authorship} /> : null}

              {editing ? (
                <View style={{ gap: ui.space.sm }}>
                  {event.type === 'note' || event.type === 'milestone' ? (
                    <LumiInput
                      label={PRODUCT_COPY.fields.noteBody}
                      accessibilityLabel={PRODUCT_COPY.fields.noteBody}
                      value={body}
                      onChangeText={setBody}
                      multiline
                    />
                  ) : null}
                  {event.type === 'experience' ? (
                    <LumiInput
                      label={PRODUCT_COPY.fields.experienceTitle}
                      accessibilityLabel={PRODUCT_COPY.fields.experienceTitle}
                      value={title}
                      onChangeText={setTitle}
                    />
                  ) : null}
                  {event.type === 'food' ? (
                    <LumiInput
                      label={PRODUCT_COPY.fields.foodDescription}
                      accessibilityLabel={PRODUCT_COPY.fields.foodDescription}
                      value={description}
                      onChangeText={setDescription}
                    />
                  ) : null}
                  {event.type === 'diaper' ? (
                    <View style={styles.chips}>
                      {(
                        [
                          ['wet', 'Mokrá'],
                          ['dirty', 'Stolice'],
                          ['both', 'Obojí'],
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
                  ) : null}
                  <LumiInput
                    label={PRODUCT_COPY.fields.optionalNote}
                    accessibilityLabel={PRODUCT_COPY.fields.optionalNote}
                    value={note}
                    onChangeText={setNote}
                    multiline
                  />
                  <LumiButton title={PRODUCT_COPY.actions.save} onPress={() => void saveEdit()} fullWidth />
                </View>
              ) : null}
            </View>
          ) : (
            <LumiText tone="muted">
              Záznam s tímto identifikátorem zatím není v místním deníku, nebo ještě nebyl načten.
            </LumiText>
          )}
        </LumiCard>

        <SaveFeedback
          state={feedback}
          {...(feedbackMessage != null ? { message: feedbackMessage } : {})}
          undoAvailable={undoAvailable}
          onUndo={() => void undoDelete()}
        />

        {event && !editing ? (
          <View style={styles.actions}>
            <LumiButton title={PRODUCT_COPY.actions.edit} onPress={() => setEditing(true)} fullWidth />
            <LumiButton title={PRODUCT_COPY.actions.delete} onPress={confirmDelete} fullWidth />
          </View>
        ) : null}

        <LumiButton title="Zpět" onPress={onClose} fullWidth />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 24, maxWidth: 600, width: '100%', alignSelf: 'center' },
  actions: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
