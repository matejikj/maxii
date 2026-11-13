import React, { useState } from 'react';
import { View } from 'react-native';
import {
  LumiButton,
  LumiCard,
  LumiInput,
  LumiText,
  useLumiTheme,
} from '@lumi/forest-design/native';
import { useBootstrap } from '../../app/session/BootstrapContext';

/**
 * Local multi-child management. Personal mode stays offline — no account or
 * family server is required to add a sibling profile on this device.
 */
export function ChildrenPanel() {
  const { ui } = useLumiTheme();
  const { profiles, activeProfiles, profile, addChild, archiveChild, switchChild } = useBootstrap();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <LumiCard style={{ borderRadius: 24, gap: 14 }}>
      <View style={{ gap: ui.space.sm }}>
        <LumiText variant="h3" accessibilityRole="header">
          Děti v tomto zařízení
        </LumiText>
        <LumiText tone="muted">
          Každé dítě má vlastní deník. Archivace skryje dítě z přepínače a jeho vzpomínky zachová.
        </LumiText>
        {profiles.map((child) => {
          const isActive = child.childId === profile?.childId;
          const archived = child.status === 'archived';
          return (
            <View key={child.childId} style={{ gap: 4 }}>
              <LumiText>
                {child.displayName}
                {isActive ? ' · právě vybrané' : ''}
                {archived ? ' · archivované' : ''}
              </LumiText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {!archived && !isActive ? (
                  <LumiButton
                    title="Přepnout"
                    variant="secondary"
                    onPress={() => void switchChild(child.childId)}
                  />
                ) : null}
                {!archived && activeProfiles.length > 1 ? (
                  <LumiButton
                    title="Archivovat"
                    variant="ghost"
                    onPress={() => {
                      setBusy(true);
                      void archiveChild(child.childId)
                        .catch((err: unknown) => {
                          setError(err instanceof Error ? err.message : 'Archivace selhala');
                        })
                        .finally(() => setBusy(false));
                    }}
                  />
                ) : null}
              </View>
            </View>
          );
        })}
        <LumiInput
          label="Jméno dalšího dítěte"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
        {error ? <LumiText tone="muted">{error}</LumiText> : null}
        <LumiButton
          title="Přidat dítě"
          loading={busy}
          fullWidth
          onPress={() => {
            const trimmed = name.trim();
            if (!trimmed) {
              setError('Zadejte jméno dítěte');
              return;
            }
            setBusy(true);
            setError(null);
            void addChild({ displayName: trimmed })
              .then(() => setName(''))
              .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'Přidání selhalo');
              })
              .finally(() => setBusy(false));
          }}
        />
      </View>
    </LumiCard>
  );
}
