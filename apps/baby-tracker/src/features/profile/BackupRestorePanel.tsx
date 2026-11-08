import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LumiButton, LumiCard, LumiInput, LumiText } from '@lumi/forest-design/native';
import {
  activatePortableImport,
  exportPrivateCareCsv,
  exportSealedPortableDiary,
  listLocalRecoveryPoints,
  readLastPortableExportAtMs,
  restoreLocalRecoveryPoint,
  rollbackPreImportRestore,
  stagePortableImport,
  type StagedPortableImport,
} from '../../application';
import type { LogicalCheckpointSummary } from '../../infrastructure/database/logicalCheckpointVault';
import {
  assertPortableBackupReadable,
  pickPortableBackupFile,
  portableBackupFileName,
  shareOrDownloadPortableBackup,
} from '../../infrastructure/files/portableBackupFiles';
import { useBootstrap } from '../../app/session/BootstrapContext';

/**
 * Profile backup surface. Keeps local recovery, portable sealed export, and
 * future remote backup as distinct product concepts — never one green "backed up".
 */
export function BackupRestorePanel() {
  const { runtime, profile } = useBootstrap();
  const [points, setPoints] = useState<LogicalCheckpointSummary[]>([]);
  const [lastExportAtMs, setLastExportAtMs] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [importPayload, setImportPayload] = useState('');
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [exportText, setExportText] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [showAdvancedPaste, setShowAdvancedPaste] = useState(false);
  const [staged, setStaged] = useState<StagedPortableImport | null>(null);
  const [rollbackId, setRollbackId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!runtime) return;
    const [nextPoints, exportedAt] = await Promise.all([
      listLocalRecoveryPoints(runtime.checkpoints),
      readLastPortableExportAtMs(runtime.unitOfWork),
    ]);
    setPoints(nextPoints);
    setLastExportAtMs(exportedAt);
  }, [runtime]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || !runtime) return;
      void refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [refresh, runtime]);

  if (!runtime || !profile) return null;

  return (
    <View style={styles.root}>
      <LumiText variant="h2" accessibilityRole="header">
        Záloha a obnova
      </LumiText>
      <LumiText tone="muted">
        Osobní deník funguje bez účtu. Rozlišujte místní bod na tomto zařízení, přenosný
        šifrovaný soubor a vzdálenou zálohu (zatím nedostupnou).
      </LumiText>

      <LumiCard>
        <LumiText variant="h3">Obnova v tomto zařízení</LumiText>
        <LumiText tone="muted">
          Automatické body zůstávají jen v tomto telefonu. Ztráta zařízení je nesmaže z
          přenosné zálohy.
        </LumiText>
        {points.length === 0 ? (
          <LumiText tone="muted">Zatím není žádný místní bod obnovy.</LumiText>
        ) : (
          points.slice(0, 8).map((point) => (
            <View key={point.checkpointId} style={styles.row}>
              <View style={styles.rowText}>
                <LumiText>
                  {point.kind === 'pre_import' ? 'Před obnovou' : 'Denní bod'} ·{' '}
                  {formatStamp(point.createdAtMs)}
                </LumiText>
                <LumiText tone="muted">
                  {point.manifest.displayName ?? 'bez jména'} · {point.manifest.careEventCount}{' '}
                  záznamů
                </LumiText>
              </View>
              <LumiButton
                title="Obnovit"
                variant="ghost"
                disabled={busy}
                onPress={() => {
                  setBusy(true);
                  setError(null);
                  void restoreLocalRecoveryPoint({
                    unitOfWork: runtime.unitOfWork,
                    vault: runtime.checkpoints,
                    checkpointId: point.checkpointId,
                  })
                    .then((count) => {
                      setMessage(`Obnoveno ${count} záznamů z místního bodu.`);
                      setRollbackId(null);
                      return refresh();
                    })
                    .catch((err: unknown) => {
                      setError(err instanceof Error ? err.message : 'Obnova selhala');
                    })
                    .finally(() => setBusy(false));
                }}
              />
            </View>
          ))
        )}
      </LumiCard>

      <LumiCard>
        <LumiText variant="h3">Přenosná záloha</LumiText>
        <LumiText tone="muted">
          Úplný šifrovaný soubor pro jiné zařízení. Heslo si uložte sami — ztracené heslo
          nelze obnovit. Datum exportu neznamená, že soubor stále existuje mimo telefon.
        </LumiText>
        {lastExportAtMs != null ? (
          <LumiText tone="muted">Poslední export v aplikaci: {formatStamp(lastExportAtMs)}</LumiText>
        ) : (
          <LumiText tone="muted">Zatím nebyl vytvořen žádný přenosný export.</LumiText>
        )}
        <LumiInput
          label="Heslo obnovy"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        <LumiInput
          label="Potvrzení hesla"
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
          secureTextEntry
          autoCapitalize="none"
        />
        <LumiButton
          title="Vytvořit a uložit přenosnou zálohu"
          loading={busy}
          fullWidth
          onPress={() => {
            if (!password || password !== passwordConfirm) {
              setError('Heslo a potvrzení se musí shodovat a nesmí být prázdné.');
              return;
            }
            setBusy(true);
            setError(null);
            const nowMs = Date.now();
            void exportSealedPortableDiary({
              unitOfWork: runtime.unitOfWork,
              password,
              nowMs,
            })
              .then(async (result) => {
                setExportText(result.serialized);
                const shared = await shareOrDownloadPortableBackup(
                  result.serialized,
                  portableBackupFileName(nowMs),
                );
                if (!shared.ok) {
                  if (shared.code === 'cancelled') {
                    setMessage(
                      'Sdílení bylo zrušeno. Šifrovaný obsah zůstává níže jako nouzová kopie.',
                    );
                  } else {
                    setError(shared.message);
                    setMessage(
                      'Soubor se nepodařilo předat systému. Můžete použít nouzové zkopírování níže.',
                    );
                  }
                } else {
                  setMessage(
                    shared.outcome === 'downloaded'
                      ? 'Šifrovaný soubor byl stažen. Uložte jej mimo prohlížeč.'
                      : 'Systémové sdílení bylo otevřeno. Uzavření dialogu samo neznamená, že je soubor trvale uložený.',
                  );
                }
                setPassword('');
                setPasswordConfirm('');
                return refresh();
              })
              .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'Export selhal');
              })
              .finally(() => setBusy(false));
          }}
        />
        {exportText ? (
          <LumiButton
            title={showAdvancedPaste ? 'Skrýt nouzovou textovou kopii' : 'Nouzová textová kopie'}
            variant="ghost"
            onPress={() => setShowAdvancedPaste((value) => !value)}
          />
        ) : null}
        {exportText && showAdvancedPaste ? (
          <LumiInput
            label="Šifrovaný soubor (zkopírujte jen když sdílení selže)"
            value={exportText}
            onChangeText={setExportText}
            multiline
          />
        ) : null}

        <LumiText variant="h3">Obnovit z přenosné zálohy</LumiText>
        <LumiText tone="muted">
          Osobní import nahrazuje celý deník, neslučuje. Před potvrzením vznikne bod návratu.
        </LumiText>
        <LumiButton
          title="Vybrat soubor zálohy"
          loading={busy}
          fullWidth
          onPress={() => {
            setBusy(true);
            setError(null);
            setStaged(null);
            void pickPortableBackupFile()
              .then((picked) => {
                if (!picked.ok) {
                  if (picked.code !== 'cancelled') setError(picked.message);
                  return;
                }
                assertPortableBackupReadable(picked.contents);
                setImportPayload(picked.contents);
                setImportFileName(picked.fileName);
                setMessage(
                  picked.fileName
                    ? `Načten soubor ${picked.fileName}. Zadejte heslo a zkontrolujte.`
                    : 'Soubor načten. Zadejte heslo a zkontrolujte.',
                );
              })
              .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'Soubor se nepodařilo načíst');
              })
              .finally(() => setBusy(false));
          }}
        />
        {importFileName ? (
          <LumiText tone="muted">Vybraný soubor: {importFileName}</LumiText>
        ) : null}
        <LumiButton
          title={
            showAdvancedPaste ? 'Skrýt vložení textu' : 'Nouzové vložení textu zálohy'
          }
          variant="ghost"
          onPress={() => setShowAdvancedPaste((value) => !value)}
        />
        {showAdvancedPaste ? (
          <LumiInput
            label="Vložený obsah zálohy"
            value={importPayload}
            onChangeText={(value) => {
              setImportPayload(value);
              setImportFileName(null);
            }}
            multiline
            autoCapitalize="none"
          />
        ) : null}
        <LumiInput
          label="Heslo obnovy"
          value={importPassword}
          onChangeText={setImportPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        <LumiButton
          title="Zkontrolovat soubor"
          loading={busy}
          fullWidth
          onPress={() => {
            if (!importPayload.trim()) {
              setError('Nejdřív vyberte soubor zálohy nebo vložte její obsah.');
              return;
            }
            setBusy(true);
            setError(null);
            setStaged(null);
            void stagePortableImport({
              unitOfWork: runtime.unitOfWork,
              serializedEnvelope: importPayload,
              password: importPassword,
            })
              .then((next) => {
                setStaged(next);
                setMessage(null);
              })
              .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'Soubor nelze otevřít');
              })
              .finally(() => setBusy(false));
          }}
        />
        {staged ? (
          <View style={styles.stage}>
            <LumiText>
              Záloha: {staged.compare.incoming.displayName ?? 'bez jména'} ·{' '}
              {staged.compare.incoming.careEventCount} záznamů ·{' '}
              {formatStamp(staged.compare.incoming.createdAtMs)}
            </LumiText>
            <LumiText>
              Nyní: {staged.compare.current.displayName ?? 'bez jména'} ·{' '}
              {staged.compare.current.careEventCount} záznamů
            </LumiText>
            <LumiText tone="muted">
              Novějších místních záznamů, které se nevrátí: {staged.compare.newerLocalCareEvents}.
              Smazané položky se vrátí do stavu ze zálohy. Nahrazení, ne sloučení.
            </LumiText>
            <LumiButton
              title="Nejprve exportovat současný stav"
              variant="ghost"
              disabled={busy}
              onPress={() => {
                if (!password || password !== passwordConfirm) {
                  setError(
                    'Pro export současného stavu vyplňte shodné heslo obnovy v sekci přenosné zálohy.',
                  );
                  return;
                }
                setBusy(true);
                const nowMs = Date.now();
                void exportSealedPortableDiary({
                  unitOfWork: runtime.unitOfWork,
                  password,
                  nowMs,
                })
                  .then(async (result) => {
                    setExportText(result.serialized);
                    const shared = await shareOrDownloadPortableBackup(
                      result.serialized,
                      portableBackupFileName(nowMs),
                    );
                    setMessage(
                      shared.ok
                        ? 'Současný stav je připravený jako přenosná záloha.'
                        : `Export hotov, ale předání souboru selhalo: ${shared.message}`,
                    );
                  })
                  .catch((err: unknown) => {
                    setError(err instanceof Error ? err.message : 'Export selhal');
                  })
                  .finally(() => setBusy(false));
              }}
            />
            <LumiButton
              title="Potvrdit nahrazení deníku"
              loading={busy}
              fullWidth
              onPress={() => {
                setBusy(true);
                setError(null);
                void activatePortableImport({
                  unitOfWork: runtime.unitOfWork,
                  vault: runtime.checkpoints,
                  archive: staged.archive,
                  nowMs: Date.now(),
                })
                  .then((result) => {
                    setRollbackId(result.rollbackCheckpointId);
                    setStaged(null);
                    setImportPayload('');
                    setImportFileName(null);
                    setImportPassword('');
                    setMessage(
                      `Deník nahrazen (${result.restoredCareEventCount} záznamů). Můžete vrátit stav před obnovou.`,
                    );
                    return refresh();
                  })
                  .catch((err: unknown) => {
                    setError(err instanceof Error ? err.message : 'Nahrazení selhalo');
                  })
                  .finally(() => setBusy(false));
              }}
            />
          </View>
        ) : null}
        {rollbackId ? (
          <LumiButton
            title="Vrátit stav před obnovou"
            variant="ghost"
            disabled={busy}
            fullWidth
            onPress={() => {
              setBusy(true);
              void rollbackPreImportRestore({
                unitOfWork: runtime.unitOfWork,
                vault: runtime.checkpoints,
                rollbackCheckpointId: rollbackId,
              })
                .then((count) => {
                  setMessage(`Vráceno ${count} záznamů ze stavu před obnovou.`);
                  setRollbackId(null);
                  return refresh();
                })
                .catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : 'Návrat selhal');
                })
                .finally(() => setBusy(false));
            }}
          />
        ) : null}
      </LumiCard>

      <LumiCard>
        <LumiText variant="h3">CSV pro čtení</LumiText>
        <LumiText tone="muted">
          Čitelný výpis péče pro tabulky. Obsahuje soukromá rodinná data a není úplným
          recovery souborem.
        </LumiText>
        <LumiButton
          title="Připravit CSV"
          loading={busy}
          fullWidth
          onPress={() => {
            setBusy(true);
            setError(null);
            void exportPrivateCareCsv({
              unitOfWork: runtime.unitOfWork,
              nowMs: Date.now(),
            })
              .then((result) => {
                setCsvText(result.csv);
                setMessage(`CSV s ${result.careEventCount} záznamy je připravené.`);
              })
              .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'CSV export selhal');
              })
              .finally(() => setBusy(false));
          }}
        />
        {csvText ? (
          <LumiInput label="CSV (zkopírujte)" value={csvText} onChangeText={setCsvText} multiline />
        ) : null}
      </LumiCard>

      <LumiCard>
        <LumiText variant="h3">Vzdálená záloha</LumiText>
        <LumiText tone="muted">
          Automatická vzdálená ochrana před ztrátou telefonu není v osobní verzi k dispozici.
          Použijte přenosný soubor uložený mimo zařízení.
        </LumiText>
      </LumiCard>

      {message ? <LumiText>{message}</LumiText> : null}
      {error ? <LumiText tone="muted">{error}</LumiText> : null}
    </View>
  );
}

function formatStamp(epochMs: number): string {
  try {
    return new Intl.DateTimeFormat('cs-CZ', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(epochMs));
  } catch {
    return new Date(epochMs).toISOString();
  }
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowText: { flex: 1, gap: 4 },
  stage: { gap: 12 },
});
