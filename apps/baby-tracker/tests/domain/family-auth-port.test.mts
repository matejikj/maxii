import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDisabledFamilyAuthPort } from '../../src/infrastructure/family/familyAuthPort.ts';
import {
  personalModeBlocksOnMissingBackend,
  resolveRemoteServicesBoundary,
  shouldInitializeRemoteClients,
} from '../../src/app/remoteServicesBoundary.ts';

test('personal mode keeps family auth cold without API URL', async () => {
  const boundary = resolveRemoteServicesBoundary({});
  assert.equal(shouldInitializeRemoteClients(boundary), false);
  assert.equal(personalModeBlocksOnMissingBackend(boundary), false);

  const port = createDisabledFamilyAuthPort();
  assert.equal(await port.currentSession(), null);
  await assert.rejects(() => port.beginBrowserLogin(), /not configured/);
});
