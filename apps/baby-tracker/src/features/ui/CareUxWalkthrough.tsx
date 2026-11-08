import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LumiButton,
  LumiCard,
  LumiCharacter,
  LumiText,
  useLumiTheme,
} from '@lumi/forest-design/native';
import { ActiveMeasurement } from './ActiveMeasurement';
import { CareActionSheet } from './CareActionSheet';
import { DateTimeField } from './DateTimeField';
import { DirectCareActions, FormSaveButton } from './DirectCareActions';
import { FormSection } from './FormSection';
import { NoteField } from './NoteField';
import { PRODUCT_COPY } from './productCopy';
import { QuantityField } from './QuantityField';
import { SaveFeedback, type SaveFeedbackState } from './SaveFeedback';

/**
 * Synthetic interactive pass for early UX checks (diaper, sleep, note). Uses
 * fake child labels only — never real family data.
 */
export function CareUxWalkthrough() {
  const { colors, ui, mode } = useLumiTheme();
  const openerRef = useRef(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailedOpen, setDetailedOpen] = useState(false);
  const [feedback, setFeedback] = useState<SaveFeedbackState>('idle');
  const [note, setNote] = useState('');
  const [time, setTime] = useState('2024-06-01 10:20');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<'ml' | 'g' | 'piece'>('ml');
  const [sleepRunning, setSleepRunning] = useState(false);
  const [nowMs, setNowMs] = useState(1_700_000_600_000);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { gap: ui.space.lg }]} keyboardShouldPersistTaps="handled">
        <LumiText variant="caption" tone="accent">
          LUMI · syntetický průchod
        </LumiText>
        <LumiText variant="h1" accessibilityRole="header">
          Péče bez skrytých gest
        </LumiText>
        <LumiText tone="muted">
          Režim {mode}. Ilustrace neskrývají akce — tlačítka říkají výsledek stisku.
        </LumiText>
        <LumiCard>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <LumiCharacter species="rabbit" expression="happy" />
          </View>
          <LumiText tone="muted">Dekorativní průvodce je skrytý před čtečkou.</LumiText>
        </LumiCard>

        <View ref={openerRef} collapsable={false}>
          <LumiButton title="Plenka" onPress={() => setSheetOpen(true)} fullWidth />
        </View>

        <SaveFeedback
          state={feedback}
          undoAvailable={feedback === 'saved'}
          onUndo={() => setFeedback('idle')}
          onEdit={() => setDetailedOpen(true)}
        />

        {sleepRunning ? (
          <ActiveMeasurement
            title={PRODUCT_COPY.actions.sleepRunning}
            startedAtEpochMs={1_700_000_000_000}
            nowEpochMs={nowMs}
            onOpen={() => setNowMs((value) => value + 60_000)}
            onStop={() => setSleepRunning(false)}
          />
        ) : (
          <LumiButton
            title={PRODUCT_COPY.actions.startSleep}
            variant="secondary"
            fullWidth
            onPress={() => setSleepRunning(true)}
          />
        )}

        <FormSection title="Večerní poznámka" description="Systémová klávesnice; diktování jen pokud ho nabízí.">
          <NoteField value={note} onChangeText={setNote} />
          <FormSaveButton
            onSave={async () => {
              setFeedback('pending');
              await new Promise((resolve) => setTimeout(resolve, 120));
              setFeedback('saved');
            }}
          />
        </FormSection>
      </ScrollView>

      <CareActionSheet
        visible={sheetOpen}
        title={PRODUCT_COPY.sheets.diaperNow}
        subtitle="Přímá akce uloží; otevření panelu samo nic nezapisuje."
        onClose={() => setSheetOpen(false)}
        returnFocusRef={openerRef}
      >
        <DirectCareActions
          onRecord={async () => {
            setFeedback('pending');
            await new Promise((resolve) => setTimeout(resolve, 80));
            setFeedback('saved');
            setSheetOpen(false);
          }}
          onOpenDetailed={() => {
            setSheetOpen(false);
            setDetailedOpen(true);
          }}
        />
      </CareActionSheet>

      <CareActionSheet
        visible={detailedOpen}
        title={PRODUCT_COPY.sheets.detailedDiaper}
        onClose={() => setDetailedOpen(false)}
        footer={
          <FormSaveButton
            onSave={async () => {
              setFeedback('pending');
              await new Promise((resolve) => setTimeout(resolve, 80));
              setFeedback('saved');
              setDetailedOpen(false);
            }}
          />
        }
      >
        <FormSection title="Podrobnosti">
          <DateTimeField value={time} onChangeText={setTime} restoredFromDraft />
          <QuantityField
            amount={amount}
            unit={unit}
            onChangeAmount={setAmount}
            onChangeUnit={setUnit}
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
