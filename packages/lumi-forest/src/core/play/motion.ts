import type { LumiPlayAction, PlayMotionFrame } from './types';
function smooth(t: number): number { 'worklet'; return t * t * (3 - 2 * t); }
function beat(t: number): number { 'worklet'; return (1 - Math.cos(2 * Math.PI * t)) / 2; }
/** A 12.6s demonstration has an invitation, a child's response and a quiet pause.
 * 'worklet' remains an ordinary directive in the portable core; RN can execute
 * the same deterministic sampler on the UI thread, without JS frame callbacks. */
export function samplePlayMotion(action: LumiPlayAction, progress: number): PlayMotionFrame {
  'worklet';
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const stage = Math.min(2, Math.floor(p * 3));
  const t = p === 1 ? 1 : p * 3 - stage;
  const b = beat(t), s = smooth(t), invitation = stage === 0 ? b : 0, response = stage === 1 ? b : 0;
  let babyX = 0, babyY = 0, babyHead = 0, leftHand = 0, rightHand = 0, leftFoot = 0, rightFoot = 0;
  let guideHead = -3 * invitation, guideHand = -8 * invitation;
  let objectX = 185, objectY = 171, objectRotation = 0, objectScale = 1, objectScaleX = 1, reveal = 1, signal = 0;
  let guideSignal = 0, babySignal = 0;
  switch (action) {
    case 'greeting':
      guideHead = -3 * invitation; guideHand = -40 * response; guideSignal = response;
      babyHead = stage === 2 ? 3 * b : 0; break;
    case 'wave':
      guideSignal = invitation; guideHand = -56 * response; rightHand = stage === 2 ? 24 * b : 0; break;
    case 'conversation':
      babySignal = invitation; guideSignal = response; guideHead = -3 * response; babyHead = 3 * invitation; break;
    case 'narration':
      guideSignal = stage < 2 ? b : 0; guideHead = -3 * invitation; break;
    case 'sing':
      guideSignal = stage === 1 ? 0 : b; guideHead = 5 * Math.sin(t * Math.PI * 2) * b * (stage === 1 ? 0 : 1); break;
    case 'comfort': case 'pause':
      guideHead = 4 * b * (stage === 0 ? 1 : 0); babyHead = -2 * response; signal = .35 * invitation; break;
    case 'book': case 'closeBook': case 'flap':
      objectX = 182; objectY = 168; reveal = action === 'closeBook' ? 1 - (stage === 1 ? s : stage === 2 ? 1 : 0) : stage === 1 ? 1 - b : 1;
      if (action === 'closeBook') objectScaleX = stage === 0 ? 1 : stage === 1 ? 1 - .8 * s : .2;
      guideHand = -18 * invitation; leftHand = -24 * response; babyHead = -4 * response; break;
    case 'hideToy':
      reveal = 1 - .9 * invitation; leftHand = -27 * response; break;
    case 'picture': case 'point': case 'plant':
      objectX = 182; objectY = 144; guideHand = -25 * invitation; leftHand = -28 * response; babyHead = -5 * response; break;
    case 'kick':
      leftFoot = 17 * invitation - 10 * response; rightFoot = -10 * invitation + 17 * response;
      leftHand = -9 * invitation; rightHand = 8 * response; break;
    case 'tummy':
      babyHead = -5 * invitation; guideHead = 5 * invitation; leftHand = -8 * response; break;
    case 'touch':
      guideHand = -24 * invitation; leftHand = -18 * response; signal = .4 * response; break;
    case 'faceFollow':
      guideHead = -9 * (stage === 0 ? b : 0); babyHead = -7 * (stage === 1 ? b : 0); break;
    case 'mirror':
      objectX = 185; objectY = 155; guideHead = -6 * invitation; babyHead = 6 * response; signal = response; break;
    case 'reach': case 'grasp':
      objectX = 253; objectY = 175; leftHand = -32 * response;
      objectY -= action === 'grasp' ? 12 * response : 0; guideHand = -20 * invitation; break;
    case 'textures':
      objectX = 213; objectY = 178; leftHand = -30 * invitation; rightHand = 26 * response; signal = response; break;
    case 'trackToy':
      objectX = 168 + 77 * (stage === 0 ? s : stage === 1 ? 1 - s : 0); objectY = 150;
      babyHead = stage === 0 ? -6 * s : stage === 1 ? -6 * (1 - s) : 0; guideHand = -16 * invitation; break;
    case 'shadow':
      objectX = 188; objectY = 140; objectRotation = 14 * invitation; guideHand = -30 * invitation; break;
    case 'kneeRhythm':
      guideHand = stage === 1 ? 0 : -24 * b; signal = stage === 1 ? 0 : beat(t * 2); break;
    case 'drum':
      guideHand = -24 * invitation; leftHand = stage === 2 ? -20 * b : 0;
      rightHand = stage === 2 ? 15 * b : 0; signal = stage === 1 ? 0 : beat(t * 2); break;
    case 'nearFar':
      objectX = 209; objectY = 156; objectScale = 1 + .16 * invitation; babyHead = -4 * response; break;
    case 'choose': case 'fit':
      objectX = 224; objectY = 172; leftHand = -27 * response; guideHand = -18 * invitation; signal = response; break;
    case 'transfer':
      objectX = 263 + (stage === 0 ? -20 * s : stage === 1 ? -20 + 40 * s : 20 * (1 - s)); objectY = 175;
      leftHand = -22 * invitation; rightHand = 22 * response; break;
    case 'release':
      objectX = 256; objectY = 168 + (stage === 0 ? 24 * s : stage === 1 ? 24 * (1 - s) : 0);
      leftHand = -23 * invitation; guideHand = -24 * response; break;
    case 'takeOut': case 'putIn':
      objectX = 200 + 50 * (stage === 1 ? b : 0); objectY = 186 - 50 * (stage === 1 ? b : 0);
      if (action === 'putIn') { objectX = 250 - 50 * (stage === 1 ? b : 0); objectY = 170 + 16 * (stage === 1 ? b : 0); }
      leftHand = -30 * response; guideHand = -20 * invitation; break;
    case 'rattle':
      objectX = 182; objectY = 145; objectRotation = stage === 0 ? 12 * Math.sin(t * 6 * Math.PI) * b : 0;
      signal = invitation; babyHead = -4 * response; break;
    case 'peekaboo':
      guideHand = -65 * invitation; reveal = 1 - invitation; babyHead = -4 * response; babySignal = response; break;
    case 'count': case 'fullEmpty': case 'sort': case 'pattern':
      objectX = 174 + (stage === 1 ? 46 * s : stage === 2 ? 46 * (1 - s) : 0); objectY = 186 - 20 * (stage === 1 ? b : 0);
      leftHand = -27 * response; guideHand = -18 * invitation; signal = response; break;
    case 'roll': case 'car':
      objectX = stage === 0 ? 141 + 64 * s : stage === 1 ? 205 + 60 * s : 265 - 124 * s;
      objectY = 191; objectRotation = action === 'roll' ? (objectX - 141) * 3 : 0;
      guideHand = -30 * invitation; leftHand = -27 * response; break;
    case 'explore': case 'walk':
      babyX = stage === 0 ? -9 * s : stage === 1 ? -9 + 18 * s : 9 * (1 - s);
      babyY = action === 'walk' ? -2 * beat(t * 2) * (stage < 2 ? 1 : 0) : 0;
      leftFoot = 6 * invitation; rightFoot = -6 * response; objectX = 206; break;
    case 'nest':
      objectX = 203; objectY = 170 - 32 * invitation; objectScale = 1 - .05 * response; leftHand = -26 * response; break;
    case 'give':
      objectX = stage === 0 ? 260 : stage === 1 ? 260 - 112 * s : 148 + 112 * s; objectY = 163 - 8 * b;
      guideHand = -30 * invitation; leftHand = -27 * response; break;
    case 'dress':
      objectX = 250; objectY = 164; objectRotation = -8 * invitation; leftHand = -27 * response; guideHand = -25 * invitation; break;
    case 'causeEffect':
      objectX = 238; objectY = 184; leftHand = -30 * invitation; signal = response; break;
    case 'draw': case 'plan': case 'measure':
      objectX = stage === 0 ? 207 + 11 * s : stage === 1 ? 218 + 11 * s : 229 - 22 * s; objectY = 164 + (action === 'draw' ? 6 * Math.sin(t * Math.PI * 2) : 0);
      objectRotation = -15; leftHand = -26 * response; guideHand = -17 * invitation; reveal = stage === 0 ? s : stage === 1 ? 1 : 1 - s; break;
    case 'bridge':
      objectX = 200; objectY = 154 + 19 * invitation; guideHand = -25 * invitation; leftHand = -25 * response; signal = response; break;
  }
  return { babyX, babyY, babyHead, leftHand, rightHand, leftFoot, rightFoot, guideHead, guideHand,
    objectX, objectY, objectRotation, objectScale, objectScaleX, reveal, signal, guideSignal, babySignal };
}
