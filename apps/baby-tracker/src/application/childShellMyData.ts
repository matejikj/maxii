import {
  presentChildPrivateModeStatus,
  presentSelfManagementPreparation,
  type ChildShellSession,
  type ChildPrivateModeGate,
} from '../domain';

export type ChildShellMyDataSectionStatus = 'available' | 'unavailable' | 'summary';

export type ChildShellMyDataSection = {
  readonly id:
    | 'identity'
    | 'recovery'
    | 'membership'
    | 'shares'
    | 'export'
    | 'appearance'
    | 'wipe';
  readonly title: string;
  readonly status: ChildShellMyDataSectionStatus;
  readonly statusLabel: string;
  readonly detail: string;
};

export type ChildShellMyDataView = {
  readonly headline: string;
  readonly detail: string;
  readonly alias: string;
  readonly familyHistoryAutoTransfer: false;
  readonly sections: readonly ChildShellMyDataSection[];
  /** True only when the private workspace itself is active. */
  readonly screenAvailable: boolean;
};

function statusLabel(status: ChildShellMyDataSectionStatus): string {
  switch (status) {
    case 'available':
      return 'Dostupné';
    case 'summary':
      return 'Přehled';
    case 'unavailable':
      return 'Zatím nedostupné';
  }
}

/**
 * Truthful “My data and access” model for the child shell header. Unavailable
 * capabilities stay marked unavailable — never presented as working controls.
 */
export function presentChildShellMyData(input: {
  readonly session: ChildShellSession;
  readonly childPrivateModeActive: boolean;
  readonly portfolioCount: number;
  readonly activeShareCount: number;
  readonly appearanceStyleLabel: string;
  readonly gateOverrides?: Partial<Record<ChildPrivateModeGate, boolean>>;
}): ChildShellMyDataView {
  const preparation = presentSelfManagementPreparation(input.gateOverrides);
  const mode = presentChildPrivateModeStatus(input.gateOverrides);
  const active = input.childPrivateModeActive && mode.active;

  const recoveryReady = mode.blockers.every((row) => row.code !== 'supported_recovery');
  const identityReady = mode.blockers.every((row) => row.code !== 'verified_child_identity');

  const sections: ChildShellMyDataSection[] = [
    {
      id: 'identity',
      title: 'Vlastní přihlášení',
      status: active && identityReady ? 'available' : 'unavailable',
      statusLabel: statusLabel(active && identityReady ? 'available' : 'unavailable'),
      detail: active && identityReady
        ? `Aktivní alias „${input.session.principal.displayAlias}“. Živý credential reset zůstává oddělený provozní postup.`
        : 'Bez ověřené dětské identity se nepřihlašuj jako do hotového soukromého účtu.',
    },
    {
      id: 'recovery',
      title: 'Obnova přístupu',
      status: active && recoveryReady ? 'summary' : 'unavailable',
      statusLabel: statusLabel(active && recoveryReady ? 'summary' : 'unavailable'),
      detail: active && recoveryReady
        ? 'Brána obnovy je splněná pro aktivaci. Samotný živý reset hesla/credentialu tu zatím není napojený — nečekej falešné tlačítko Obnovit.'
        : 'Podporovaná obnova přístupu dítěte ještě není ověřená.',
    },
    {
      id: 'membership',
      title: 'Členství',
      status: active ? 'summary' : 'unavailable',
      statusLabel: statusLabel(active ? 'summary' : 'unavailable'),
      detail: active
        ? input.session.principal.linkedChildProfileId
          ? 'Propojený dětský profil je známý. Správa rodinného členství nepřidává rodiči přístup k private datům.'
          : 'Účet zatím nemá propojený profil dítěte. To samo o sobě neotevírá cizí rodinnou historii.'
        : 'Členství se zobrazí až v aktivním dětském prostoru.',
    },
    {
      id: 'shares',
      title: 'Sdílení a portfolio',
      status: active ? 'summary' : 'unavailable',
      statusLabel: statusLabel(active ? 'summary' : 'unavailable'),
      detail: active
        ? `Vlastní výběry v portfoliu: ${input.portfolioCount}. Aktivní ukázky: ${input.activeShareCount}. Rodič vidí jen výslovně odeslané ukázky.`
        : 'Seznam sdílení a portfolia zůstává skrytý, dokud není aktivní vlastní prostor.',
    },
    {
      id: 'export',
      title: 'Export a obnova dat',
      status: active ? 'summary' : 'unavailable',
      statusLabel: statusLabel(active ? 'summary' : 'unavailable'),
      detail: active
        ? 'Owner-scoped export vlastních dat je připravený softwarově. Převzetí cizí rodinné historie není automatické.'
        : 'Export vlastního prostoru není dostupný mimo aktivní dětský režim.',
    },
    {
      id: 'appearance',
      title: 'Vzhled',
      status: active ? 'available' : 'unavailable',
      statusLabel: statusLabel(active ? 'available' : 'unavailable'),
      detail: active
        ? `Aktuální volba: ${input.appearanceStyleLabel}. Změna vzhledu neprokazuje jinou identitu.`
        : 'Úprava vzhledu v dětském profilu čeká na aktivní prostor.',
    },
    {
      id: 'wipe',
      title: 'Výmaz vlastních dat',
      status: 'unavailable',
      statusLabel: statusLabel('unavailable'),
      detail:
        'Výslovný výmaz vlastního workspace vyžaduje ověřený destruktivní průchod. Tlačítko tu záměrně chybí, aby nevznikla falešná jistota.',
    },
  ];

  return {
    headline: active ? preparation.headline : 'Moje data a přístupy',
    detail: active
      ? preparation.detail
      : 'Tento náhled nic neaktivuje. Bez splněných bran zůstávají citlivé akce nedostupné.',
    alias: input.session.principal.displayAlias,
    familyHistoryAutoTransfer: false,
    sections,
    screenAvailable: active,
  };
}
