import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FAMILY_ATTACHMENT_QUOTA,
  authorizeFamilyAttachmentAction,
  isDisposableAttachmentCopy,
  planFamilyAttachmentReservation,
} from '../src/attachments.ts';

test('family attachment reservation is atomic-shaped and rejects over-budget intents', () => {
  const ok = planFamilyAttachmentReservation({
    budgetBytes: FAMILY_ATTACHMENT_QUOTA.familyBudgetBytes,
    usedBytes: 0,
    reservedBytes: 0,
    pendingReservationBudgetBytes: FAMILY_ATTACHMENT_QUOTA.pendingReservationBudgetBytes,
    requestBytes: 1024,
  });
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.nextReservedBytes, 1024);

  const pending = planFamilyAttachmentReservation({
    budgetBytes: FAMILY_ATTACHMENT_QUOTA.familyBudgetBytes,
    usedBytes: 0,
    reservedBytes: FAMILY_ATTACHMENT_QUOTA.pendingReservationBudgetBytes,
    pendingReservationBudgetBytes: FAMILY_ATTACHMENT_QUOTA.pendingReservationBudgetBytes,
    requestBytes: 1,
  });
  assert.equal(pending.ok, false);
  if (pending.ok) return;
  assert.equal(pending.reason, 'pending_budget_exceeded');

  const full = planFamilyAttachmentReservation({
    budgetBytes: 1000,
    usedBytes: 900,
    reservedBytes: 100,
    pendingReservationBudgetBytes: FAMILY_ATTACHMENT_QUOTA.pendingReservationBudgetBytes,
    requestBytes: 1,
  });
  assert.equal(full.ok, false);
  if (full.ok) return;
  assert.equal(full.reason, 'quota_exceeded');
});

test('only cache copies are disposable; own/pending/pinned stay durable', () => {
  assert.equal(isDisposableAttachmentCopy('cache'), true);
  assert.equal(isDisposableAttachmentCopy('own'), false);
  assert.equal(isDisposableAttachmentCopy('pending'), false);
  assert.equal(isDisposableAttachmentCopy('pinned'), false);
});

test('attachment tombstone stays admin-only while caregivers may upload and read', () => {
  assert.equal(
    authorizeFamilyAttachmentAction({
      membershipActive: true,
      role: 'caregiver',
      action: 'upload',
    }).allow,
    true,
  );
  assert.equal(
    authorizeFamilyAttachmentAction({
      membershipActive: true,
      role: 'caregiver',
      action: 'tombstone',
    }).allow,
    false,
  );
  assert.equal(
    authorizeFamilyAttachmentAction({
      membershipActive: true,
      role: 'admin',
      action: 'tombstone',
    }).allow,
    true,
  );
  assert.equal(
    authorizeFamilyAttachmentAction({
      membershipActive: false,
      role: null,
      action: 'read',
    }).allow,
    false,
  );
});
