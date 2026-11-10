import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHILD_SHELL_TABS,
  asActorId,
  asChildId,
  attemptChildShellActivation,
} from '../../src/domain/index.ts';
import { presentChildShellMyData } from '../../src/application/childShellMyData.ts';

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
  assert.equal(wipe?.status, 'unavailable');
  assert.equal(wipe?.statusLabel, 'Zatím nedostupné');
});
