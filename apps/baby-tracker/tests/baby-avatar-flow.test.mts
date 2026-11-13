import assert from 'node:assert/strict';
import { test } from 'node:test';
import { babyAvatarKey, loadBabyAvatar, saveBabyAvatar } from '../src/application/babyAvatar.ts';
import { createChildProfile, asChildId, parseDiaryArchive, DIARY_ARCHIVE_MAX_COMPAT } from '../src/domain/index.ts';
import { captureScopedDiaryArchive, wipeSingleChildDiaryScope } from '../src/application/multiChildWorkspace.ts';
import { createMemoryCheckpointStore } from '../src/infrastructure/database/native/checkpoint.ts';
import { createMemoryDatabasePresence } from '../src/infrastructure/database/native/databasePresence.ts';
import { createMemoryDatabaseKeyStore } from '../src/infrastructure/database/native/memoryKeyStore.ts';
import { createMemoryEncryptedSqlOpener } from '../src/infrastructure/database/native/memoryEncryptedSql.ts';
import { createNativeUnitOfWorkFactory } from '../src/infrastructure/database/native/nativeUnitOfWork.ts';
import { openPrivateDatabase } from '../src/infrastructure/database/native/privateDatabase.ts';
const first = asChildId('child_avatar_first'), second = asChildId('child_avatar_second');
async function fixture(name: string) {
  const db = await openPrivateDatabase({ databaseName: name,
    opener: createMemoryEncryptedSqlOpener(), keyStore: createMemoryDatabaseKeyStore(),
    presence: createMemoryDatabasePresence(), checkpointStore: createMemoryCheckpointStore(), now: { epochMs: 1700000000000 } });
  const uow = createNativeUnitOfWorkFactory(db, { nowMs: () => 1700000000000 });
  await uow.run(async (tx) => {
    for (const childId of [first,second]) await tx.profiles.save(createChildProfile({ childId, displayName: childId, summaryTimeZone: 'Europe/Prague' }));
  });
  return { db, uow };
}
test('baby avatar is optional, independent for each child and survives a fresh read', async (t) => {
  const {db,uow} = await fixture('baby-avatar-isolation.db');t.after(() => db.close());
  assert.equal(await loadBabyAvatar(uow,first),'neutral');
  await saveBabyAvatar(uow,first,'girl');await saveBabyAvatar(uow,second,'boy');
  const fresh = createNativeUnitOfWorkFactory(db,{nowMs:()=>1700000000001});
  assert.equal(await loadBabyAvatar(fresh,first),'girl');assert.equal(await loadBabyAvatar(fresh,second),'boy');
  await saveBabyAvatar(uow,first,'neutral');assert.equal(await loadBabyAvatar(uow,second),'boy');
});
test('unknown values fall back; invalid saves and vanished children do not create preferences', async (t) => {
  const {db,uow} = await fixture('baby-avatar-invalid.db');t.after(() => db.close());
  await uow.run(tx => tx.meta.set(babyAvatarKey(first),'unknown-future-avatar'));
  assert.equal(await loadBabyAvatar(uow,first),'neutral');
  await assert.rejects(saveBabyAvatar(uow,first,'invalid' as never));
  await assert.rejects(saveBabyAvatar(uow,'child_missing','girl'));
  assert.equal(await uow.run(tx => tx.meta.get(babyAvatarKey('child_missing'))),null);
});
test('backup restores avatars and a single-child export excludes the sibling preference', async (t) => {
  const {db,uow} = await fixture('baby-avatar-source.db');t.after(() => db.close());
  await saveBabyAvatar(uow,first,'girl');await saveBabyAvatar(uow,second,'boy');
  const all = await captureScopedDiaryArchive({unitOfWork:uow,nowMs:1700000000000,schemaCompatibility:DIARY_ARCHIVE_MAX_COMPAT,scope:{kind:'all_children'}});
  const target = await fixture('baby-avatar-restored.db');t.after(() => target.db.close());
  await target.uow.run(tx=>tx.diary.replace(parseDiaryArchive(JSON.stringify(all))));
  assert.equal(await loadBabyAvatar(target.uow,first),'girl');assert.equal(await loadBabyAvatar(target.uow,second),'boy');
  const scoped = await captureScopedDiaryArchive({unitOfWork:uow,nowMs:1700000000000,schemaCompatibility:DIARY_ARCHIVE_MAX_COMPAT,scope:{kind:'one_child',childId:first}});
  assert.ok(scoped.meta.some(entry=>entry.key===babyAvatarKey(first)));
  assert.ok(!scoped.meta.some(entry=>entry.key===babyAvatarKey(second)));
});
test('erasing one child removes its avatar and keeps the sibling preference', async (t) => {
  const {db,uow} = await fixture('baby-avatar-wipe.db');t.after(() => db.close());
  await saveBabyAvatar(uow,first,'girl');await saveBabyAvatar(uow,second,'boy');
  await wipeSingleChildDiaryScope({unitOfWork:uow,childId:first,nowMs:1700000000001});
  assert.equal(await uow.run(tx=>tx.meta.get(babyAvatarKey(first))),null);
  assert.equal(await loadBabyAvatar(uow,second),'boy');
});
