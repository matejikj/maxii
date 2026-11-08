import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LumiButton, LumiCard, LumiInput, LumiText, useLumiMotion } from '@lumi/forest-design/native';
import {
  LOCAL_GUIDE_SPECIES,
  buildDiagnosticsSnapshot,
  buildSupportReport,
  serializeSupportReport,
  type GuideSpecies,
} from '../../application';
import { createChildProfile } from '../../domain';
import { useBootstrap } from '../../app/session/BootstrapContext';
import { usePersonalPreferences } from '../../app/session/PreferencesContext';
import { FamilyAccountPanel } from './FamilyAccountPanel';

const GUIDE_LABELS: Record<GuideSpecies, string> = {
  rabbit: 'Lumi (králík)',
  bear: 'Momo (medvěd)',
  fox: 'Nori (liška)',
  otter: 'Kiko (vydra)',
  hedgehog: 'Piko (ježek)',
  owl: 'Eli (sova)',
  squirrel: 'Tili (veverka)',
  fawn: 'Runi (koloušek)',
};

/**
 * Grouped personal settings: units/zone, appearance, single motion switch,
 * optional reminders, optional app lock, diagnostics and full wipe.
 */
export function SettingsPanel() {
  const { runtime, profile, wipeAllLocalData, saveProfile } = useBootstrap();
  const {
    preferences,
    setMotionEnabled,
    setGuide,
    setReminders,
    setUnits,
    setTimeZone,
  } = usePersonalPreferences();
  const motion = useLumiMotion();
  const [timeZone, setTimeZoneDraft] = useState(profile?.settings.summaryTimeZone ?? 'Europe/Prague');
  const [dailyHour, setDailyHour] = useState(String(preferences.reminders.dailyTogetherHour));
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [lockStatus, setLockStatus] = useState({
    enabled: false,
    locked: false,
    fault: null as string | null,
    protection: 'unavailable' as 'secure_store' | 'origin_storage' | 'unavailable',
  });
  const [diagnostics, setDiagnostics] = useState<string | null>(null);
  const [wipeConfirm, setWipeConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || !runtime) return;
      void runtime.appLock.getStatus().then((status) => {
        if (!cancelled) setLockStatus(status);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [runtime]);

  if (!runtime || !profile) return null;

  const caps = runtime.reminders.getCapabilities();

  return (
    <View style={styles.root}>
      <LumiText variant="h2" accessibilityRole="header">
        Nastavení
      </LumiText>
      <LumiText tone="muted">
        Osobní deník funguje bez účtu. Základní péče zůstává dostupná i bez notifikací.
      </LumiText>

      <FamilyAccountPanel />

      <LumiCard>
        <LumiText variant="h3">Jednotky a pásmo</LumiText>
        <LumiText tone="muted">
          Souhrnné pásmo mění denní hranice; jednotlivé záznamy si drží původní čas.
        </LumiText>
        <LumiInput
          label="Souhrnné pásmo (IANA)"
          value={timeZone}
          onChangeText={setTimeZoneDraft}
          autoCapitalize="none"
        />
        <LumiButton
          title="Uložit pásmo"
          disabled={busy}
          onPress={() => {
            setBusy(true);
            setError(null);
            const nextZone = timeZone.trim();
            void setTimeZone(nextZone)
              .then(() =>
                saveProfile(
                  createChildProfile({
                    childId: profile.childId,
                    displayName: profile.displayName,
                    birthDate: profile.birthDate,
                    summaryTimeZone: nextZone,
                  }),
                ),
              )
              .then(() => setMessage('Pásmo uloženo.'))
              .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'Uložení pásma selhalo');
              })
              .finally(() => setBusy(false));
          }}
        />
        <View style={styles.row}>
          <LumiButton
            title={`Hmotnost: ${preferences.weightUnit}`}
            variant="ghost"
            onPress={() => {
              void setUnits({
                weightUnit: preferences.weightUnit === 'kg' ? 'lb' : 'kg',
                lengthUnit: preferences.lengthUnit,
              });
            }}
          />
          <LumiButton
            title={`Délka: ${preferences.lengthUnit}`}
            variant="ghost"
            onPress={() => {
              void setUnits({
                weightUnit: preferences.weightUnit,
                lengthUnit: preferences.lengthUnit === 'cm' ? 'in' : 'cm',
              });
            }}
          />
        </View>
      </LumiCard>

      <LumiCard>
        <LumiText variant="h3">Průvodce</LumiText>
        <LumiText tone="muted">
          Výchozí je Lumi. Změna průvodce nemění historii ani doporučení.
        </LumiText>
        {LOCAL_GUIDE_SPECIES.map((species) => (
          <LumiButton
            key={species}
            title={`${GUIDE_LABELS[species]}${preferences.guideSpecies === species ? ' · zvoleno' : ''}`}
            variant={preferences.guideSpecies === species ? 'primary' : 'ghost'}
            onPress={() => void setGuide(species)}
          />
        ))}
      </LumiCard>

      <LumiCard>
        <LumiText variant="h3">Pohyb postav</LumiText>
        <LumiText tone="muted">
          Jediné nastavení pohybu postav. Systémové omezení pohybu má vždy přednost.
        </LumiText>
        {motion.reduceMotion ? (
          <LumiText tone="muted">
            Systém omezuje pohyb — aplikace to respektuje a nevyzývá k obcházení.
          </LumiText>
        ) : null}
        <LumiButton
          title={
            preferences.characterMotionEnabled ? 'Pohyb postav: zapnuto' : 'Pohyb postav: vypnuto'
          }
          onPress={() => void setMotionEnabled(!preferences.characterMotionEnabled)}
        />
      </LumiCard>

      <LumiCard>
        <LumiText variant="h3">Připomínky</LumiText>
        <LumiText tone="muted">
          Volitelná denní společná chvíle a týdenní ohlédnutí. Nejsou streak, tlak ani zdravotní
          předpověď. Výchozí stav je vypnuto.
        </LumiText>
        {!caps.osLocalNotifications ? (
          <LumiText tone="muted">
            Na webu první verze nezobrazuje upozornění při zavřeném prohlížeči. Týdenní ohlédnutí
            uvidíte uvnitř aplikace.
          </LumiText>
        ) : null}
        <LumiButton
          title={
            preferences.reminders.dailyTogetherEnabled
              ? 'Denní připomínka: zapnuta'
              : 'Denní připomínka: vypnuta'
          }
          onPress={() => {
            void (async () => {
              setError(null);
              const enabling = !preferences.reminders.dailyTogetherEnabled;
              if (enabling && caps.osLocalNotifications) {
                const permission = await runtime.reminders.requestPermission();
                if (permission === 'denied') {
                  setError(
                    'Oprávnění k oznámením bylo odmítnuto. Péče funguje dál; zapněte oznámení v systému, pokud je budete chtít.',
                  );
                  return;
                }
              }
              const hour = Number(dailyHour);
              await setReminders({
                ...preferences.reminders,
                dailyTogetherEnabled: enabling,
                dailyTogetherHour: Number.isFinite(hour) ? hour : 18,
                timeZone: profile.settings.summaryTimeZone,
              });
            })();
          }}
        />
        <LumiInput
          label="Hodina denní připomínky (0–23)"
          value={dailyHour}
          onChangeText={setDailyHour}
          autoCapitalize="none"
        />
        <LumiButton
          title={
            preferences.reminders.weeklyGlanceEnabled
              ? 'Týdenní ohlédnutí: zapnuto'
              : 'Týdenní ohlédnutí: vypnuto'
          }
          onPress={() => {
            void (async () => {
              const enabling = !preferences.reminders.weeklyGlanceEnabled;
              if (enabling && caps.osLocalNotifications) {
                const permission = await runtime.reminders.requestPermission();
                if (permission === 'denied') {
                  setError(
                    'Oprávnění k oznámením bylo odmítnuto. Základní funkce zůstávají použitelné.',
                  );
                  return;
                }
              }
              await setReminders({
                ...preferences.reminders,
                weeklyGlanceEnabled: enabling,
                timeZone: profile.settings.summaryTimeZone,
              });
            })();
          }}
        />
      </LumiCard>

      <LumiCard>
        <LumiText variant="h3">Zámek aplikace</LumiText>
        <LumiText tone="muted">
          Volitelný PIN chrání náhled deníku. Neotáčí šifrovací klíč databáze. Při ztrátě PINu
          použijte přenosnou zálohu — klíč se potichu neregeneruje.
        </LumiText>
        <LumiText tone="muted">
          Stav: {lockStatus.enabled ? (lockStatus.locked ? 'zamčeno' : 'odemčeno') : 'vypnuto'}
          {lockStatus.protection === 'origin_storage'
            ? ' · web: ochrana jen v rámci stejného prohlížeče/originu'
            : lockStatus.protection === 'secure_store'
              ? ' · systémové úložiště zařízení'
              : ''}
        </LumiText>
        {lockStatus.fault ? (
          <LumiText tone="muted">
            Úložiště zámku hlásí chybu a deník zůstává zamčený: {lockStatus.fault}
          </LumiText>
        ) : null}
        <LumiInput
          label="PIN (4–8 číslic)"
          value={pin}
          onChangeText={setPin}
          secureTextEntry
          autoCapitalize="none"
        />
        {!lockStatus.enabled ? (
          <>
            <LumiInput
              label="Potvrzení PIN"
              value={pinConfirm}
              onChangeText={setPinConfirm}
              secureTextEntry
              autoCapitalize="none"
            />
            <LumiButton
              title="Zapnout zámek"
              onPress={() => {
                if (pin !== pinConfirm) {
                  setError('PIN a potvrzení se musí shodovat.');
                  return;
                }
                void runtime.appLock
                  .enableWithPin(pin)
                  .then(() => runtime.appLock.getStatus())
                  .then((status) => {
                    setLockStatus(status);
                    setPin('');
                    setPinConfirm('');
                    setMessage('Zámek aplikace je zapnutý.');
                  })
                  .catch((err: unknown) => {
                    setError(err instanceof Error ? err.message : 'Zapnutí zámku selhalo');
                  });
              }}
            />
          </>
        ) : (
          <LumiButton
            title="Vypnout zámek"
            onPress={() => {
              void runtime.appLock
                .disable(pin)
                .then(() => runtime.appLock.getStatus())
                .then((status) => {
                  setLockStatus(status);
                  setPin('');
                  setMessage('Zámek aplikace je vypnutý.');
                })
                .catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : 'Vypnutí zámku selhalo');
                });
            }}
          />
        )}
      </LumiCard>

      <LumiCard>
        <LumiText variant="h3">Diagnostika</LumiText>
        <LumiText tone="muted">
          Technické verze, počty a kódy lokálních operací. Neobsahuje jméno dítěte,
          poznámky ani datum narození. Zálohu deníku nepřikládá.
        </LumiText>
        <LumiButton
          title="Připravit support report"
          onPress={() => {
            void (async () => {
              const nowMs = Date.now();
              const points = await runtime.checkpoints.list();
              const lock = await runtime.appLock.getStatus();
              const snapshot = await buildDiagnosticsSnapshot({
                unitOfWork: runtime.unitOfWork,
                checkpointCount: points.length,
                appLockEnabled: lock.enabled,
                nowMs,
                platform: caps.platform,
              });
              const report = buildSupportReport({
                nowMs,
                release: snapshot.releaseEvidence!,
                diagnostics: snapshot,
                localOperations: runtime.operationMetrics.snapshot(),
              });
              setDiagnostics(serializeSupportReport(report));
            })();
          }}
        />
        {diagnostics ? (
          <LumiInput
            label="Support report (zkopírujte)"
            value={diagnostics}
            onChangeText={setDiagnostics}
            multiline
          />
        ) : null}
      </LumiCard>

      <LumiCard>
        <LumiText variant="h3">Úplné smazání</LumiText>
        <LumiText tone="muted">
          Odstraní místní deník, koncepty, koš, indexy, body obnovy, naplánované připomínky a
          místní klíče. Externí exporty smažte ručně tam, kam jste je uložili.
        </LumiText>
        <LumiInput
          label='Pro potvrzení napište SMAZAT'
          value={wipeConfirm}
          onChangeText={setWipeConfirm}
          autoCapitalize="characters"
        />
        <LumiButton
          title="Smazat všechna místní data"
          loading={busy}
          onPress={() => {
            if (wipeConfirm.trim() !== 'SMAZAT') {
              setError('Pro výmaz napište SMAZAT.');
              return;
            }
            setBusy(true);
            setError(null);
            void wipeAllLocalData()
              .then((result) => {
                setMessage(
                  `Místní data smazána (${result.clearedCheckpoints} bodů obnovy). ${result.externalExportNote}`,
                );
                setWipeConfirm('');
              })
              .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'Výmaz selhal');
              })
              .finally(() => setBusy(false));
          }}
        />
      </LumiCard>

      <LumiCard>
        <LumiText variant="h3">Stavy dat</LumiText>
        <LumiText tone="muted">Uloženo v zařízení — operace je místně dokončená.</LumiText>
        <LumiText tone="muted">
          Obnova v tomto zařízení — místní body; nepřežijí ztrátu telefonu.
        </LumiText>
        <LumiText tone="muted">
          Přenosná záloha — šifrovaný soubor mimo živý deník; datum exportu nepotvrzuje existenci
          souboru.
        </LumiText>
        <LumiText tone="muted">
          Vzdálená záloha — v osobní verzi není k dispozici.
        </LumiText>
      </LumiCard>

      {message ? <LumiText>{message}</LumiText> : null}
      {error ? <LumiText tone="muted">{error}</LumiText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
