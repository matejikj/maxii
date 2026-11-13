import type { LumiAnimal } from '../types';
import type { CharacterAppearanceStyle } from '../characters/studioCollection';
import type { LumiBabyPose, LumiBabyVariant } from './baby';
export const LUMI_PLAY_ACTIONS = [
  'greeting',
  'conversation',
  'narration',
  'comfort',
  'book',
  'picture',
  'sing',
  'kick',
  'tummy',
  'touch',
  'faceFollow',
  'pause',
  'mirror',
  'reach',
  'textures',
  'trackToy',
  'grasp',
  'dress',
  'shadow',
  'kneeRhythm',
  'nearFar',
  'choose',
  'transfer',
  'release',
  'takeOut',
  'rattle',
  'peekaboo',
  'point',
  'count',
  'flap',
  'roll',
  'drum',
  'explore',
  'putIn',
  'nest',
  'fit',
  'give',
  'car',
  'hideToy',
  'wave',
  'causeEffect',
  'fullEmpty',
  'closeBook',
  'draw',
  'sort',
  'bridge',
  'walk',
  'plan',
  'measure',
  'pattern',
  'plant',
] as const;
export type LumiPlayAction = (typeof LUMI_PLAY_ACTIONS)[number];
export interface PlaySceneOptions {
  readonly action: LumiPlayAction;
  readonly object?:
    'none' | 'ring' | 'car' | 'cloth' | 'ball' | 'picture' | 'animalCard' | 'faceCard';
  readonly babyVariant?: LumiBabyVariant;
  readonly babyPose?: LumiBabyPose;
  readonly guideSpecies?: LumiAnimal;
  readonly appearanceStyle?: CharacterAppearanceStyle;
  readonly colorMode?: 'light' | 'dark';
}
/** Normalized transforms only; renderer adapters never rebuild geometry per frame. */
export interface PlayMotionFrame {
  readonly babyX: number;
  readonly babyY: number;
  readonly babyHead: number;
  readonly leftHand: number;
  readonly rightHand: number;
  readonly leftFoot: number;
  readonly rightFoot: number;
  readonly guideHead: number;
  readonly guideHand: number;
  readonly objectX: number;
  readonly objectY: number;
  readonly objectRotation: number;
  readonly objectScale: number;
  readonly objectScaleX: number;
  readonly reveal: number;
  readonly signal: number;
  readonly guideSignal: number;
  readonly babySignal: number;
}
