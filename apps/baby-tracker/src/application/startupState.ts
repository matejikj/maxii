/**
 * Personal client startup phases. Missing API/auth configuration is never a
 * failure — only local storage and key availability can block Ready.
 */
export type StartupPhase =
  | 'initializing'
  | 'migrating'
  | 'ready'
  | 'welcome'
  | 'key_unavailable'
  | 'recovery_required'
  | 'database_error';

export type StartupPresentation = {
  phase: StartupPhase;
  titleCs: string;
  bodyCs: string;
  allowsCareEntry: boolean;
};

export function presentStartupPhase(phase: StartupPhase): StartupPresentation {
  switch (phase) {
    case 'initializing':
      return {
        phase,
        titleCs: 'Připravujeme deník',
        bodyCs: 'Otevíráme místní úložiště. Přihlášení ani síť nepotřebujete.',
        allowsCareEntry: false,
      };
    case 'migrating':
      return {
        phase,
        titleCs: 'Aktualizujeme úložiště',
        bodyCs: 'Probíhá bezpečná místní migrace. Nevypínejte aplikaci.',
        allowsCareEntry: false,
      };
    case 'welcome':
      return {
        phase,
        titleCs: 'Vítejte v LUMI',
        bodyCs: 'Úvod můžete přeskočit a rovnou zapisovat péči o Miminko.',
        allowsCareEntry: true,
      };
    case 'ready':
      return {
        phase,
        titleCs: 'Připraveno',
        bodyCs: 'Místní deník je připravený k zápisu.',
        allowsCareEntry: true,
      };
    case 'key_unavailable':
      return {
        phase,
        titleCs: 'Úložiště je uzamčené',
        bodyCs: 'Nepodařilo se načíst klíč k šifrovanému deníku. Nový prázdný profil nevytváříme.',
        allowsCareEntry: false,
      };
    case 'recovery_required':
      return {
        phase,
        titleCs: 'Potřebná obnova',
        bodyCs: 'Místní data vyžadují obnovu ze zálohy. Prázdný profil se automaticky nezaloží.',
        allowsCareEntry: false,
      };
    case 'database_error':
      return {
        phase,
        titleCs: 'Úložiště není dostupné',
        bodyCs:
          'Deník se nepodařilo otevřít. Zápis je pozastavený, aby nevznikla druhá prázdná databáze.',
        allowsCareEntry: false,
      };
  }
}
