import React, { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { LumiButton, LumiInput, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBootstrap } from '../../app/session/BootstrapContext';

/**
 * Optional PIN gate. Relocks when returning from background so the diary is not
 * left visible on a shared phone. Never deletes or rotates the SQLCipher key.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const { colors } = useLumiTheme();
  const { runtime } = useBootstrap();
  const [locked, setLocked] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [fault, setFault] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!runtime) {
      setLocked(false);
      setEnabled(false);
      setFault(null);
      return;
    }
    const status = await runtime.appLock.getStatus();
    setEnabled(status.enabled);
    setLocked(status.locked);
    setFault(status.fault);
  }, [runtime]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!runtime) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        void runtime.appLock.lockOnBackground().then(() => refresh());
      }
    });
    return () => sub.remove();
  }, [refresh, runtime]);

  if (!enabled || !locked) {
    return <>{children}</>;
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <LumiText variant="h1" accessibilityRole="header">
          Zámek deníku
        </LumiText>
        {fault ? (
          <>
            <LumiText tone="muted">
              Úložiště zámku teď není dostupné. Deník zůstává chráněný — žádný tichý přechod na
              odemčený režim. {fault}
            </LumiText>
            <LumiButton
              title="Zkusit znovu"
              fullWidth
              onPress={() => {
                if (!runtime?.appLock.retryDurableStore) return;
                setError(null);
                void runtime.appLock.retryDurableStore().then(() => refresh());
              }}
            />
          </>
        ) : (
          <>
            <LumiText tone="muted">
              Zadejte PIN. Zapomenutý PIN neobnoví šifrovací klíč — použijte přenosnou zálohu.
            </LumiText>
            <LumiInput
              label="PIN"
              value={pin}
              onChangeText={setPin}
              secureTextEntry
              autoCapitalize="none"
            />
            {error ? <LumiText tone="muted">{error}</LumiText> : null}
            <LumiButton
              title="Odemknout"
              fullWidth
              onPress={() => {
                if (!runtime) return;
                void runtime.appLock.unlock(pin).then((ok) => {
                  if (!ok) {
                    setError('PIN nesouhlasí.');
                    return;
                  }
                  setPin('');
                  setError(null);
                  void refresh();
                });
              }}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    padding: 24,
    gap: 16,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
  },
});
