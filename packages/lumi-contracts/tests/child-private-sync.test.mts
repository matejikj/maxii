import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHILD_PRIVATE_SYNC_KINDS,
  childPrivateSharePayloadIsSafe,
  isChildPrivateShareKind,
  isChildPrivateSyncKind,
} from '../src/index.ts';

test('child-private sync kinds are distinct from family care kinds', () => {
  assert.ok(CHILD_PRIVATE_SYNC_KINDS.every((kind) => kind.startsWith('child_private.')));
  assert.equal(isChildPrivateSyncKind('care.record'), false);
  assert.equal(isChildPrivateSyncKind('child_private.project.upsert'), true);
  assert.equal(isChildPrivateShareKind('child_private.share.publish'), true);
  assert.equal(isChildPrivateShareKind('child_private.project.upsert'), false);
});

test('share payload rejects live private fields', () => {
  assert.equal(
    childPrivateSharePayloadIsSafe({
      publishedTitle: 'Ukázka',
      publishedBody: 'Jen toto',
      audienceAppUserIds: ['parent'],
    }),
    true,
  );
  assert.equal(
    childPrivateSharePayloadIsSafe({
      publishedTitle: 'Ukázka',
      publishedBody: 'Jen toto',
      audienceAppUserIds: ['parent'],
      reflection: 'tajné',
    }),
    false,
  );
  assert.equal(
    childPrivateSharePayloadIsSafe({
      publishedTitle: '',
      publishedBody: 'x',
      audienceAppUserIds: ['parent'],
    }),
    false,
  );
});
