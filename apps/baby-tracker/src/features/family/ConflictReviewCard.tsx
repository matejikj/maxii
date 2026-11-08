import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LumiButton, LumiCard, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import type {
  DeleteVsEditPresentation,
  DualSleepPresentation,
  EditConflictPresentation,
} from '../../domain/family/conflictPresentation';

type Props = {
  readonly presentation:
    | EditConflictPresentation
    | DualSleepPresentation
    | DeleteVsEditPresentation;
  readonly mergePreviewLabel?: string | null;
  readonly staleHeads?: boolean;
  readonly onChoose: (choiceId: string) => void;
  readonly disabled?: boolean;
};

/**
 * Parent-facing conflict review. Choices stay unselected until the caregiver
 * taps one — nothing is auto-confirmed from sync arrival.
 */
export function ConflictReviewCard({
  presentation,
  mergePreviewLabel,
  staleHeads = false,
  onChoose,
  disabled = false,
}: Props) {
  const { ui } = useLumiTheme();

  return (
    <LumiCard>
      <View style={{ gap: ui.space.sm }}>
        <LumiText variant="h3">{presentation.title}</LumiText>
        {staleHeads ? (
          <LumiText tone="muted">
            Mezitím přišla nová vzdálená změna. Návrh zůstává jako koncept — před potvrzením
            zkontrolujte aktuální podklad.
          </LumiText>
        ) : null}

        {presentation.kind === 'edit_conflict' ? (
          <View style={{ gap: ui.space.xs }}>
            <LumiText>
              A · {presentation.leftAuthorLabel} · {presentation.leftOccurredLabel}
            </LumiText>
            <LumiText>
              B · {presentation.rightAuthorLabel} · {presentation.rightOccurredLabel}
            </LumiText>
            {presentation.fields
              .filter((field) => field.changed)
              .map((field) => (
                <LumiText key={field.fieldLabel} tone="muted">
                  {field.fieldLabel}: „{field.leftValue}“ ↔ „{field.rightValue}“
                </LumiText>
              ))}
          </View>
        ) : null}

        {presentation.kind === 'dual_sleep' ? (
          <View style={{ gap: ui.space.xs }}>
            <SleepLine label="A" measurement={presentation.left} />
            <SleepLine label="B" measurement={presentation.right} />
            {mergePreviewLabel ? (
              <LumiText tone="muted">Náhled sloučení: {mergePreviewLabel}</LumiText>
            ) : null}
            <LumiText tone="muted">
              Podobný čas není důkaz jedné události. Nic netvrdíme o tom, že dítě právě
              procitlo.
            </LumiText>
          </View>
        ) : null}

        {presentation.kind === 'delete_vs_edit' ? (
          <View style={{ gap: ui.space.xs }}>
            <LumiText>Smazáno: {presentation.deletedSummary}</LumiText>
            <LumiText>Úprava: {presentation.editSummary}</LumiText>
            {presentation.restoreAvailableUntilLabel ? (
              <LumiText tone="muted">
                Obnova možná do {presentation.restoreAvailableUntilLabel}
              </LumiText>
            ) : (
              <LumiText tone="muted">Obnovitelná lhůta už vypršela.</LumiText>
            )}
          </View>
        ) : null}

        <View style={styles.actions}>
          {presentation.choices.map((choice) => (
            <LumiButton
              key={choice.id}
              title={choice.label}
              disabled={disabled || staleHeads}
              onPress={() => onChoose(choice.id)}
              fullWidth
            />
          ))}
        </View>
      </View>
    </LumiCard>
  );
}

function SleepLine({
  label,
  measurement,
}: {
  label: string;
  measurement: DualSleepPresentation['left'];
}) {
  return (
    <LumiText>
      {label} · {measurement.authorLabel} ({measurement.deviceLabel}) · {measurement.startLabel} ·{' '}
      {measurement.durationLabel} ·{' '}
      {measurement.status === 'active' ? 'běží' : 'dokončeno'} ·{' '}
      {measurement.precisionLabel === 'exact' ? 'přesný čas' : 'přibližný čas'}
    </LumiText>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 8, marginTop: 4 },
});
