import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LUMI_MOTIFS } from '@lumi/forest-design/core';
import { LumiIcon, LumiMotifLandscape, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import { LOCAL_APP_MOTIFS, type AppMotif } from '../../application';
import { usePersonalPreferences } from '../../app/session/PreferencesContext';

/** Real, offline previews from the same scenery compiler used by the app. */
export function AppThemePicker() {
  const { colors, mode } = useLumiTheme();
  const { preferences, ready, setMotif } = usePersonalPreferences();
  const [pending, setPending] = useState<AppMotif | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<AppMotif | null>(null);
  const saving = useRef(false);

  async function choose(motif: AppMotif) {
    if (!ready || saving.current || motif === preferences.appMotif) return;
    saving.current = true;
    setPending(motif);
    setError(null);
    try {
      await setMotif(motif);
    } catch {
      setError('Motiv se nepodařilo uložit. Zkuste ho vybrat znovu.');
    } finally {
      saving.current = false;
      setPending(null);
    }
  }

  return (
    <View style={styles.section} testID="app-theme-picker">
      <View style={styles.heading}>
        <LumiIcon name="development" color={colors.primary} size={27} />
        <View style={{ flex: 1, gap: 3 }}>
          <LumiText variant="h2" accessibilityRole="header">
            Téma aplikace
          </LumiText>
          <LumiText variant="caption" tone="muted">
            Vyberte si svůj malý svět
          </LumiText>
        </View>
      </View>
      <LumiText variant="caption" tone="muted">
        Les, rozkvetlá zahrada, nebo hravé odpoledne? Motiv se promítne do celé aplikace.
      </LumiText>
      <View style={{ gap: 13 }} accessibilityRole="radiogroup" accessibilityLabel="Téma aplikace">
        {LOCAL_APP_MOTIFS.map((id) => {
          const motif = LUMI_MOTIFS[id];
          const selected = preferences.appMotif === id;
          const disabled = !ready || pending !== null;
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityLabel={motif.label}
              accessibilityHint={motif.description}
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              testID={`app-motif-${id}`}
              onPress={() => void choose(id)}
              onFocus={() => setFocused(id)}
              onBlur={() => setFocused(null)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: colors.surface,
                  borderColor:
                    focused === id ? colors.focus : selected ? colors.primary : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View
                style={styles.preview}
                accessible={false}
                importantForAccessibility="no-hide-descendants"
              >
                <LumiMotifLandscape motif={id} colorMode={mode} />
                <View style={[styles.previewTag, { backgroundColor: colors.surface }]}>
                  <LumiText variant="overline" style={{ fontSize: 9, letterSpacing: 1.6 }}>
                    {motif.brand}
                  </LumiText>
                </View>
              </View>
              <View style={styles.optionBody}>
                <View style={{ flex: 1, gap: 3 }}>
                  <LumiText variant="bodyStrong">{motif.label}</LumiText>
                  <LumiText variant="caption" tone="muted">
                    {motif.description}
                  </LumiText>
                </View>
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <View
                    style={[
                      styles.radio,
                      { borderColor: selected ? colors.primary : colors.controlBorder },
                    ]}
                  >
                    {selected ? (
                      <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />
                    ) : null}
                  </View>
                  {selected ? (
                    <LumiText variant="caption" tone="accent" style={{ fontSize: 10 }}>
                      Zvoleno
                    </LumiText>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
      <LumiText variant="caption" tone="muted" accessibilityLiveRegion="polite">
        {!ready
          ? 'Načítám uložený motiv…'
          : pending
            ? 'Ukládám motiv…'
            : 'Výběr se ukládá automaticky v tomto zařízení.'}
      </LumiText>
      {error ? (
        <LumiText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </LumiText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  option: { borderWidth: 2, borderRadius: 24, overflow: 'hidden' },
  preview: { width: '100%', aspectRatio: 2, overflow: 'hidden' },
  previewTag: {
    position: 'absolute',
    left: 13,
    top: 12,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 9,
  },
  optionBody: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 14 },
  radio: {
    width: 23,
    height: 23,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
});
