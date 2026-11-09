import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { LumiButton, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import { useBootstrap } from '../../app/session/BootstrapContext';

type ChildSwitcherProps = {
  /** Optional compact label override in the header chip. */
  accessibilityHint?: string;
};

/**
 * Header control that names the active child in text. Colour alone never
 * identifies who receives the next care write.
 */
export function ChildSwitcher({ accessibilityHint }: ChildSwitcherProps) {
  const { colors, ui } = useLumiTheme();
  const { profile, activeProfiles, switchChild } = useBootstrap();
  const [open, setOpen] = useState(false);

  if (!profile) return null;

  const multi = activeProfiles.length > 1;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Aktivní dítě: ${profile.displayName}`}
        accessibilityHint={
          accessibilityHint ??
          (multi ? 'Přepnout dítě pro zápis péče' : 'Otevřít výběr dítěte')
        }
        onPress={() => setOpen(true)}
        style={[
          styles.chip,
          {
            borderColor: colors.controlBorder,
            backgroundColor: colors.surface,
            paddingHorizontal: ui.space.sm,
            paddingVertical: ui.space.xs,
            minHeight: 48,
          },
        ]}
      >
        <LumiText variant="label">{profile.displayName}</LumiText>
        <LumiText tone="muted" variant="caption">
          {multi ? 'Přepnout' : 'Dítě'}
        </LumiText>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.35)' }]}
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Zavřít výběr dítěte"
        >
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                borderColor: colors.controlBorder,
                padding: ui.space.md,
                gap: ui.space.sm,
              },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <LumiText variant="h2" accessibilityRole="header">
              Pro koho zapisujete
            </LumiText>
            <LumiText tone="muted">
              Jméno dítěte je hlavní identifikace. Barva ani maskot nestačí.
            </LumiText>
            {activeProfiles.map((child) => {
              const selected = child.childId === profile.childId;
              return (
                <LumiButton
                  key={child.childId}
                  title={selected ? `${child.displayName} (aktivní)` : child.displayName}
                  variant={selected ? 'primary' : 'secondary'}
                  fullWidth
                  onPress={() => {
                    void switchChild(child.childId).then(() => setOpen(false));
                  }}
                />
              );
            })}
            <LumiButton title="Zavřít" variant="ghost" fullWidth onPress={() => setOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 2,
    maxWidth: 160,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
});
