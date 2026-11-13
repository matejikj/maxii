import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHILD_SHELL_TABS,
  asActorId,
  asChildId,
  attemptChildShellActivation,
} from '../../src/domain/index.ts';
import { presentChildRecoveryPreview } from '../../src/domain/index.ts';
import { presentChildShellMyData } from '../../src/application/childShellMyData.ts';
import { previewChildPrivateExport } from '../../src/application/exportChildPrivateWorkspace.ts';

const openGates = {
  verifiedChildIdentity: true,
  supportedRecovery: true,
  dedicatedDeviceOrAccount: true,
  legalOperationalFrameworkReady: true,
} as const;

function activatedSession() {
  const result = attemptChildShellActivation({
    gates: openGates,
    appUserId: asActorId('child_my_data'),
    displayAlias: 'Mája',
    linkedChildProfileId: asChildId('child_a'),
    firstEntryCompleted: true,
  });
  assert.equal(result.ok, true);
  return result.session!;
}

test('inactive mode marks sensitive actions unavailable and never auto-transfers family history', () => {
  const session = activatedSession();
  const view = presentChildShellMyData({
    session,
    childPrivateModeActive: false,
    portfolioCount: 3,
    activeShareCount: 1,
    appearanceStyleLabel: 'Les',
  });
  assert.equal(view.familyHistoryAutoTransfer, false);
  assert.equal(view.screenAvailable, false);
  assert.ok(view.sections.every((row) => row.status === 'unavailable'));
  assert.ok(view.sections.some((row) => row.id === 'wipe' && /chybí/i.test(row.detail)));
});

test('active mode shows honest summaries without inventing live recovery or wipe', () => {
  const session = activatedSession();
  assert.equal(session.tabs.length, CHILD_SHELL_TABS.length);

  const view = presentChildShellMyData({
    session,
    childPrivateModeActive: true,
    portfolioCount: 2,
    activeShareCount: 1,
    appearanceStyleLabel: 'Dílna',
    gateOverrides: openGates,
  });
  assert.equal(view.screenAvailable, true);
  assert.equal(view.headline, 'Moje data a přístupy');
  assert.equal(view.familyHistoryAutoTransfer, false);

  const identity = view.sections.find((row) => row.id === 'identity');
  assert.equal(identity?.status, 'available');
  assert.match(identity?.detail ?? '', /Mája/);

  const recovery = view.sections.find((row) => row.id === 'recovery');
  assert.equal(recovery?.status, 'summary');
  assert.match(recovery?.detail ?? '', /není napojený|nečekej falešné/i);

  const shares = view.sections.find((row) => row.id === 'shares');
  assert.equal(shares?.status, 'summary');
  assert.match(shares?.detail ?? '', /2/);
  assert.match(shares?.detail ?? '', /1/);

  const wipe = view.sections.find((row) => row.id === 'wipe');
  assert.equal(wipe?.status, 'available');
  assert.equal(wipe?.statusLabel, 'Dostupné');
  assert.match(wipe?.detail ?? '', /SMAZAT VLASTNI/);
  assert.match(wipe?.detail ?? '', /Live zrušení účtu to není/i);
});

function exportPreviewFor(ownerId: string, withRows: boolean) {
  const owner = asActorId(ownerId);
  const none = { projects: [], portfolio: [], shares: [] };
  void withRows;
  return previewChildPrivateExport({
    ownerAppUserId: owner,
    childPrivateModeActive: true,
    ...none,
  });
}

test('export section never claims ready without loaded counts', () => {
  const view = presentChildShellMyData({
    session: activatedSession(),
    childPrivateModeActive: true,
    portfolioCount: 0,
    activeShareCount: 0,
    appearanceStyleLabel: 'Les',
    gateOverrides: openGates,
  });
  const exportSection = view.sections.find((row) => row.id === 'export');
  assert.equal(view.exportPreview, null);
  assert.doesNotMatch(exportSection?.detail ?? '', /připravený/i);
  assert.match(exportSection?.detail ?? '', /nenačetly/);
});

test('export section shows manifest counts and distinguishes prepared archive', () => {
  const session = activatedSession();
  const preview = {
    available: true,
    manifest: {
      ownerAppUserId: session.principal.appUserId,
      projectCount: 4,
      portfolioCount: 3,
      shareCount: 2,
      activeShareCount: 1,
      revokedShareCount: 1,
      excludedFamilyHistory: true as const,
      excludedCategories: [],
    },
    summaryLines: ['Projekty: 4', 'Portfolio: 3'],
    fileGenerated: false,
    archive: null,
    archiveJson: null,
  };
  const view = presentChildShellMyData({
    session,
    childPrivateModeActive: true,
    portfolioCount: 3,
    activeShareCount: 1,
    appearanceStyleLabel: 'Les',
    gateOverrides: openGates,
    exportPreview: preview,
  });
  const exportSection = view.sections.find((row) => row.id === 'export');
  assert.match(exportSection?.detail ?? '', /Projekty: 4/);
  assert.match(exportSection?.detail ?? '', /ještě nepřipravil/);
  assert.equal(view.exportPreview?.manifest?.projectCount, 4);

  const withFile = presentChildShellMyData({
    session,
    childPrivateModeActive: true,
    portfolioCount: 3,
    activeShareCount: 1,
    appearanceStyleLabel: 'Les',
    gateOverrides: openGates,
    exportPreview: { ...preview, fileGenerated: true },
  });
  assert.match(
    withFile.sections.find((row) => row.id === 'export')?.detail ?? '',
    /archiv je připravený/i,
  );
});

test('export preview built for another principal is ignored', () => {
  const view = presentChildShellMyData({
    session: activatedSession(),
    childPrivateModeActive: true,
    portfolioCount: 0,
    activeShareCount: 0,
    appearanceStyleLabel: 'Les',
    gateOverrides: openGates,
    exportPreview: exportPreviewFor('someone_else', false),
  });
  assert.equal(view.exportPreview, null);
});

test('inactive mode never surfaces export counts even when a preview is passed', () => {
  const session = activatedSession();
  const view = presentChildShellMyData({
    session,
    childPrivateModeActive: false,
    portfolioCount: 0,
    activeShareCount: 0,
    appearanceStyleLabel: 'Les',
    exportPreview: exportPreviewFor('child_my_data', false),
  });
  const exportSection = view.sections.find((row) => row.id === 'export');
  assert.equal(exportSection?.status, 'unavailable');
  assert.match(exportSection?.detail ?? '', /není dostupný/);
});

test('recovery preview is blocked with a Czech reason while recovery gate is closed', () => {
  const blocked = presentChildRecoveryPreview();
  assert.equal(blocked.status, 'blocked');
  assert.match(blocked.blockedReason ?? '', /obnovení přístupu/i);
  assert.deepEqual(blocked.scopeLabels, []);
  assert.equal(blocked.restoreAction, null);
  assert.equal(blocked.credentialsIncluded, false);
  assert.equal(blocked.liveRestoreAvailable, false);
  assert.equal(blocked.familyHistoryAutoTransfer, false);
  assert.ok(blocked.otherBlockers.length >= 3);

  const view = presentChildShellMyData({
    session: activatedSession(),
    childPrivateModeActive: false,
    portfolioCount: 0,
    activeShareCount: 0,
    appearanceStyleLabel: 'Les',
  });
  const recovery = view.sections.find((row) => row.id === 'recovery');
  assert.equal(recovery?.status, 'unavailable');
  assert.match(recovery?.detail ?? '', /Podporované obnovení/);
  assert.equal(view.recoveryPreview.status, 'blocked');
});

test('recovery preview with gates open lists own-workspace scopes and no restore action', () => {
  const preview = presentChildRecoveryPreview({ gates: openGates });
  assert.equal(preview.status, 'preview');
  assert.equal(preview.blockedReason, null);
  assert.ok(preview.scopeLabels.length > 0);
  assert.ok(
    preview.scopeLabels.every(
      (label) => !/rodin|pečovat|deník/i.test(label.replace('bez obnovení sdílení', '')),
    ),
  );
  assert.equal(preview.restoreAction, null);
  assert.equal(preview.credentialsIncluded, false);
  assert.equal(preview.liveRestoreAvailable, false);
  assert.equal(preview.familyHistoryAutoTransfer, false);
  assert.deepEqual(preview.otherBlockers, []);

  const onlyRecovery = presentChildRecoveryPreview({ gates: { supportedRecovery: true } });
  assert.equal(onlyRecovery.status, 'preview');
  assert.equal(onlyRecovery.otherBlockers.length, 3);

  const view = presentChildShellMyData({
    session: activatedSession(),
    childPrivateModeActive: true,
    portfolioCount: 0,
    activeShareCount: 0,
    appearanceStyleLabel: 'Les',
    gateOverrides: openGates,
  });
  const recovery = view.sections.find((row) => row.id === 'recovery');
  assert.equal(recovery?.status, 'summary');
  assert.match(recovery?.detail ?? '', /Vlastní soukromé projekty/);
  assert.match(recovery?.detail ?? '', /nečekej falešné/i);
});
