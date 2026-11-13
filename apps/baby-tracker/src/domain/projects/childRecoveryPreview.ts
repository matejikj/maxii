import {
  CHILD_PRIVATE_MODE_GATES,
  CHILD_PRIVATE_MODE_GATE_LABELS,
  type ChildPrivateModeGate,
} from './childMode';
import { canActivateChildPrivateMode } from './privacy';

export type ChildRecoveryPreview = {
  /** `blocked` until supported recovery is verified; never a live restore. */
  readonly status: 'blocked' | 'preview';
  readonly headline: string;
  readonly detail: string;
  /** Czech reason shown when blocked; null in preview. */
  readonly blockedReason: string | null;
  /** Own-workspace scopes only — never family history or caregiver data. */
  readonly scopeLabels: readonly string[];
  /** Other closed activation gates, in Czech, for honest context. */
  readonly otherBlockers: readonly string[];
  /** There is intentionally no restore button or credential reset here. */
  readonly restoreAction: null;
  readonly credentialsIncluded: false;
  readonly liveRestoreAvailable: false;
  readonly familyHistoryAutoTransfer: false;
};

export const CHILD_RECOVERY_SCOPE_LABELS: readonly string[] = [
  'Vlastní soukromé projekty',
  'Vlastní portfolio výběrů',
  'Vlastní odeslané ukázky (bez obnovení sdílení)',
];

/**
 * Gate-aware recovery preview for the child's own workspace. Describes what a
 * future owner-scoped recovery would cover; it never restores, resets a
 * credential, or pulls in family history.
 */
export function presentChildRecoveryPreview(
  input: {
    readonly gates?: Partial<Record<ChildPrivateModeGate, boolean>> | undefined;
  } = {},
): ChildRecoveryPreview {
  const gates = { ...CHILD_PRIVATE_MODE_GATES, ...(input.gates ?? {}) };
  const otherBlockers = canActivateChildPrivateMode(gates)
    .blockers.filter((code) => code !== 'supported_recovery')
    .map(
      (code) =>
        CHILD_PRIVATE_MODE_GATE_LABELS[code as keyof typeof CHILD_PRIVATE_MODE_GATE_LABELS] ?? code,
    );
  const common = {
    restoreAction: null,
    credentialsIncluded: false,
    liveRestoreAvailable: false,
    familyHistoryAutoTransfer: false,
    otherBlockers,
  } as const;

  if (!gates.supportedRecovery) {
    return {
      ...common,
      status: 'blocked',
      headline: 'Obnova vlastního prostoru zatím není dostupná',
      detail:
        'Nejdřív musí být ověřená podporovaná obnova přístupu dítěte. Do té doby nic neobnovujeme ani nepřevádíme z rodinných dat.',
      blockedReason: CHILD_PRIVATE_MODE_GATE_LABELS.supported_recovery,
      scopeLabels: [],
    };
  }
  return {
    ...common,
    status: 'preview',
    headline: 'Náhled obnovy vlastního prostoru',
    detail:
      'Obnova by se týkala jen vlastního prostoru. Živé obnovení ani reset přihlášení tu zatím není napojený a rodinná historie se nepřevádí automaticky.',
    blockedReason: null,
    scopeLabels: CHILD_RECOVERY_SCOPE_LABELS,
  };
}
