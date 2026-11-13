const assert = require('node:assert/strict');
const { test } = require('node:test');
const { canRunPlayScene, playStepAt, remainingPlayDuration, samplePlayMotion, LUMI_PLAY_ACTIONS } = require('../.test-dist/core/index.js');

test('explicit instructional playback works independently of decorative motion preferences', () => {
  for (const canAnimate of [true,false]) {
    assert.equal(canRunPlayScene({intent:'user',playing:true,foreground:true,canAnimate}),true);
    assert.equal(canRunPlayScene({intent:'user',playing:false,foreground:true,canAnimate}),false);
    assert.equal(canRunPlayScene({intent:'user',playing:true,foreground:false,canAnimate}),false);
  }
  assert.equal(canRunPlayScene({intent:'automatic',playing:true,foreground:true,canAnimate:false}),false);
  assert.equal(canRunPlayScene({intent:'automatic',playing:true,foreground:true,canAnimate:true}),true);
});
test('resuming uses the remaining duration instead of restarting a step or the whole clip', () => {
  assert.equal(remainingPlayDuration(0,3,4200),12600);
  assert.equal(remainingPlayDuration(.5,3,4200),6300);
  assert.equal(remainingPlayDuration(.75,3,4200),3150);
  const progress=.47;
  const originalSpeed=1/remainingPlayDuration(0,3,4200);
  const resumedSpeed=(1-progress)/remainingPlayDuration(progress,3,4200);
  assert.ok(Math.abs(originalSpeed-resumedSpeed)<1e-12);
});
test('a single continuous timeline reports the correct instruction including its final frame', () => {
  for (const count of [1,2,3]) {
    for (let step=0;step<count;step++) assert.equal(playStepAt((step+.5)/count,count),step);
    assert.equal(playStepAt(0,count),0);
    assert.equal(playStepAt(1,count),count-1);
  }
  assert.equal(playStepAt(NaN,3),0);
});
test('every recipe joins its steps without position, rotation, scale or opacity jumps', () => {
  for (const action of LUMI_PLAY_ACTIONS) for (const boundary of [1/3,2/3]) {
    const left=samplePlayMotion(action,boundary-1e-6),right=samplePlayMotion(action,boundary+1e-6);
    for (const key of Object.keys(left)) assert.ok(Math.abs(left[key]-right[key])<.01,`${action}/${key} jumps at ${boundary}: ${left[key]} → ${right[key]}`);
  }
});
test('closing the book ends with a closed book instead of immediately reversing the action', () => {
  assert.ok(samplePlayMotion('closeBook',1).objectScaleX < .3);
});
