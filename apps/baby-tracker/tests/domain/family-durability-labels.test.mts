import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuthorshipLine,
  buildFamilyDurabilityPresentation,
  buildSyncTransferPresentation,
  describeRecordTransferLine,
  DOMAIN_VOCABULARY,
} from '../../src/domain/index.ts';

test('family durability legend exposes four distinct parent labels', () => {
  const transfer = buildSyncTransferPresentation({
    pendingTransferCount: 1,
    inFlight: false,
    lastSuccessfulSyncAt: null,
  });
  const presentation = buildFamilyDurabilityPresentation({
    familySyncEnabled: true,
    transfer,
    backup: { remoteCompletedAtLabel: null, portableAvailable: false },
  });
  assert.ok(presentation);
  assert.deepEqual(
    presentation!.rows.map((row) => row.label),
    [
      DOMAIN_VOCABULARY.savedLocally.uiLabelCs,
      DOMAIN_VOCABULARY.awaitingTransfer.uiLabelCs,
      DOMAIN_VOCABULARY.synchronized.uiLabelCs,
      DOMAIN_VOCABULARY.backupCreated.uiLabelCs,
    ],
  );
  assert.equal(presentation!.primaryKind, 'awaiting_transfer');
  assert.equal(presentation!.claimsOtherOfflineDevicesReceivedPending, false);
  assert.equal(presentation!.syncMeansOtherPhonesHaveEverything, false);
  assert.match(presentation!.offlinePeerCaveat, /nezná neodeslané/);
});

test('synchronized status never claims other offline phones already have everything', () => {
  const transfer = buildSyncTransferPresentation({
    pendingTransferCount: 0,
    inFlight: false,
    lastSuccessfulSyncAt: '2026-11-09T09:00:00.000Z',
  });
  const presentation = buildFamilyDurabilityPresentation({
    familySyncEnabled: true,
    transfer,
    backup: {
      remoteCompletedAtLabel: '9. 11. 2026',
      portableAvailable: true,
    },
  });
  assert.ok(presentation);
  assert.equal(presentation!.primaryKind, 'synchronized');
  assert.equal(presentation!.syncMeansOtherPhonesHaveEverything, false);
  assert.match(presentation!.backupDistinctFromSync, /oddělená od synchronizace/);
  const syncRow = presentation!.rows.find((row) => row.kind === 'synchronized');
  assert.match(syncRow?.explanation ?? '', /Offline telefon/);
  assert.doesNotMatch(
    JSON.stringify(presentation),
    /ostatní offline telefony už mají všechny změny/i,
  );
});

test('personal mode without family sync hides the durability legend', () => {
  const presentation = buildFamilyDurabilityPresentation({
    familySyncEnabled: false,
    transfer: null,
    backup: { remoteCompletedAtLabel: null, portableAvailable: true },
  });
  assert.equal(presentation, null);
});

test('record transfer line reuses vocabulary and keeps local-save truth', () => {
  const pending = buildSyncTransferPresentation({
    pendingTransferCount: 2,
    inFlight: false,
    lastSuccessfulSyncAt: null,
  });
  const pendingLine = describeRecordTransferLine({
    transfer: pending,
    lastSuccessfulSyncAtLabel: null,
  });
  assert.match(pendingLine, /Čeká na přenos/);
  assert.match(pendingLine, /Uloženo v zařízení/);

  const synced = buildSyncTransferPresentation({
    pendingTransferCount: 0,
    inFlight: false,
    lastSuccessfulSyncAt: '2026-11-09T09:00:00.000Z',
  });
  const syncedLine = describeRecordTransferLine({
    transfer: synced,
    lastSuccessfulSyncAtLabel: '9. 11. 2026 10:00',
  });
  assert.match(syncedLine, /Synchronizováno/);
  assert.match(syncedLine, /Offline telefon/);

  const authorship = buildAuthorshipLine({
    originalAuthorLabel: 'Anna',
    lastEditorLabel: null,
    transfer: synced,
    lastSuccessfulSyncAtLabel: '9. 11. 2026 10:00',
  });
  assert.equal(authorship.transferLine, syncedLine);
});
