const assert = require('node:assert/strict');
const { test } = require('node:test');
const { BABY_BLUEPRINTS, LUMI_BABY_VARIANTS, LUMI_PLAY_ACTIONS, LUMI_ANIMALS, CHARACTER_BLUEPRINTS,
  compileBaby, compilePlayScene, samplePlayMotion, serializeVectorNode, preparePlayScene,
  countCharacterVectorNodes } = require('../.test-dist/core/index.js');

test('baby anatomy keeps individually rigged limbs and a detailed face for each optional avatar', () => {
  for (const variant of LUMI_BABY_VARIANTS) {
    const blueprint = BABY_BLUEPRINTS[variant];
    assert.equal(new Set(blueprint.parts.map(p => p.id)).size, blueprint.parts.length);
    for (const id of ['head','body','left-hand','right-hand','left-foot','right-foot','eye-left','eye-right']) {
      assert.ok(blueprint.parts.some(part => part.id === id), `${variant}/${id}`);
    }
    for (const pose of ['sitting','reclined','tummy','standing']) {
      const node = compileBaby(variant, pose), xml = serializeVectorNode(node);
      assert.ok(countCharacterVectorNodes(node) > 50);
      assert.doesNotMatch(xml, /NaN|Infinity|undefined|<image|<filter|<mask/);
      assert.equal(xml, serializeVectorNode(compileBaby(variant, pose)));
    }
  }
  assert.notEqual(serializeVectorNode(compileBaby('girl')), serializeVectorNode(compileBaby('boy')));
});

test('every play recipe has finite, bounded transforms and a meaningful changing frame', () => {
  for (const action of LUMI_PLAY_ACTIONS) {
    const samples = new Set();
    for (const progress of [0,.05,.15,.3,.4,.5,.6,.7,.83,.95,1,NaN,Infinity]) {
      const frame = samplePlayMotion(action, progress);
      for (const [key,value] of Object.entries(frame)) {
        assert.ok(Number.isFinite(value), `${action}/${key}`);
        assert.ok(Math.abs(value) <= 500, `${action}/${key}: unbounded motion`);
      }
      for (const key of ['reveal','signal','guideSignal','babySignal']) assert.ok(frame[key] >= 0 && frame[key] <= 1);
      samples.add(JSON.stringify(frame));
    }
    assert.ok(samples.size > 2, `${action} must illustrate an actual action`);
  }
});

test('all scenes compile for all guides and avatars inside a bounded offline vector budget', () => {
  for (const action of LUMI_PLAY_ACTIONS) for (const guideSpecies of LUMI_ANIMALS) for (const babyVariant of LUMI_BABY_VARIANTS) {
    const options = { action, guideSpecies, babyVariant, babyPose: action === 'tummy' ? 'tummy' : 'reclined' };
    const node = compilePlayScene(options,.5);
    assert.ok(countCharacterVectorNodes(node) < 650, `${action}/${guideSpecies} vector budget`);
    assert.doesNotMatch(serializeVectorNode(node), /NaN|Infinity|undefined|<image/);
  }
});

test('peekaboo covers the adult guide only and tummy time has an awake baby with grounded arms', () => {
  const scene = preparePlayScene({ action:'peekaboo', guideSpecies:'hippo', babyVariant:'girl' });
  assert.ok(scene.cover.length > 0);
  assert.equal(scene.babyParts.find(part => part.id === 'eye-left').role, 'eye');
  const cover = serializeVectorNode({ kind:'group', props:{}, children:scene.cover });
  assert.match(cover, /cx="82"/); // adult guide occupies x≈92, baby occupies x≈270
  assert.notEqual(serializeVectorNode(compilePlayScene({ action:'tummy',babyPose:'tummy' },.15)), serializeVectorNode(compilePlayScene({ action:'tummy',babyPose:'reclined' },.15)));
});

test('new guides share semantic rig contracts and do not replace the eight existing identities', () => {
  assert.deepEqual(LUMI_ANIMALS.slice(0,8), ['rabbit','bear','fox','otter','hedgehog','owl','squirrel','fawn']);
  assert.equal(CHARACTER_BLUEPRINTS.tiger.displayName,'Timi');
  assert.equal(CHARACTER_BLUEPRINTS.hippo.displayName,'Hugo');
});

test('answering a baby sound listens first, replies second and leaves a quiet pause', () => {
  const first = samplePlayMotion('conversation',1/6), reply = samplePlayMotion('conversation',.5), pause = samplePlayMotion('conversation',5/6);
  assert.ok(first.babySignal > .9); assert.equal(first.guideSignal,0);
  assert.ok(reply.guideSignal > .9); assert.equal(reply.babySignal,0);
  assert.equal(pause.guideSignal,0); assert.equal(pause.babySignal,0);
  assert.equal(samplePlayMotion('kneeRhythm',.5).guideHand,0);
});
