import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LumiChip, LumiText } from '@lumi/forest-design/native';
import { useHistoryTabState } from '../../app/session/HistoryTabContext';
import { TabPlaceholderScreen } from '../shell/TabPlaceholderScreen';
import type { HistoryFilter } from '../../app/navigation/historyTabState';

const FILTERS: { id: HistoryFilter; label: string }[] = [
  { id: 'all', label: 'Vše' },
  { id: 'care', label: 'Péče' },
  { id: 'activities', label: 'Aktivity' },
  { id: 'notes', label: 'Poznámky' },
];

export function HistoryScreen() {
  const { state, setState } = useHistoryTabState();
  return (
    <TabPlaceholderScreen
      title="Historie"
      description={
        state.focusDate
          ? `Zobrazený den ${state.focusDate}. Filtry zůstávají při běžném návratu zachované.`
          : 'Časová osa péče a vzpomínek. Filtry se při návratu ze záložky zachovají.'
      }
      headerRight={
        <View style={styles.filters} accessibilityRole="summary">
          {FILTERS.map((filter) => (
            <LumiChip
              key={filter.id}
              label={filter.label}
              selected={state.filter === filter.id}
              onPress={() => setState({ ...state, filter: filter.id })}
            />
          ))}
          {state.focusDate ? (
            <LumiText variant="caption" tone="muted">
              {state.focusDate}
            </LumiText>
          ) : null}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  filters: { gap: 8, alignItems: 'flex-end', maxWidth: 160 },
});
