import type { LumiBabyPose, PlaySceneOptions } from '@lumi/forest-design/core';
import type { ActivityRevision } from '../../content';
export type ActivityDemonstration = Pick<PlaySceneOptions, 'action' | 'object'> & {
  readonly babyPose: LumiBabyPose;
  readonly revisionId: string;
};
/** Explicit editorial bindings for every bundled published game. No keyword or
 * area fallback can accidentally turn a changed/new activity into a wrong demo. */
export const ACTIVITY_DEMONSTRATIONS: Readonly<Record<string, ActivityDemonstration>> = {
  'face-hello': { revisionId: 'face-hello.r1', action: 'greeting', babyPose: 'reclined' },
  'babble-answer': { revisionId: 'babble-answer.r1', action: 'conversation', babyPose: 'reclined' },
  'care-narration': { revisionId: 'care-narration.r1', action: 'narration', babyPose: 'reclined' },
  'comfort-together': {
    revisionId: 'comfort-together.r1',
    action: 'comfort',
    babyPose: 'reclined',
  },
  'book-voice': { revisionId: 'book-voice.r1', action: 'book', babyPose: 'reclined' },
  'single-contrast-picture': {
    revisionId: 'single-contrast-picture.r1',
    action: 'picture',
    babyPose: 'reclined',
  },
  'familiar-melody': { revisionId: 'familiar-melody.r1', action: 'sing', babyPose: 'reclined' },
  'free-kicking': { revisionId: 'free-kicking.r1', action: 'kick', babyPose: 'reclined' },
  'awake-tummy-moment': { revisionId: 'awake-tummy-moment.r1', action: 'tummy', babyPose: 'tummy' },
  'gentle-palm-contact': {
    revisionId: 'gentle-palm-contact.r1',
    action: 'touch',
    babyPose: 'reclined',
  },
  'slow-face-follow': {
    revisionId: 'slow-face-follow.r1',
    action: 'faceFollow',
    babyPose: 'reclined',
  },
  'baby-led-pause': { revisionId: 'baby-led-pause.r1', action: 'pause', babyPose: 'reclined' },
  'mirror-together': { revisionId: 'mirror-together.r1', action: 'mirror', babyPose: 'reclined' },
  'toy-within-reach': { revisionId: 'toy-within-reach.r1', action: 'reach', babyPose: 'reclined' },
  'two-safe-textures': {
    revisionId: 'two-safe-textures.r1',
    action: 'textures',
    babyPose: 'reclined',
    object: 'cloth',
  },
  'slow-toy-tracking': {
    revisionId: 'slow-toy-tracking.r1',
    action: 'trackToy',
    babyPose: 'reclined',
  },
  'holding-a-ring': {
    revisionId: 'holding-a-ring.r1',
    action: 'grasp',
    babyPose: 'reclined',
    object: 'ring',
  },
  'gentle-voice-play': {
    revisionId: 'gentle-voice-play.r1',
    action: 'narration',
    babyPose: 'reclined',
  },
  'dressing-rhyme': { revisionId: 'dressing-rhyme.r1', action: 'sing', babyPose: 'reclined' },
  'touching-a-book': { revisionId: 'touching-a-book.r1', action: 'book', babyPose: 'reclined' },
  'self-led-side-reach': {
    revisionId: 'self-led-side-reach.r1',
    action: 'reach',
    babyPose: 'reclined',
  },
  'soft-hand-shadow': { revisionId: 'soft-hand-shadow.r1', action: 'shadow', babyPose: 'reclined' },
  'parent-knee-rhythm': {
    revisionId: 'parent-knee-rhythm.r1',
    action: 'kneeRhythm',
    babyPose: 'reclined',
  },
  'near-and-far-toy': {
    revisionId: 'near-and-far-toy.r1',
    action: 'nearFar',
    babyPose: 'reclined',
  },
  'familiar-voices-greeting': {
    revisionId: 'familiar-voices-greeting.r1',
    action: 'greeting',
    babyPose: 'reclined',
  },
  'choose-by-looking': {
    revisionId: 'choose-by-looking.r1',
    action: 'choose',
    babyPose: 'reclined',
  },
  'hand-to-hand-toy': {
    revisionId: 'hand-to-hand-toy.r1',
    action: 'transfer',
    babyPose: 'reclined',
  },
  'soft-toy-release': {
    revisionId: 'soft-toy-release.r1',
    action: 'release',
    babyPose: 'reclined',
  },
  'take-out-a-toy': { revisionId: 'take-out-a-toy.r1', action: 'takeOut', babyPose: 'reclined' },
  'rattle-and-pause': { revisionId: 'rattle-and-pause.r1', action: 'rattle', babyPose: 'reclined' },
  'parent-peekaboo': { revisionId: 'parent-peekaboo.r1', action: 'peekaboo', babyPose: 'reclined' },
  'quiet-sound-direction': {
    revisionId: 'quiet-sound-direction.r1',
    action: 'trackToy',
    babyPose: 'reclined',
  },
  'floor-play-partner': {
    revisionId: 'floor-play-partner.r1',
    action: 'touch',
    babyPose: 'reclined',
  },
  'body-part-names': {
    revisionId: 'body-part-names.r1',
    action: 'point',
    babyPose: 'reclined',
    object: 'none',
  },
  'one-and-another': { revisionId: 'one-and-another.r1', action: 'count', babyPose: 'reclined' },
  'book-flap-discovery': {
    revisionId: 'book-flap-discovery.r1',
    action: 'flap',
    babyPose: 'reclined',
  },
  'slow-approaching-ball': {
    revisionId: 'slow-approaching-ball.r1',
    action: 'roll',
    babyPose: 'reclined',
    object: 'ball',
  },
  'baby-hand-drum': { revisionId: 'baby-hand-drum.r1', action: 'drum', babyPose: 'sitting' },
  'unhurried-exploration': {
    revisionId: 'unhurried-exploration.r1',
    action: 'pause',
    babyPose: 'reclined',
  },
  'name-a-real-interest': {
    revisionId: 'name-a-real-interest.r1',
    action: 'narration',
    babyPose: 'reclined',
  },
  'familiar-faces-book': {
    revisionId: 'familiar-faces-book.r1',
    action: 'picture',
    babyPose: 'reclined',
    object: 'faceCard',
  },
  'self-led-floor-exploring': {
    revisionId: 'self-led-floor-exploring.r1',
    action: 'explore',
    babyPose: 'reclined',
  },
  'put-a-toy-in': { revisionId: 'put-a-toy-in.r1', action: 'putIn', babyPose: 'reclined' },
  'nesting-cups': { revisionId: 'nesting-cups.r1', action: 'nest', babyPose: 'reclined' },
  'toy-and-container-fit': {
    revisionId: 'toy-and-container-fit.r1',
    action: 'fit',
    babyPose: 'reclined',
  },
  'rolling-turns': {
    revisionId: 'rolling-turns.r1',
    action: 'roll',
    babyPose: 'sitting',
    object: 'ball',
  },
  'offer-and-receive': { revisionId: 'offer-and-receive.r1', action: 'give', babyPose: 'reclined' },
  'push-a-baby-car': {
    revisionId: 'push-a-baby-car.r1',
    action: 'car',
    babyPose: 'reclined',
    object: 'car',
  },
  'respond-to-pointing': {
    revisionId: 'respond-to-pointing.r1',
    action: 'point',
    babyPose: 'reclined',
  },
  'one-word-response': {
    revisionId: 'one-word-response.r1',
    action: 'conversation',
    babyPose: 'reclined',
  },
  'wave-and-word': { revisionId: 'wave-and-word.r1', action: 'wave', babyPose: 'reclined' },
  'animal-picture-sound': {
    revisionId: 'animal-picture-sound.r1',
    action: 'picture',
    babyPose: 'reclined',
    object: 'animalCard',
  },
  'answer-a-rhythm': {
    revisionId: 'answer-a-rhythm.r1',
    action: 'kneeRhythm',
    babyPose: 'reclined',
  },
  'turn-a-board-page': { revisionId: 'turn-a-board-page.r1', action: 'book', babyPose: 'reclined' },
  'clear-caregiver-goodbye': {
    revisionId: 'clear-caregiver-goodbye.r1',
    action: 'greeting',
    babyPose: 'reclined',
  },
  'familiar-object-picture': {
    revisionId: 'familiar-object-picture.r1',
    action: 'picture',
    babyPose: 'reclined',
  },
  'baby-safe-cause-effect': {
    revisionId: 'baby-safe-cause-effect.r1',
    action: 'causeEffect',
    babyPose: 'reclined',
  },
  'empty-and-full-bowl': {
    revisionId: 'empty-and-full-bowl.r1',
    action: 'fullEmpty',
    babyPose: 'reclined',
  },
  'participating-in-dressing': {
    revisionId: 'participating-in-dressing.r1',
    action: 'dress',
    babyPose: 'reclined',
    object: 'cloth',
  },
  'book-ending-ritual': {
    revisionId: 'book-ending-ritual.r1',
    action: 'closeBook',
    babyPose: 'reclined',
  },
  'toddler-shared-hello-choice': {
    revisionId: 'toddler-shared-hello-choice.r1',
    action: 'greeting',
    babyPose: 'sitting',
  },
  'toddler-two-pages-together': {
    revisionId: 'toddler-two-pages-together.r1',
    action: 'book',
    babyPose: 'sitting',
  },
  'toddler-soft-ball-return': {
    revisionId: 'toddler-soft-ball-return.r1',
    action: 'roll',
    babyPose: 'sitting',
    object: 'ball',
  },
  'toddler-two-large-textures': {
    revisionId: 'toddler-two-large-textures.r1',
    action: 'textures',
    babyPose: 'sitting',
    object: 'cloth',
  },
  'toddler-follow-your-interest': {
    revisionId: 'toddler-follow-your-interest.r1',
    action: 'narration',
    babyPose: 'sitting',
  },
  'toddler-cup-in-and-out': {
    revisionId: 'toddler-cup-in-and-out.r1',
    action: 'takeOut',
    babyPose: 'sitting',
  },
  'toddler-palm-pause-rhythm': {
    revisionId: 'toddler-palm-pause-rhythm.r1',
    action: 'kneeRhythm',
    babyPose: 'sitting',
  },
  'toddler-choose-two-clothes': {
    revisionId: 'toddler-choose-two-clothes.r1',
    action: 'choose',
    babyPose: 'sitting',
  },
  'toddler-shared-ball-turn': {
    revisionId: 'toddler-shared-ball-turn.r1',
    action: 'roll',
    babyPose: 'sitting',
    object: 'ball',
  },
  'toddler-words-for-two-things': {
    revisionId: 'toddler-words-for-two-things.r1',
    action: 'narration',
    babyPose: 'sitting',
  },
  'toddler-own-way-to-toy': {
    revisionId: 'toddler-own-way-to-toy.r1',
    action: 'explore',
    babyPose: 'sitting',
  },
  'toddler-quiet-sound-source': {
    revisionId: 'toddler-quiet-sound-source.r1',
    action: 'trackToy',
    babyPose: 'sitting',
  },
  'toddler-toy-under-cloth-edge': {
    revisionId: 'toddler-toy-under-cloth-edge.r1',
    action: 'hideToy',
    babyPose: 'sitting',
  },
  'toddler-empty-full-container': {
    revisionId: 'toddler-empty-full-container.r1',
    action: 'fullEmpty',
    babyPose: 'sitting',
  },
  'toddler-first-large-mark': {
    revisionId: 'toddler-first-large-mark.r1',
    action: 'draw',
    babyPose: 'sitting',
  },
  'toddler-toy-home-basket': {
    revisionId: 'toddler-toy-home-basket.r1',
    action: 'putIn',
    babyPose: 'sitting',
  },
  'toddler-plush-needs-pause': {
    revisionId: 'toddler-plush-needs-pause.r1',
    action: 'comfort',
    babyPose: 'sitting',
  },
  'toddler-familiar-story-pause': {
    revisionId: 'toddler-familiar-story-pause.r1',
    action: 'book',
    babyPose: 'sitting',
  },
  'toddler-slow-motion-statues': {
    revisionId: 'toddler-slow-motion-statues.r1',
    action: 'walk',
    babyPose: 'standing',
  },
  'toddler-large-paper-surfaces': {
    revisionId: 'toddler-large-paper-surfaces.r1',
    action: 'textures',
    babyPose: 'sitting',
    object: 'cloth',
  },
  'toddler-find-same-big-picture': {
    revisionId: 'toddler-find-same-big-picture.r1',
    action: 'picture',
    babyPose: 'sitting',
  },
  'toddler-big-small-cloth': {
    revisionId: 'toddler-big-small-cloth.r1',
    action: 'textures',
    babyPose: 'sitting',
    object: 'cloth',
  },
  'toddler-your-sound-my-answer': {
    revisionId: 'toddler-your-sound-my-answer.r1',
    action: 'conversation',
    babyPose: 'sitting',
  },
  'toddler-choose-help-signal': {
    revisionId: 'toddler-choose-help-signal.r1',
    action: 'give',
    babyPose: 'sitting',
  },
  'preschool-two-toy-worlds': {
    revisionId: 'preschool-two-toy-worlds.r1',
    action: 'explore',
    babyPose: 'sitting',
  },
  'preschool-three-picture-story': {
    revisionId: 'preschool-three-picture-story.r1',
    action: 'picture',
    babyPose: 'sitting',
  },
  'preschool-two-chosen-moves': {
    revisionId: 'preschool-two-chosen-moves.r1',
    action: 'walk',
    babyPose: 'standing',
  },
  'preschool-texture-mark-on-paper': {
    revisionId: 'preschool-texture-mark-on-paper.r1',
    action: 'draw',
    babyPose: 'sitting',
  },
  'preschool-notice-one-change': {
    revisionId: 'preschool-notice-one-change.r1',
    action: 'explore',
    babyPose: 'sitting',
  },
  'preschool-one-place-for-each': {
    revisionId: 'preschool-one-place-for-each.r1',
    action: 'count',
    babyPose: 'sitting',
  },
  'preschool-two-colour-page': {
    revisionId: 'preschool-two-colour-page.r1',
    action: 'draw',
    babyPose: 'sitting',
  },
  'preschool-prepare-two-clothes': {
    revisionId: 'preschool-prepare-two-clothes.r1',
    action: 'choose',
    babyPose: 'sitting',
  },
  'preschool-toy-misunderstanding': {
    revisionId: 'preschool-toy-misunderstanding.r1',
    action: 'narration',
    babyPose: 'sitting',
  },
  'preschool-story-from-own-choice': {
    revisionId: 'preschool-story-from-own-choice.r1',
    action: 'book',
    babyPose: 'sitting',
  },
  'preschool-floor-path-choice': {
    revisionId: 'preschool-floor-path-choice.r1',
    action: 'walk',
    babyPose: 'standing',
  },
  'preschool-shadow-not-sun': {
    revisionId: 'preschool-shadow-not-sun.r1',
    action: 'shadow',
    babyPose: 'sitting',
  },
  'preschool-one-sorting-rule': {
    revisionId: 'preschool-one-sorting-rule.r1',
    action: 'sort',
    babyPose: 'sitting',
  },
  'preschool-bridge-for-big-toy': {
    revisionId: 'preschool-bridge-for-big-toy.r1',
    action: 'bridge',
    babyPose: 'sitting',
  },
  'preschool-quiet-orchestra': {
    revisionId: 'preschool-quiet-orchestra.r1',
    action: 'kneeRhythm',
    babyPose: 'sitting',
  },
  'preschool-before-going-out': {
    revisionId: 'preschool-before-going-out.r1',
    action: 'choose',
    babyPose: 'sitting',
  },
  'preschool-different-needs-story': {
    revisionId: 'preschool-different-needs-story.r1',
    action: 'narration',
    babyPose: 'sitting',
  },
  'preschool-story-two-voices': {
    revisionId: 'preschool-story-two-voices.r1',
    action: 'narration',
    babyPose: 'sitting',
  },
  'preschool-gentle-ball-aim': {
    revisionId: 'preschool-gentle-ball-aim.r1',
    action: 'roll',
    babyPose: 'sitting',
    object: 'ball',
  },
  'preschool-weight-in-two-hands': {
    revisionId: 'preschool-weight-in-two-hands.r1',
    action: 'textures',
    babyPose: 'sitting',
    object: 'cloth',
  },
  'preschool-invent-grouping-rule': {
    revisionId: 'preschool-invent-grouping-rule.r1',
    action: 'sort',
    babyPose: 'sitting',
  },
  'preschool-room-as-large-shapes': {
    revisionId: 'preschool-room-as-large-shapes.r1',
    action: 'draw',
    babyPose: 'sitting',
  },
  'preschool-box-town': {
    revisionId: 'preschool-box-town.r1',
    action: 'sort',
    babyPose: 'sitting',
  },
  'preschool-my-first-step-your-help': {
    revisionId: 'preschool-my-first-step-your-help.r1',
    action: 'give',
    babyPose: 'sitting',
  },
  'primary-plan-with-two-choices': {
    revisionId: 'primary-plan-with-two-choices.r1',
    action: 'choose',
    babyPose: 'sitting',
  },
  'primary-ordinary-object-story': {
    revisionId: 'primary-ordinary-object-story.r1',
    action: 'explore',
    babyPose: 'sitting',
  },
  'primary-own-move-sequence': {
    revisionId: 'primary-own-move-sequence.r1',
    action: 'walk',
    babyPose: 'standing',
  },
  'primary-sound-map-on-paper': {
    revisionId: 'primary-sound-map-on-paper.r1',
    action: 'draw',
    babyPose: 'sitting',
  },
  'primary-two-step-plan': {
    revisionId: 'primary-two-step-plan.r1',
    action: 'plan',
    babyPose: 'sitting',
  },
  'primary-measure-with-paper-strip': {
    revisionId: 'primary-measure-with-paper-strip.r1',
    action: 'measure',
    babyPose: 'sitting',
  },
  'primary-three-panel-comic': {
    revisionId: 'primary-three-panel-comic.r1',
    action: 'draw',
    babyPose: 'sitting',
  },
  'primary-prepare-my-work-place': {
    revisionId: 'primary-prepare-my-work-place.r1',
    action: 'putIn',
    babyPose: 'sitting',
  },
  'primary-explain-with-role-swap': {
    revisionId: 'primary-explain-with-role-swap.r1',
    action: 'narration',
    babyPose: 'sitting',
  },
  'primary-two-story-versions': {
    revisionId: 'primary-two-story-versions.r1',
    action: 'book',
    babyPose: 'sitting',
  },
  'primary-together-ball-route': {
    revisionId: 'primary-together-ball-route.r1',
    action: 'roll',
    babyPose: 'sitting',
    object: 'ball',
  },
  'primary-plant-observation-page': {
    revisionId: 'primary-plant-observation-page.r1',
    action: 'plant',
    babyPose: 'sitting',
  },
  'primary-question-for-paper-bridge': {
    revisionId: 'primary-question-for-paper-bridge.r1',
    action: 'bridge',
    babyPose: 'sitting',
  },
  'primary-same-amount-new-layout': {
    revisionId: 'primary-same-amount-new-layout.r1',
    action: 'count',
    babyPose: 'sitting',
  },
  'primary-create-and-change-pattern': {
    revisionId: 'primary-create-and-change-pattern.r1',
    action: 'pattern',
    babyPose: 'sitting',
  },
  'primary-choose-next-small-session': {
    revisionId: 'primary-choose-next-small-session.r1',
    action: 'choose',
    babyPose: 'sitting',
  },
  'primary-opinion-and-reason': {
    revisionId: 'primary-opinion-and-reason.r1',
    action: 'narration',
    babyPose: 'sitting',
  },
  'primary-instructions-for-builder': {
    revisionId: 'primary-instructions-for-builder.r1',
    action: 'plan',
    babyPose: 'sitting',
  },
  'primary-route-by-own-plan': {
    revisionId: 'primary-route-by-own-plan.r1',
    action: 'walk',
    babyPose: 'standing',
  },
  'primary-see-and-infer': {
    revisionId: 'primary-see-and-infer.r1',
    action: 'explore',
    babyPose: 'sitting',
  },
  'primary-one-change-two-attempts': {
    revisionId: 'primary-one-change-two-attempts.r1',
    action: 'bridge',
    babyPose: 'sitting',
  },
  'primary-share-into-groups': {
    revisionId: 'primary-share-into-groups.r1',
    action: 'sort',
    babyPose: 'sitting',
  },
  'primary-small-book-own-topic': {
    revisionId: 'primary-small-book-own-topic.r1',
    action: 'book',
    babyPose: 'sitting',
  },
  'primary-pause-and-leave-a-note': {
    revisionId: 'primary-pause-and-leave-a-note.r1',
    action: 'pause',
    babyPose: 'sitting',
  },
};
export function resolveActivityDemonstration(
  revision: Pick<ActivityRevision, 'activityId' | 'revisionId'>,
): ActivityDemonstration | null {
  const demo = ACTIVITY_DEMONSTRATIONS[revision.activityId];
  return demo?.revisionId === revision.revisionId ? demo : null;
}
