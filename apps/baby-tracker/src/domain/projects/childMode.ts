import { canActivateChildPrivateMode } from './privacy';

/**
 * Child-private workspace stays inactive until verified identity, recovery,
 * a dedicated device/account, and the legal/operational framework are ready.
 * Personal/family caregiver builds intentionally keep every gate closed.
 */
export const CHILD_PRIVATE_MODE_GATES = {
  verifiedChildIdentity: false,
  supportedRecovery: false,
  dedicatedDeviceOrAccount: false,
  legalOperationalFrameworkReady: false,
} as const;

export type ChildPrivateModeGate = keyof typeof CHILD_PRIVATE_MODE_GATES;

/** Machine codes returned by canActivateChildPrivateMode blockers. */
export type ChildPrivateModeBlockerCode =
  | 'verified_child_identity'
  | 'supported_recovery'
  | 'dedicated_device_or_account'
  | 'legal_operational_framework';

/** Czech copy shown in Settings so caregivers understand why private mode stays off. */
export const CHILD_PRIVATE_MODE_GATE_LABELS: Record<ChildPrivateModeBlockerCode, string> = {
  verified_child_identity: 'Samostatná ověřená dětská identita ještě není k dispozici',
  supported_recovery: 'Podporované obnovení přístupu dítěte ještě není ověřené',
  dedicated_device_or_account: 'Vlastní zařízení nebo účet dítěte ještě není připravený',
  legal_operational_framework: 'Právní a provozní rámec dětského režimu ještě není připravený',
};

export function isChildPrivateModeActive(): boolean {
  return canActivateChildPrivateMode(CHILD_PRIVATE_MODE_GATES).active;
}

export function childPrivateModeBlockers(): string[] {
  return canActivateChildPrivateMode(CHILD_PRIVATE_MODE_GATES).blockers;
}

export type ChildPrivateModePresentation = {
  active: boolean;
  headline: string;
  detail: string;
  blockers: Array<{ code: ChildPrivateModeBlockerCode; label: string }>;
};

/**
 * Settings-facing status: private workspace stays inactive on the personal path
 * until identity, consent, shell, and recovery all exist.
 */
export function presentChildPrivateModeStatus(
  overrides: Partial<Record<ChildPrivateModeGate, boolean>> = {},
): ChildPrivateModePresentation {
  const gates = { ...CHILD_PRIVATE_MODE_GATES, ...overrides };
  const blockers = canActivateChildPrivateMode(gates).blockers.map((code) => {
    const typed = code as ChildPrivateModeBlockerCode;
    return {
      code: typed,
      label: CHILD_PRIVATE_MODE_GATE_LABELS[typed] ?? code,
    };
  });
  if (blockers.length === 0) {
    return {
      active: true,
      headline: 'Soukromý prostor dítěte je aktivní',
      detail:
        'Návrhy rodičů může dítě přijmout do vlastního prostoru. Rodič uvidí jen doručení, ne přijetí nebo odmítnutí.',
      blockers: [],
    };
  }
  return {
    active: false,
    headline: 'Soukromý prostor dítěte zatím není aktivní',
    detail:
      'Projekty zůstávají v rodinném režimu. Návrh můžete připravit a společně zahájit jako rodinný projekt — bez fiktivního soukromí dítěte.',
    blockers,
  };
}

export type SelfManagementPreparation = {
  /** True only when a verified child workspace can host its own data screen. */
  screenAvailable: boolean;
  headline: string;
  detail: string;
  previewItems: readonly string[];
  /** Age or payment never silently copies another family's private history. */
  familyHistoryAutoTransfer: false;
};

/**
 * Preparation for a later “My data and access” screen. While child-private mode
 * is inactive this stays a truthful preview — not a fake private control panel.
 */
export function presentSelfManagementPreparation(
  overrides: Partial<Record<ChildPrivateModeGate, boolean>> = {},
): SelfManagementPreparation {
  const childStatus = presentChildPrivateModeStatus(overrides);
  const previewItems = [
    'Vlastní portfolio a výslovně sdílené ukázky',
    'Členství a aktivní přístupy',
    'Obnova vlastního přístupu',
    'Možnost převzít jen vybrané historické údaje po ověření',
  ] as const;
  if (childStatus.active) {
    return {
      screenAvailable: true,
      headline: 'Moje data a přístupy',
      detail:
        'Vlastní prostor je aktivní. Převzetí cizí rodinné historie není automatické a vyžaduje samostatné ověření.',
      previewItems,
      familyHistoryAutoTransfer: false,
    };
  }
  return {
    screenAvailable: false,
    headline: 'Příprava samostatné správy',
    detail:
      'Náhled budoucí obrazovky „Moje data a přístupy“. Bez ověřeného dětského účtu zůstává pečovatelský režim — platba ani věk nepřevedou cizí rodinnou historii.',
    previewItems,
    familyHistoryAutoTransfer: false,
  };
}
