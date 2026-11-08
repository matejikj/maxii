import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LumiButton, LumiCard, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import { isOpaqueEntityId } from '../../app/navigation/linking';

type EventDetailScreenProps = {
  eventId: string | undefined;
  onClose: () => void;
};

/**
 * Deep-linked detail. Unknown or non-opaque ids show an empty safe state without
 * leaking path contents into logs or secondary storage.
 */
export function EventDetailScreen({ eventId, onClose }: EventDetailScreenProps) {
  const { colors } = useLumiTheme();
  const valid = eventId != null && isOpaqueEntityId(eventId);
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <LumiText variant="h1" accessibilityRole="header">
          Detail záznamu
        </LumiText>
        <LumiCard>
          {valid ? (
            <LumiText tone="muted">
              Záznam s tímto identifikátorem zatím není v místním deníku, nebo ještě nebyl načten.
            </LumiText>
          ) : (
            <LumiText tone="muted">
              Odkaz je neplatný. V adrese smí být jen neprůhledné ID, nikoli jméno nebo poznámka.
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
  content: { padding: 24, gap: 16, maxWidth: 600, width: '100%', alignSelf: 'center' },
});
