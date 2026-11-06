/** ESM smoke test for the GENERATED package, not TS development source. */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const entry = pathToFileURL(resolve('lib/module/core/index.js')).href;
const api = await import(entry);
assert.equal(typeof api.composeScene, 'function');
assert.equal(typeof api.migrateSceneRecipe, 'function');
const recipe = api.migrateSceneRecipe({ schemaVersion: 1, scene: 'home' });
const scene = api.compileSceneRecipe(recipe);
assert.equal(scene.schemaVersion,1);
assert.equal(scene.scene,'home');
assert.ok(api.serializeScene(scene).startsWith('<svg'));
console.log('Compiled core ESM smoke test PASS');
