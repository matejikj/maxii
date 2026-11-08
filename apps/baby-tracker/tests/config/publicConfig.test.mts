import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadPublicAppConfig } from '../../src/app/config.ts';

test('public config reads only EXPO_PUBLIC values and defaults safely', () => {
  const config = loadPublicAppConfig({
    EXPO_PUBLIC_LUMI_ENV: 'staging',
    EXPO_PUBLIC_LUMI_STORAGE_PROBE: '1',
    EXPO_PUBLIC_LUMI_APP_NAME: 'LUMI Test',
    LUMI_SERVICE_ROLE_SECRET: 'must-be-ignored',
  });
  assert.equal(config.environment, 'staging');
  assert.equal(config.storageProbeEnabled, true);
  assert.equal(config.appName, 'LUMI Test');
  assert.equal(JSON.stringify(config).includes('must-be-ignored'), false);
});
