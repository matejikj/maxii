import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { LumiButton, LumiCard, LumiText } from '@lumi/forest-design/native';
import {
  resolveRemoteServicesBoundary,
  shouldInitializeRemoteClients,
} from '../../app/remoteServicesBoundary';
import {
  createBrowserFamilyAuthPort,
} from '../../infrastructure/family/browserFamilyAuthPort';
import {
  createDisabledFamilyAuthPort,
  type FamilyAuthSession,
} from '../../infrastructure/family/familyAuthPort';
import { FamilyDurabilityStatusCard } from '../family/FamilyDurabilityStatusCard';

function defaultRedirectUri(): string {
  return Platform.OS === 'web'
    ? 'http://127.0.0.1:8081/oidc/callback'
    : 'com.matejikj://oidc/callback';
}

/**
 * Optional family account controls. Hidden unless the remote boundary is
 * explicitly configured so personal installs never nudge toward login.
 */
export function FamilyAccountPanel() {
  const boundary = useMemo(() => resolveRemoteServicesBoundary(), []);
  const enabled = shouldInitializeRemoteClients(boundary);
  const [session, setSession] = useState<FamilyAuthSession | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const auth = useMemo(() => {
    if (!enabled || !boundary.apiBaseUrl) return createDisabledFamilyAuthPort();
    return createBrowserFamilyAuthPort({
      apiBaseUrl: boundary.apiBaseUrl.replace(/\/$/, ''),
      redirectUri: defaultRedirectUri(),
      transport: Platform.OS === 'web' ? 'cookie' : 'bearer',
    });
  }, [boundary.apiBaseUrl, enabled]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void auth.currentSession().then((value) => {
      if (!cancelled) setSession(value);
    });
    return () => {
      cancelled = true;
    };
  }, [auth, enabled]);

  const onLogin = useCallback(() => {
    setBusy(true);
    setError(null);
    setMessage(null);
    void auth
      .beginBrowserLogin()
      .then(async ({ authorizationUrl, state }) => {
        // System browser / OS handler completes the redirect; deep-link wiring
        // finishes the code exchange when the app is configured for family mode.
        const canOpen = await Linking.canOpenURL(authorizationUrl);
        if (!canOpen) {
          throw new Error('Systémový prohlížeč není dostupný pro přihlášení.');
        }
        await Linking.openURL(authorizationUrl);
        setMessage(
          `Přihlášení otevřeno. Po návratu dokončete stav ${state.slice(0, 8)}…`,
        );
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Přihlášení selhalo');
      })
      .finally(() => setBusy(false));
  }, [auth]);

  const onLogout = useCallback(() => {
    setBusy(true);
    setError(null);
    void auth
      .logout()
      .then(() => {
        setSession(null);
        setMessage('Odhlášeno. Neodeslané místní koncepty zůstávají v tomto zařízení.');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Odhlášení selhalo');
      })
      .finally(() => setBusy(false));
  }, [auth]);

  if (!enabled) return null;

  return (
    <View style={styles.stack}>
      <LumiCard>
        <LumiText variant="h3">Rodinný účet</LumiText>
        <LumiText tone="muted">
          Volitelné přihlášení pro sdílení. Osobní deník funguje dál i bez účtu a bez serveru.
        </LumiText>
        {session ? (
          <View style={styles.block}>
            <LumiText>Přihlášeno ({session.appUserId.slice(0, 8)}…)</LumiText>
            <LumiButton title="Odhlásit" disabled={busy} onPress={onLogout} />
          </View>
        ) : (
          <View style={styles.block}>
            <LumiButton title="Přihlásit přes prohlížeč" disabled={busy} onPress={onLogin} />
            <LumiText tone="muted">
              Obnova hesla probíhá u poskytovatele identity, ne uvnitř deníku.
            </LumiText>
          </View>
        )}
        {message ? <LumiText>{message}</LumiText> : null}
        {error ? <LumiText tone="muted">{error}</LumiText> : null}
      </LumiCard>
      <FamilyDurabilityStatusCard />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  block: {
    gap: 8,
    marginTop: 8,
  },
});
