import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LumiButton, LumiCard, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import {
  asEntityId,
  asTimeZoneId,
  type CareEvent,
} from '../../domain';
import { isOpaqueEntityId } from '../../app/navigation/linking';
import { useBootstrap, usePersonalRuntime } from '../../app/session/BootstrapContext';
import { presentCareEvent } from '../today/carePresentation';

type EventDetailScreenProps = {
  eventId: string | undefined;
  onClose: () => void;
};

/**
 * Deep-linked detail. Unknown or non-opaque ids show an empty safe state without
 * leaking path contents into logs or secondary storage.
 */
export function EventDetailScreen({ eventId, onClose }: EventDetailScreenProps) {
  const { colors, ui } = useLumiTheme();
  const { profile } = useBootstrap();
  const runtime = usePersonalRuntime();
  const zone = asTimeZoneId(profile?.settings.summaryTimeZone ?? 'Europe/Prague');
  const valid = eventId != null && isOpaqueEntityId(eventId);
  const [event, setEvent] = useState<CareEvent | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!valid || !eventId) {
      return;
    }
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      void runtime.unitOfWork
        .run((uow) => uow.care.getById(asEntityId(eventId)))
        .then((row) => {
          if (!cancelled) {
            setEvent(row);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setEvent(null);
            setLoading(false);
          }
        });
    });
    return () => {
      cancelled = true;
    };
  }, [eventId, runtime.unitOfWork, valid]);

  const presentation = event ? presentCareEvent(event, zone) : null;

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
          ) : presentation ? (
            <View style={{ gap: ui.space.sm }}>
              <LumiText variant="h2">{presentation.title}</LumiText>
              <LumiText>{presentation.detail}</LumiText>
              {event?.type === 'note' || event?.type === 'milestone' ? (
                <LumiText>{event.body}</LumiText>
              ) : null}
              {event?.type === 'experience' && event.note ? (
                <LumiText>{event.note}</LumiText>
              ) : null}
              {event?.type === 'growth' ? (
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
            </View>
          ) : (
            <LumiText tone="muted">
              Záznam s tímto identifikátorem zatím není v místním deníku, nebo ještě nebyl načten.
            </LumiText>
          )}
        </LumiCard>
        <LumiButton title="Zpět" onPress={onClose} fullWidth />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 24, maxWidth: 600, width: '100%', alignSelf: 'center' },
});
