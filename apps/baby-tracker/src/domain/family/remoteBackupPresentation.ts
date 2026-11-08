/**
 * Parent-facing remote backup status. Completion means a verified stored copy,
 * never a started upload alone.
 */

export type RemoteBackupPresentation = {
  readonly title: string;
  readonly statusLine: string;
  readonly lastCompletedLabel: string | null;
  readonly scopeLine: string;
  readonly claimsPhoneProtectedAutomatically: false;
  readonly distinctFromLocalSave: true;
};

export function presentRemoteBackupStatus(input: {
  readonly enabled: boolean;
  readonly lastCompletedAtLabel: string | null;
  readonly lastAttemptStatus: 'idle' | 'running' | 'completed' | 'failed';
  readonly scope: 'ops_host' | 'family_archive' | 'none';
}): RemoteBackupPresentation | null {
  if (!input.enabled) return null;

  let statusLine = 'Vzdálená záloha zatím nemá potvrzenou kopii.';
  if (input.lastAttemptStatus === 'running') {
    statusLine = 'Probíhá ukládání vzdálené kopie. Dokončení přijde až po ověření uložení.';
  } else if (input.lastAttemptStatus === 'failed') {
    statusLine =
      'Poslední pokus o vzdálenou zálohu selhal. Místní deník zůstává beze změny.';
  } else if (input.lastCompletedAtLabel) {
    statusLine = `Poslední potvrzená vzdálená kopie: ${input.lastCompletedAtLabel}.`;
  }

  const scopeLine =
    input.scope === 'family_archive'
      ? 'Rozsah: archiv rodiny (oddělený od běžné synchronizace).'
      : input.scope === 'ops_host'
        ? 'Rozsah: provozní obnova služby (není uživatelský download).'
        : 'Rozsah zatím není nastavený.';

  return {
    title: 'Vzdálená záloha',
    statusLine,
    lastCompletedLabel: input.lastCompletedAtLabel,
    scopeLine,
    claimsPhoneProtectedAutomatically: false,
    distinctFromLocalSave: true,
  };
}
