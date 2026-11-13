import { DOMAIN_VOCABULARY } from '../vocabulary.ts';
import type { SyncTransferPresentation } from './presentation.ts';

/**
 * Parent-facing durability vocabulary for family mode. Separates local save,
 * transfer queue, confirmed sync, and backup so a connected phone never
 * pretends it already knows undelivered events from another offline device.
 */

export type DurabilityKind = 'saved_locally' | 'awaiting_transfer' | 'synchronized' | 'backup';

export type DurabilityRow = {
  readonly kind: DurabilityKind;
  readonly label: string;
  readonly explanation: string;
  readonly active: boolean;
};

export type FamilyDurabilityPresentation = {
  readonly title: string;
  readonly primaryKind: DurabilityKind;
  readonly primaryLabel: string;
  readonly detailLine: string;
  readonly rows: readonly DurabilityRow[];
  readonly offlinePeerCaveat: string;
  readonly backupDistinctFromSync: string;
  /** Hard invariant — UI must never invert this. */
  readonly claimsOtherOfflineDevicesReceivedPending: false;
  readonly syncMeansOtherPhonesHaveEverything: false;
};

export type BackupDurabilityInput = {
  readonly remoteCompletedAtLabel: string | null;
  readonly portableAvailable: boolean;
};

/**
 * Build the four durability rows parents need to distinguish before trusting
 * "everything is synced" language on a single phone.
 */
export function buildFamilyDurabilityPresentation(input: {
  readonly familySyncEnabled: boolean;
  readonly transfer: SyncTransferPresentation | null;
  readonly backup: BackupDurabilityInput;
}): FamilyDurabilityPresentation | null {
  if (!input.familySyncEnabled) return null;

  const transfer = input.transfer;
  const pending =
    transfer != null &&
    (transfer.transferState === 'pending' ||
      transfer.transferState === 'in_flight' ||
      transfer.transferState === 'blocked' ||
      transfer.transferState === 'resync_required');

  const synchronizedActive =
    transfer != null &&
    transfer.transferState === 'idle' &&
    transfer.lastSuccessfulSyncAt != null &&
    !pending;

  const backupActive =
    input.backup.remoteCompletedAtLabel != null || input.backup.portableAvailable;

  let primaryKind: DurabilityKind = 'saved_locally';
  if (pending) primaryKind = 'awaiting_transfer';
  else if (synchronizedActive) primaryKind = 'synchronized';
  else if (backupActive) primaryKind = 'backup';

  const rows: DurabilityRow[] = [
    {
      kind: 'saved_locally',
      label: DOMAIN_VOCABULARY.savedLocally.uiLabelCs,
      explanation: 'Zápis je v tomto zařízení a přežije návrat do aplikace i výpadek sítě.',
      active: true,
    },
    {
      kind: 'awaiting_transfer',
      label: DOMAIN_VOCABULARY.awaitingTransfer.uiLabelCs,
      explanation:
        'Změna čeká na potvrzený přenos do rodinné služby. Jiný telefon ji ještě nemusí mít.',
      active: pending,
    },
    {
      kind: 'synchronized',
      label: DOMAIN_VOCABULARY.synchronized.uiLabelCs,
      explanation:
        'Známé změny z tohoto zařízení jsou potvrzené službou. Offline telefon může mít vlastní neodeslané zápisy.',
      active: synchronizedActive,
    },
    {
      kind: 'backup',
      label: DOMAIN_VOCABULARY.backupCreated.uiLabelCs,
      explanation:
        'Oddělená obnovitelná kopie s konkrétním datem a rozsahem — není totéž co přenos mezi telefony.',
      active: backupActive,
    },
  ];

  const primary = rows.find((row) => row.kind === primaryKind) ?? rows[0]!;

  let detailLine = primary.explanation;
  if (transfer?.transferState === 'resync_required') {
    detailLine =
      'Je potřeba znovu načíst chronologii. Neodeslané místní změny zůstávají v zařízení.';
  } else if (transfer?.transferState === 'blocked') {
    detailLine = 'Přenos je dočasně zablokovaný. Místní zápisy zůstávají uložené v tomto zařízení.';
  } else if (synchronizedActive && transfer?.lastSuccessfulSyncAt) {
    detailLine = `${DOMAIN_VOCABULARY.synchronized.uiLabelCs}. Poslední potvrzený přenos z tohoto zařízení.`;
  }

  return {
    title: 'Stav uložení a přenosu',
    primaryKind,
    primaryLabel: primary.label,
    detailLine,
    rows,
    offlinePeerCaveat: 'Připojený telefon nezná neodeslané události jiného offline telefonu.',
    backupDistinctFromSync:
      'Záloha je oddělená od synchronizace; dokončený přenos není automaticky vzdálená záloha.',
    claimsOtherOfflineDevicesReceivedPending: false,
    syncMeansOtherPhonesHaveEverything: false,
  };
}

/**
 * Short provenance line for a single record. Reuses the same vocabulary so
 * detail screens and the durability legend stay consistent.
 */
export function describeRecordTransferLine(input: {
  readonly transfer: SyncTransferPresentation;
  readonly lastSuccessfulSyncAtLabel: string | null;
}): string {
  if (input.transfer.transferState === 'pending' || input.transfer.transferState === 'in_flight') {
    return `${DOMAIN_VOCABULARY.awaitingTransfer.uiLabelCs}. ${DOMAIN_VOCABULARY.savedLocally.uiLabelCs}.`;
  }
  if (input.transfer.transferState === 'resync_required') {
    return 'Vyžaduje znovunačtení chronologie. Místní zápis zůstává.';
  }
  if (input.transfer.transferState === 'blocked') {
    return `Přenos zablokovaný. ${DOMAIN_VOCABULARY.savedLocally.uiLabelCs}.`;
  }
  if (input.lastSuccessfulSyncAtLabel) {
    return `${DOMAIN_VOCABULARY.synchronized.uiLabelCs}. Poslední přenos: ${input.lastSuccessfulSyncAtLabel}. Offline telefon může mít vlastní neodeslané změny.`;
  }
  return `Zatím bez potvrzeného přenosu. ${DOMAIN_VOCABULARY.savedLocally.uiLabelCs}.`;
}
