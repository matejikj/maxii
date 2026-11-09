import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { LumiButton, LumiCard, LumiText } from '@lumi/forest-design/native';
import {
  resolveRemoteServicesBoundary,
  shouldInitializeRemoteClients,
} from '../../app/remoteServicesBoundary';
import { BootstrapContext } from '../../app/session/BootstrapContext';
import { syncActiveFamilyForPhotoTransfer } from '../../application/syncActiveFamilyForPhotoTransfer';
import {
  createBrowserFamilyAuthPort,
} from '../../infrastructure/family/browserFamilyAuthPort';
import {
  createDisabledFamilyAuthPort,
  credentialsFromFamilyAuthSession,
  type FamilyAuthSession,
} from '../../infrastructure/family/familyAuthPort';
import { createHttpFamilyMembershipClient } from '../../infrastructure/family/httpFamilyMembershipClient';
import type {
  ActiveFamilySelection,
  FamilyMembershipSummary,
} from '../../domain/attachments/activeFamilySelection';
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
  const bootstrap = useContext(BootstrapContext);
  const [session, setSession] = useState<FamilyAuthSession | null>(null);
  const [membershipSelection, setMembershipSelection] = useState<ActiveFamilySelection | null>(
    null,
  );
  const [activeFamilyId, setActiveFamilyId] = useState<string | null>(null);
  const activeFamilyIdRef = useRef<string | null>(null);
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

  const memberships = useMemo(() => {
    if (!enabled || !boundary.apiBaseUrl) return null;
    return createHttpFamilyMembershipClient({
      apiBaseUrl: boundary.apiBaseUrl.replace(/\/$/, ''),
      getAccessCredentials: () => auth.getAccessCredentials(),
    });
  }, [auth, boundary.apiBaseUrl, enabled]);

  const bindFamily = useCallback(
    (familyId: string | null) => {
      activeFamilyIdRef.current = familyId;
      setActiveFamilyId(familyId);
      bootstrap?.runtime?.bindPhotoTransferFamily(familyId);
    },
    [bootstrap?.runtime],
  );

  const refreshMemberships = useCallback(
    async (authSession: FamilyAuthSession | null) => {
      if (!authSession || !memberships || !boundary.syncConfigured) {
        setMembershipSelection(null);
        bindFamily(null);
        return;
      }
      const listed = await memberships.listMemberships();
      if (!listed.ok) {
        setMembershipSelection({ kind: 'none' });
        bindFamily(null);
        setError(
          listed.code === 'unauthorized'
            ? 'Členství rodiny nelze načíst — přihlášení vypršelo.'
            : 'Členství rodiny teď nelze načíst.',
        );
        return;
      }
      const synced = syncActiveFamilyForPhotoTransfer({
        memberships: listed.memberships,
        previouslySelectedFamilyId: activeFamilyIdRef.current,
        bindActiveFamily: bindFamily,
      });
      setMembershipSelection(synced.selection);
      setError(null);
    },
    [bindFamily, boundary.syncConfigured, memberships],
  );

  const applySessionToTransfers = useCallback(
    (value: FamilyAuthSession | null) => {
      setSession(value);
      bootstrap?.runtime?.bindPhotoTransferAuth(value);
      if (!value) {
        setMembershipSelection(null);
        bindFamily(null);
      }
    },
    [bindFamily, bootstrap?.runtime],
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void auth.currentSession().then(async (value) => {
      if (cancelled) return;
      applySessionToTransfers(value);
      if (value) await refreshMemberships(value);
    });
    return () => {
      cancelled = true;
    };
  }, [auth, enabled, applySessionToTransfers, refreshMemberships]);

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
        applySessionToTransfers(null);
        setMessage('Odhlášeno. Neodeslané místní koncepty zůstávají v tomto zařízení.');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Odhlášení selhalo');
      })
      .finally(() => setBusy(false));
  }, [auth, applySessionToTransfers]);

  const onSelectFamily = useCallback(
    (membership: FamilyMembershipSummary) => {
      bindFamily(membership.familyId);
      setMembershipSelection({
        kind: 'choice_required',
        memberships:
          membershipSelection?.kind === 'choice_required'
            ? membershipSelection.memberships
            : [membership],
        preferredFamilyId: membership.familyId,
      });
      setMessage(`Aktivní rodina pro fotografie: ${membership.familyId.slice(0, 8)}…`);
    },
    [bindFamily, membershipSelection],
  );

  if (!enabled) return null;

  const credentialsReady = Boolean(credentialsFromFamilyAuthSession(session));

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
        {session && boundary.syncConfigured ? (
          <View style={styles.block}>
            <LumiText variant="h3">Rodina pro fotografie</LumiText>
            {!credentialsReady ? (
              <LumiText tone="muted">
                Přihlášení ještě nemá přenosové údaje — dokončete návrat z prohlížeče.
              </LumiText>
            ) : null}
            {membershipSelection?.kind === 'none' ? (
              <LumiText tone="muted">
                Žádná aktivní rodina. Fotografie zůstávají jen v tomto zařízení.
              </LumiText>
            ) : null}
            {membershipSelection?.kind === 'single' ? (
              <LumiText>
                Aktivní rodina: {membershipSelection.familyId.slice(0, 8)}…
              </LumiText>
            ) : null}
            {membershipSelection?.kind === 'choice_required' ? (
              <View style={styles.block}>
                <LumiText tone="muted">
                  Vyberte rodinu, do které se smí odesílat fotografie. Bez výběru zůstávají místní.
                </LumiText>
                {membershipSelection.memberships.map((item) => (
                  <LumiButton
                    key={item.familyId}
                    title={
                      item.familyId === activeFamilyId
                        ? `Aktivní · ${item.familyId.slice(0, 8)}… (${item.role})`
                        : `Vybrat ${item.familyId.slice(0, 8)}… (${item.role})`
                    }
                    disabled={busy}
                    onPress={() => onSelectFamily(item)}
                  />
                ))}
              </View>
            ) : null}
            {activeFamilyId ? (
              <LumiText tone="muted">
                Přenos fotografií cílí na {activeFamilyId.slice(0, 8)}…
              </LumiText>
            ) : (
              <LumiText tone="muted">Přenos fotografií je vypnutý, dokud není aktivní rodina.</LumiText>
            )}
          </View>
        ) : null}
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
