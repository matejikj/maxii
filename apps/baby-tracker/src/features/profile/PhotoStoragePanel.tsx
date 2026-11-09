import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LumiButton, LumiCard, LumiInput, LumiText } from '@lumi/forest-design/native';
import {
  clearRecoverablePhotoCache,
  loadPhotoStorageSnapshot,
  releaseDurableOwnPhotoCopy,
} from '../../application';
import { useBootstrap } from '../../app/session/BootstrapContext';

/**
 * Settings space controls: show protected vs recoverable photo usage, clear
 * download cache, and a gated path to release a durable own-import copy.
 */
export function PhotoStoragePanel() {
  const { runtime } = useBootstrap();
  const [protectedLabel, setProtectedLabel] = useState('Trvalé / připnuté fotky: …');
  const [cacheLabel, setCacheLabel] = useState('Obnovitelná cache: …');
  const [cacheCopyCount, setCacheCopyCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [releaseAttachmentId, setReleaseAttachmentId] = useState('');
  const [releaseConfirm, setReleaseConfirm] = useState('');
  const [remoteVerified, setRemoteVerified] = useState(false);
  const [backupConfirmed, setBackupConfirmed] = useState(false);

  const refresh = useCallback(async () => {
    if (!runtime?.attachments) return;
    const snapshot = await loadPhotoStorageSnapshot({
      attachments: runtime.attachments,
      transferJobs: runtime.photoTransfer?.getJobs() ?? [],
      nowMs: Date.now(),
    });
    setProtectedLabel(snapshot.protectedLabel);
    setCacheLabel(snapshot.cacheLabel);
    setCacheCopyCount(snapshot.inventory.cacheCopyCount);
  }, [runtime]);

  useEffect(() => {
    let cancelled = false;
    void refresh().catch((err: unknown) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Inventář fotografií se nepodařilo načíst');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  if (!runtime?.attachments) return null;

  return (
    <LumiCard testID="photo-storage-panel">
      <LumiText variant="h3">Fotografie a místo</LumiText>
      <LumiText tone="muted">
        Uložíme menší kopii. Originál ve vašich Fotkách zůstane. Trvalé a připnuté kopie
        automaticky neuvolňujeme.
      </LumiText>
      <LumiText>{protectedLabel}</LumiText>
      <LumiText>{cacheLabel}</LumiText>

      <LumiButton
        title="Vyčistit staženou cache"
        disabled={busy || cacheCopyCount === 0}
        loading={busy}
        onPress={() => {
          setBusy(true);
          setError(null);
          setMessage(null);
          void clearRecoverablePhotoCache({
            attachments: runtime.attachments!,
            transferJobs: runtime.photoTransfer?.getJobs() ?? [],
            nowMs: Date.now(),
          })
            .then((result) => {
              setProtectedLabel(result.protectedLabel);
              setCacheLabel(result.cacheLabel);
              setCacheCopyCount(result.inventory.cacheCopyCount);
              setMessage(
                result.clearedBlobCount === 0
                  ? 'Obnovitelná cache je už prázdná. Trvalé kopie zůstaly.'
                  : `Uvolněno ${result.clearedBlobCount} cache kopií. Fotky v rodině zůstávají — jen místní stažená cache.`,
              );
            })
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'Čištění cache selhalo');
            })
            .finally(() => setBusy(false));
        }}
      />

      <View style={styles.releaseBlock}>
        <LumiText variant="h3">Uvolnit trvalou vlastní kopii</LumiText>
        <LumiText tone="muted">
          Jen vědomě a jen když je ověřená vzdálená kopie a nezávislá záloha. Offline dostupnost
          na tomto zařízení se ztratí; fotka z rodiny se nesmaže.
        </LumiText>
        <LumiInput
          label="ID přílohy"
          value={releaseAttachmentId}
          onChangeText={setReleaseAttachmentId}
          autoCapitalize="none"
        />
        <LumiButton
          title={
            remoteVerified
              ? 'Vzdálená kopie: ověřena'
              : 'Potvrdit ověřenou vzdálenou kopii'
          }
          variant="ghost"
          onPress={() => setRemoteVerified((value) => !value)}
        />
        <LumiButton
          title={
            backupConfirmed
              ? 'Nezávislá záloha: potvrzena'
              : 'Potvrdit nezávislou zálohu / archiv'
          }
          variant="ghost"
          onPress={() => setBackupConfirmed((value) => !value)}
        />
        <LumiInput
          label='Pro uvolnění napište UVOLNIT'
          value={releaseConfirm}
          onChangeText={setReleaseConfirm}
          autoCapitalize="characters"
        />
        <LumiButton
          title="Uvolnit místní trvalou kopii"
          disabled={busy}
          onPress={() => {
            if (releaseConfirm.trim() !== 'UVOLNIT') {
              setError('Pro uvolnění napište UVOLNIT.');
              return;
            }
            if (!releaseAttachmentId.trim()) {
              setError('Zadejte ID přílohy k uvolnění.');
              return;
            }
            setBusy(true);
            setError(null);
            setMessage(null);
            void releaseDurableOwnPhotoCopy({
              attachmentId: releaseAttachmentId.trim(),
              attachments: runtime.attachments!,
              remoteCopyVerified: remoteVerified,
              independentBackupConfirmed: backupConfirmed,
              completePortableArchiveVerified: false,
              userConfirmedOfflineLoss: true,
            })
              .then(async (result) => {
                if (!result.ok) {
                  const reasonLabel =
                    result.reason === 'remote_unverified'
                      ? 'Nejdřív potvrďte ověřenou vzdálenou kopii.'
                      : result.reason === 'backup_unconfirmed'
                        ? 'Nejdřív potvrďte nezávislou zálohu nebo úplný archiv.'
                        : result.reason === 'not_own_import'
                          ? 'Stažené rodinné kopie uvolněte čištěním cache, ne tímto průchodem.'
                          : result.reason === 'not_found'
                            ? 'Příloha nebyla nalezena.'
                            : 'Uvolnění není dovolené.';
                  setError(reasonLabel);
                  return;
                }
                setMessage(
                  `Místní trvalá kopie uvolněna (${result.releasedBlobCount} souborů). Offline dostupnost na tomto zařízení končí.`,
                );
                setReleaseConfirm('');
                setReleaseAttachmentId('');
                setRemoteVerified(false);
                setBackupConfirmed(false);
                await refresh();
              })
              .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'Uvolnění trvalé kopie selhalo');
              })
              .finally(() => setBusy(false));
          }}
        />
      </View>

      {message ? <LumiText>{message}</LumiText> : null}
      {error ? <LumiText tone="muted">{error}</LumiText> : null}
    </LumiCard>
  );
}

const styles = StyleSheet.create({
  releaseBlock: { gap: 8, marginTop: 8 },
});
