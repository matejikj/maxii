const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  LUMI_SCENES, SCENE_CATALOG, composeScene, composeProceduralScene, serializeScene,
  migrateSceneRecipe, compileSceneRecipe, encodeSceneRecipe, decodeSceneRecipe,
  readSceneDocument, serializeValidatedScene, SceneDocumentValidationError,
  CHARACTER_BLUEPRINTS, compileCharacter, migrateCharacterBlueprint, resolveCharacterBlueprint,
} = require('../.test-dist/core/index.js');
const { createHash } = require('node:crypto');
const sha = value => createHash('sha256').update(value).digest('hex');
const fixtures = { viewport: { width: 390, height: 844 }, safeZones: [{id: 'top', x: 12,y:20,width:360,height:200}] };

for (const scene of LUMI_SCENES) {
  test(`v1 recipe migration preserves default ${scene} SVG exactly`, () => {
    const legacy = { schemaVersion: 1, scene, seed:'migration-check', density:'quiet' };
    const v2 = migrateSceneRecipe(legacy);
    assert.equal(v2.schemaVersion, 2); assert.equal(v2.kind, 'lumi.scene.recipe');
    assert.equal(sha(serializeScene(composeScene(legacy))), sha(serializeScene(compileSceneRecipe(v2))));
    assert.equal(encodeSceneRecipe(v2), encodeSceneRecipe(decodeSceneRecipe(encodeSceneRecipe(v2))));
    assert.equal(v2.character.species, SCENE_CATALOG[scene].defaultAnimal);
  });
  test(`v1 procedural recipe migration preserves ${scene} SVG exactly`, () => {
    const legacy = { schemaVersion: 1, scene, density:'regular', seed:'procmigrate', procedural: fixtures };
    const v2 = migrateSceneRecipe(legacy);
    assert.equal(v2.layout.mode, 'procedural');
    assert.equal(serializeScene(composeScene(legacy)), serializeScene(compileSceneRecipe(v2)));
  });
}

test('v2 scene recipe validates and detaches untrusted structures', () => {
  const old = { schemaVersion: 1, scene: 'growth', animal: 'fox', pose:'standing',
    expression:'curious', accessories:['scarf'], procedural:fixtures };
  const modern = migrateSceneRecipe(old, 'profile-growth');
  assert.equal(modern.character.pose, 'standing');
  assert.equal(modern.layout.safeZones[0].id, 'top');
  old.procedural.safeZones[0].width = 4;
  assert.equal(modern.layout.safeZones[0].width, 360);
  assert.equal(migrateSceneRecipe(modern).id, 'profile-growth');
  assert.ok(serializeScene(compileSceneRecipe(modern)).includes('<svg'));
});

test('recipe input rejects unknown versions, poisoned fields and malformed JSON', () => {
  for (const bad of [null, 42, {}, {schemaVersion:3,scene:'home'},
    {schemaVersion:1,scene:'totally-new'}, {schemaVersion:1,scene:'home',seed:'x'.repeat(257)},
    {schemaVersion:1,scene:'home',procedural: {viewport:{width:Infinity,height:400}}},
    {schemaVersion:1,scene:'home',procedural: {viewport:{width:390,height:844},safeZones:[{id:'x',x:1,y:2,width:-30,height:20}]}}]) {
    assert.throws(() => migrateSceneRecipe(bad));
  }
  assert.throws(() => decodeSceneRecipe('{bad'));
  assert.throws(() => decodeSceneRecipe('x'.repeat(65537)));
});

test('scene document validation is lossless for native in-memory documents', () => {
  for (const scene of LUMI_SCENES) {
    const result = composeScene({scene});
    assert.equal(serializeValidatedScene(result), serializeScene(result));
    const reloaded = readSceneDocument(JSON.parse(JSON.stringify(result)));
    assert.deepEqual(reloaded, result);
    const procedural = composeProceduralScene({scene, ...fixtures});
    assert.equal(serializeValidatedScene(procedural), serializeScene(procedural));
  }
});

test('untrusted scene documents reject scriptable SVG fields, unsafe numbers, recursive and oversized content', () => {
  const sample = composeScene({scene:'home'});
  const leaf = {kind:'path',props:{d:'M0 0L10 10',fill:'url(javascript:alert(1))'}};
  const bad = {schemaVersion:1,scene:'home',width:390,height:844,layers:[{id:'canvas',nodes:[leaf]}]};
  assert.throws(() => readSceneDocument(bad), SceneDocumentValidationError);
  assert.throws(() => readSceneDocument({...sample,width:Infinity}));
  assert.throws(() => readSceneDocument({...sample,schemaVersion:99}));
  assert.throws(() => readSceneDocument({...sample,layers:[...sample.layers,sample.layers[0]]}));
  assert.throws(() => readSceneDocument({schemaVersion:1,scene:'home',width:390,height:844,
    layers:[{id:'canvas',nodes:[{kind:'path',props:{d:'M0 0',onload:'bad'}}]}]}));
  assert.throws(() => readSceneDocument({schemaVersion:1,scene:'home',width:390,height:844,
    layers:[{id:'canvas',nodes:[{kind:'group',props:{},children:[{kind:'path',props:{d:'M'.repeat(100001)}}]}]}]}));
});

test('legacy v1 blueprints remain natively supported; only identical art migrates', () => {
  const defaultArt = compileCharacter(CHARACTER_BLUEPRINTS.rabbit);
  const v1 = {schemaVersion:1,species:'rabbit',displayName:'Lumi Old',base:{kind:'legacy',geometry:defaultArt}};
  assert.equal(resolveCharacterBlueprint(v1),v1);
  assert.equal(migrateCharacterBlueprint(v1),CHARACTER_BLUEPRINTS.rabbit);
  const changed = { ...v1, base:{kind:'legacy',geometry:{kind:'circle',props:{cx:0,cy:0,r:100,fill:'#ffffff'}}}};
  assert.throws(() => migrateCharacterBlueprint(changed), /differs/);
  assert.equal(migrateCharacterBlueprint(CHARACTER_BLUEPRINTS.rabbit),CHARACTER_BLUEPRINTS.rabbit);
  assert.throws(() => migrateCharacterBlueprint({...v1,schemaVersion:999}));
});
