import React from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LumiButton,
  LumiCard,
  LumiCharacter,
  LumiEmptyState,
  LumiText,
  useLumiTheme,
} from '@lumi/forest-design/native';
import { useBootstrap } from '../../app/session/BootstrapContext';
import { useHistoryTabState } from '../../app/session/HistoryTabContext';
import {
  formatIsoCalendarDate,
} from '../../app/navigation/historyTabState';
import { useCompositionRoot } from '../../app/providers';

type TodayScreenProps = {
  onOpenProfile: () => void;
  onOpenHistoryToday: () => void;
};

/**
 * Personal Today shell: header with child avatar entry, empty care area ready
 * for later quick actions, and a direct path to today's History without filters.
 */
export function TodayScreen({ onOpenProfile, onOpenHistoryToday }: TodayScreenProps) {
  const { colors, mode } = useLumiTheme();
  const { profile } = useBootstrap();
  const { services } = useCompositionRoot();
  const history = useHistoryTabState();
  const childName = profile?.displayName ?? 'Miminko';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <View style={styles.headingText}>
            <LumiText variant="caption" tone="accent">
              LUMI
            </LumiText>
            <LumiText variant="h1" accessibilityRole="header">
              Dnes s {childName}
            </LumiText>
            <LumiText tone="muted">Rychlé akce a poslední péče přijdou vzápětí.</LumiText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Otevřít profil a nastavení"
            onPress={onOpenProfile}
            style={[styles.avatar, { borderColor: colors.controlBorder }]}
          >
            <LumiCharacter species="rabbit" expression="happy" />
          </Pressable>
        </View>
        <LumiCard>
          <LumiEmptyState
            illustration={<LumiCharacter species="rabbit" expression="happy" />}
            title="Připraveno k zápisu"
            description="Účet ani narozeniny nepotřebujete. Záznamy zůstávají v tomto zařízení."
          />
        </LumiCard>
        <LumiButton
          title="Zobrazit dnešní záznamy"
          variant="secondary"
          fullWidth
          onPress={() => {
            const zone = profile?.settings.summaryTimeZone ?? 'Europe/Prague';
            const today = formatIsoCalendarDate(services.clock.now().epochMs, zone);
            history.showToday(today);
            onOpenHistoryToday();
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: 24,
    gap: 24,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  heading: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  headingText: { flex: 1, gap: 8 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
