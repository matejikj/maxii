import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { LumiButton, LumiInput, LumiText } from '@lumi/forest-design/native';
import { buildDiagnosticsSnapshot, buildSupportReport, presentChildShellAvailability,
  readChildPrivateModeSettingsStatus, serializeSupportReport } from '../../application';
import { useBootstrap } from '../../app/session/BootstrapContext';
import { AppearanceSettings } from './AppearanceSettings';
import { ReminderSettings } from './ReminderSettings';
import { UnitsSettings } from './UnitsSettings';
import type { SettingsSection } from './settingsPresentation';
import { SettingsCard, SettingsDisclosureButton, SettingsFeedback, useSettingsAction } from './SettingsVisuals';

/** Section bodies stay independent: drafts and feedback belong to the relevant setting. */
export function SettingsPanel({ section }: { section: SettingsSection }) {
  if (section === 'appearance') return <AppearanceSettings />;
  if (section === 'reminders') return <ReminderSettings />;
  if (section === 'units') return <UnitsSettings />;
  if (section === 'privacy') return <PrivacySettings />;
  if (section === 'help') return <HelpSettings />;
  return null;
}

function PrivacySettings() {
  const { runtime, wipeAllLocalData } = useBootstrap();
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [lockStatus, setLockStatus] = useState<{
    enabled: boolean; locked: boolean; fault: string | null;
    protection: 'secure_store' | 'origin_storage' | 'unavailable';
  } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeConfirm, setWipeConfirm] = useState('');
  const lock = useSettingsAction();
  const wipe = useSettingsAction();
  useEffect(() => {
    let cancelled = false;
    void runtime?.appLock.getStatus().then((status) => {
      if (!cancelled) setLockStatus(status);
    }).catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [runtime]);
  if (!runtime) return null;
  return <View style={{ gap: 18 }}>
    <SettingsCard title="Zámek aplikace" description="Volitelný PIN chrání otevření deníku. Po návratu do aplikace ho zadáte znovu.">
      <LumiText variant="bodyStrong">{loadError ? 'Stav zámku se nepodařilo načíst.' : !lockStatus ? 'Načítám stav zámku…' : lockStatus.enabled ? 'Zámek je zapnutý' : 'Zámek je vypnutý'}</LumiText>
      <LumiText variant="caption" tone="muted">PIN nemění šifrovací klíč deníku. Pro případ ztráty PINu si uchovejte přenosnou zálohu a její heslo.</LumiText>
      {lockStatus?.protection === 'origin_storage' ? <LumiText variant="caption" tone="muted">Na webu je zámek vázaný na tento prohlížeč.</LumiText> : null}
      {lockStatus?.fault ? <LumiText tone="danger">Úložiště zámku hlásí chybu. Deník zůstává zamčený.</LumiText> : null}
      <LumiInput label={lockStatus?.enabled ? 'Současný PIN' : 'Nový PIN (4–8 číslic)'} value={pin}
        onChangeText={setPin} secureTextEntry keyboardType="number-pad" maxLength={8} editable={!lock.busy && !!lockStatus}
        testID="settings-lock-pin" />
      {!lockStatus?.enabled ? <LumiInput label="Zopakujte nový PIN" value={pinConfirm} onChangeText={setPinConfirm}
        secureTextEntry keyboardType="number-pad" maxLength={8} editable={!lock.busy && !!lockStatus} /> : null}
      <LumiButton title={lockStatus?.enabled ? 'Vypnout zámek' : 'Zapnout zámek'} fullWidth loading={lock.busy}
        disabled={!lockStatus || !!lockStatus.fault} onPress={() => void lock.run(async () => {
          if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN musí obsahovat 4 až 8 číslic.');
          if (lockStatus?.enabled) await runtime.appLock.disable(pin);
          else {
            if (pin !== pinConfirm) throw new Error('PIN a jeho potvrzení se musí shodovat.');
            await runtime.appLock.enableWithPin(pin);
          }
          setLockStatus(await runtime.appLock.getStatus());
          setPin(''); setPinConfirm('');
        }, lockStatus?.enabled ? 'Zámek je vypnutý.' : 'Zámek je zapnutý.')} />
      <SettingsFeedback action={lock} />
    </SettingsCard>
    <SettingsCard title="Vaše data, vaše rozhodnutí" description="Deník funguje bez účtu. Místní data zůstávají v tomto zařízení.">
      <LumiText variant="caption" tone="muted">Před výměnou telefonu nebo mazáním si v sekci Zálohy a fotografie uložte přenosnou zálohu mimo aplikaci.</LumiText>
    </SettingsCard>
    <SettingsCard title="Úplné smazání" danger description="Trvale odstraní místní data všech dětí v tomto zařízení.">
      <SettingsDisclosureButton expanded={wipeOpen} title={wipeOpen ? 'Zrušit mazání' : 'Možnosti smazání dat'} disabled={wipe.busy}
        testID="settings-open-wipe" onPress={() => { setWipeOpen(!wipeOpen); setWipeConfirm(''); }} />
      {wipeOpen ? <>
        <LumiText variant="caption" tone="muted">Odstraní deník, koncepty, koš, body obnovy, připomínky a místní klíče. Externí exporty smažte ručně tam, kam jste je uložili.</LumiText>
        <LumiInput label="Pro potvrzení napište SMAZAT" value={wipeConfirm} onChangeText={setWipeConfirm}
          autoCapitalize="characters" autoCorrect={false} editable={!wipe.busy} />
        <LumiButton title="Smazat všechna místní data" fullWidth variant="destructive" loading={wipe.busy}
          disabled={wipeConfirm.trim() !== 'SMAZAT'} onPress={() => void wipe.run(async () => {
            if (wipeConfirm.trim() !== 'SMAZAT') throw new Error('Pro výmaz napište SMAZAT.');
            await wipeAllLocalData();
            setWipeConfirm(''); setWipeOpen(false);
          }, 'Místní data smazána. Externí exporty zůstávají tam, kam jste je uložili.')} />
      </> : null}
      <SettingsFeedback action={wipe} />
    </SettingsCard>
  </View>;
}

function HelpSettings() {
  const { runtime } = useBootstrap();
  const [diagnostics, setDiagnostics] = useState<string | null>(null);
  const [details, setDetails] = useState(false);
  const report = useSettingsAction();
  if (!runtime) return null;
  const status = readChildPrivateModeSettingsStatus();
  return <View style={{ gap: 18 }}>
    <SettingsCard title="Kde jsou vaše vzpomínky?">
      <LumiText variant="bodyStrong">Uloženo v zařízení</LumiText>
      <LumiText variant="caption" tone="muted">Záznam je uložený v tomto telefonu nebo prohlížeči. K psaní nepotřebujete účet ani připojení.</LumiText>
      <LumiText variant="bodyStrong">Obnova v tomto zařízení</LumiText>
      <LumiText variant="caption" tone="muted">Místní body obnovy pomohou vrátit deník do dřívějšího stavu. Při ztrátě telefonu se ztratí také.</LumiText>
      <LumiText variant="bodyStrong">Přenosná záloha</LumiText>
      <LumiText variant="caption" tone="muted">Šifrovaný soubor, který si uložíte mimo aplikaci. K obnovení potřebujete soubor a jeho heslo.</LumiText>
      <LumiText variant="bodyStrong">Vzdálená záloha</LumiText>
      <LumiText variant="caption" tone="muted">V osobní verzi není k dispozici. Vzdálená záloha nenahrazuje vlastní přenosný soubor.</LumiText>
    </SettingsCard>
    <SettingsCard title="Diagnostika" description="Pokud řešíte potíže s aplikací, můžete připravit podklady pro podporu.">
      <LumiText variant="caption" tone="muted">Zpráva obsahuje technické verze, počty a kódy operací. Neobsahuje jméno dítěte, datum narození, poznámky ani zálohu deníku. Nic se samo neodesílá.</LumiText>
      <LumiButton title="Připravit zprávu pro podporu" fullWidth variant="secondary" loading={report.busy}
        onPress={() => void report.run(async () => {
          const nowMs = Date.now();
          const points = await runtime.checkpoints.list();
          const lock = await runtime.appLock.getStatus();
          const snapshot = await buildDiagnosticsSnapshot({ unitOfWork: runtime.unitOfWork,
            checkpointCount: points.length, appLockEnabled: lock.enabled, nowMs,
            platform: runtime.reminders.getCapabilities().platform });
          setDiagnostics(serializeSupportReport(buildSupportReport({ nowMs, release: snapshot.releaseEvidence!,
            diagnostics: snapshot, localOperations: runtime.operationMetrics.snapshot() })));
        }, 'Zpráva je připravená. Text můžete označit a zkopírovat.')} />
      <SettingsFeedback action={report} />
      {diagnostics ? <LumiText selectable variant="caption" accessibilityLabel="Zpráva pro podporu">{diagnostics}</LumiText> : null}
    </SettingsCard>
    <SettingsCard title="Soukromý prostor dítěte" testID="child-private-mode-status">
      <LumiText>{status.headline}</LumiText>
      <LumiText variant="caption" tone="muted">{status.detail}</LumiText>
      <SettingsDisclosureButton expanded={details} title={details ? 'Skrýt podrobnosti' : 'Zobrazit podrobnosti dostupnosti'}  onPress={() => setDetails(!details)} />
      {details ? <>
        {status.blockers.map((blocker) => <LumiText key={blocker.code} variant="caption" tone="muted">· {blocker.label}</LumiText>)}
        <LumiText variant="caption" tone="muted" testID="child-shell-tab-preview">Připravované sekce: {presentChildShellAvailability().tabs.map((tab) => tab.title).join(' · ')}.</LumiText>
      </> : null}
    </SettingsCard>
  </View>;
}
