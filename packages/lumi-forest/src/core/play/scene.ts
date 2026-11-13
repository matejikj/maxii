import { CHARACTER_BLUEPRINTS } from '../characters/blueprint';
import { prepareCharacterMotion } from '../motion/prepare';
import { circle, ellipse, group, path } from '../vector/nodes';
import type { VectorNode } from '../vector/types';
import type { CharacterPart } from '../characters/blueprint';
import { prepareBabyParts } from './baby';
import { samplePlayMotion } from './motion';
import type { LumiPlayAction, PlayMotionFrame, PlaySceneOptions } from './types';

export type PlayLayerChannel =
  'baby' | 'guide' | 'object' | 'reveal' | 'signal' | 'guideVoice' | 'babyVoice' | 'cover';
export interface PreparedPlayScene {
  readonly options: PlaySceneOptions;
  readonly guideParts: readonly CharacterPart[];
  readonly babyParts: readonly CharacterPart[];
  readonly background: readonly VectorNode[];
  readonly fixedObjects: readonly VectorNode[];
  readonly object: readonly VectorNode[];
  readonly reveal: readonly VectorNode[];
  readonly signal: readonly VectorNode[];
  readonly guideVoice: readonly VectorNode[];
  readonly babyVoice: readonly VectorNode[];
  readonly cover: readonly VectorNode[];
}
const line = (d: string, stroke: string, width = 2, opacity = 1) =>
  path(d, {
    stroke,
    fill: 'none',
    strokeWidth: width,
    opacity,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  });
const round = (x: number, y: number, w: number, h: number, r: number, fill: string) =>
  path(
    `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y}Z`,
    { fill },
  );
const block = (x = 0, y = 0, fill = '#D4B17D') =>
  group([
    round(x - 12, y - 12, 24, 24, 5, fill),
    line(`M${x - 8} ${y - 7} h12`, '#F6E5BF', 1.8, 0.7),
    path(
      `M${x + 8} ${y - 11} Q${x + 15} ${y - 12} ${x + 12} ${y + 7} Q${x + 12} ${y + 12} ${x + 5} ${y + 12}Z`,
      { fill: '#B89870', opacity: 0.35 },
    ),
  ]);
function toy(object: PlaySceneOptions['object'], action: LumiPlayAction): VectorNode[] {
  if (object === 'none') return [];
  if (object === 'ring' || action === 'grasp')
    return [
      circle(0, 0, 13, { fill: 'none', stroke: '#D5AE7E', strokeWidth: 7 }),
      ellipse(-5, -8, 3, 1.5, { fill: '#F6D8B2', transform: 'rotate(-35)' }),
    ];
  if (object === 'car' || action === 'car')
    return [
      group([
        path('M-23 0 L-17 -11 Q-14 -16 -7 -16 H8 Q13 -16 17 -7 L24 -3 V10 H-23Z', {
          fill: '#97B9AD',
        }),
        round(-11, -13, 18, 9, 3, '#DBE9DB'),
        circle(-13, 11, 6, { fill: '#807D6C' }),
        circle(14, 11, 6, { fill: '#807D6C' }),
        circle(-13, 11, 2.3, { fill: '#DCD7BD' }),
        circle(14, 11, 2.3, { fill: '#DCD7BD' }),
      ]),
    ];
  if (object === 'cloth' || action === 'textures' || action === 'dress')
    return [
      group([
        path('M-30 -18 Q-4 -25 28 -16 L32 18 Q9 26 -28 18Z', { fill: '#C4AAA5' }),
        line(
          'M-23 -11 Q0 -16 22 -10 M-24 -4 Q0 -9 24 -3 M-24 5 Q0 0 25 6 M-23 13 Q0 8 25 14',
          '#E9D8C5',
          1.4,
          0.65,
        ),
        ...(action === 'textures'
          ? [
              round(35, -19, 30, 38, 5, '#C3CBAE'),
              line('M40 -10 l20 18 M40 0 l17 16 M47 -13 l15 14', '#E6E7CD', 1.5),
            ]
          : []),
      ]),
    ];
  if (action === 'rattle')
    return [
      round(-4, -3, 8, 29, 4, '#C5A784'),
      circle(0, -11, 15, { fill: '#D5B6A2' }),
      path('M0 -26 A15 15 0 0 1 0 4Z', { fill: '#A4BBA5' }),
      circle(-5, -15, 3.5, { fill: '#F5E5CA' }),
    ];
  if (action === 'drum')
    return [
      ellipse(0, 7, 27, 13, { fill: '#B5AD98' }),
      round(-27, -5, 54, 18, 5, '#CDBE9E'),
      ellipse(0, -5, 27, 12, { fill: '#F3E3C5' }),
      line('M-20 -5 Q0 -16 20 -5', '#DECAA7', 1.5),
    ];
  if (action === 'plant')
    return [
      path(
        'M0 26 Q-4 -5 4 -30 M-1 2 Q-27 -3 -20 -21 Q-1 -22 0 -4 M1 -8 Q24 -12 20 -31 Q2 -31 1 -8',
        { fill: '#A2BA94', stroke: '#77977F', strokeWidth: 2 },
      ),
      round(-21, 24, 42, 11, 5, '#CDB991'),
    ];
  if (action === 'draw' || action === 'plan')
    return [
      group([
        path('M-5 -20 H5 V16 L0 26 -5 16Z', { fill: '#BA9C75' }),
        path('M-5 16 H5 L0 26Z', { fill: '#E2CDA9' }),
        path('M-2 22 H2 L0 26Z', { fill: '#736860' }),
        line('M-2 -15 V12', '#E6D2A4', 1.4),
      ]),
    ];
  if (action === 'measure')
    return [
      round(-40, -5, 80, 10, 2, '#D9BD88'),
      line(
        'M-30 -5 v8 M-20 -5 v5 M-10 -5 v8 M0 -5 v5 M10 -5 v8 M20 -5 v5 M30 -5 v8',
        '#A38A65',
        1.5,
      ),
    ];
  if (action === 'bridge')
    return [round(-40, -6, 80, 12, 4, '#D1B087'), line('M-33 -2 H31', '#F3D9A6', 1.5)];
  if (action === 'nest' || action === 'fit')
    return [
      path('M-15 -16 H15 L11 14 Q0 23 -11 14Z', { fill: '#ABC1B5' }),
      ellipse(0, -16, 15, 5, { fill: '#DBE4CC' }),
      line('M-9 -8 l3 16', '#DDE7D5', 2),
    ];
  if (action === 'roll' || object === 'ball')
    return [
      circle(0, 0, 16, { fill: '#DEB19C' }),
      path('M0 -16 A16 16 0 0 1 0 16 Q10 0 0 -16Z', { fill: '#A8BCA5' }),
      path('M-7 -14 A16 16 0 0 0 -14 -5', {
        fill: 'none',
        stroke: '#F9D9C2',
        strokeWidth: 3,
        strokeLinecap: 'round',
      }),
    ];
  if (
    action === 'picture' ||
    action === 'point' ||
    object === 'picture' ||
    object === 'animalCard' ||
    object === 'faceCard'
  )
    return [
      round(-26, -31, 52, 62, 7, '#F6E9D1'),
      object === 'animalCard'
        ? group([
            circle(-10, -12, 7, { fill: '#BAA17E' }),
            circle(10, -12, 7, { fill: '#BAA17E' }),
            ellipse(0, 0, 18, 16, { fill: '#D6B28D' }),
            circle(-6, -2, 1.8, { fill: '#6B5C4B' }),
            circle(6, -2, 1.8, { fill: '#6B5C4B' }),
            ellipse(0, 7, 6, 4, { fill: '#EFE0BC' }),
          ])
        : object === 'faceCard'
          ? group([
              circle(0, -2, 18, { fill: '#E2B89A' }),
              circle(-6, -5, 2, { fill: '#6B5C4B' }),
              circle(6, -5, 2, { fill: '#6B5C4B' }),
              line('M-6 4 Q0 11 6 4', '#A57163', 2),
            ])
          : group([
              path('M0 -21 L17 10 H-17Z', { fill: '#73866E' }),
              circle(0, 17, 6, { fill: '#C39D79' }),
            ]),
    ];
  if (action === 'book' || action === 'flap' || action === 'closeBook')
    return [
      path('M-39 -27 Q-17 -36 0 -27 Q17 -36 39 -27 V27 Q18 18 0 27 Q-18 18 -39 27Z', {
        fill: '#B9C5A8',
      }),
      path('M-35 -25 Q-18 -31 -2 -24 V22 Q-18 16 -35 23Z', { fill: '#F6EAD0' }),
      path('M2 -24 Q18 -31 35 -25 V23 Q18 16 2 22Z', { fill: '#F6EAD0' }),
      line('M-28 -13 H-10 M-28 -5 H-12 M-28 3 H-9', '#C9BB9A', 1.6),
      circle(17, -5, 9, { fill: '#D9B592' }),
      line('M16 4 v8 M16 8 l6 -4', '#8AAB8E', 2),
    ];
  if (action === 'mirror')
    return [
      path('M-22 -29 Q0 -39 22 -29 L28 28 Q0 37 -28 28Z', { fill: '#C7B591' }),
      round(-20, -25, 40, 49, 10, '#D4E2DF'),
      circle(0, -4, 13, { fill: '#E7C4A7', opacity: 0.8 }),
      line('M-9 7 Q0 12 9 7', '#B68C7A', 1.6),
      line('M-15 -17 l12 -5', '#F4F1DB', 2.5),
    ];
  if (action === 'causeEffect')
    return [
      round(-28, -15, 56, 31, 9, '#A4BBA5'),
      circle(0, -2, 12, { fill: '#EBC9A8' }),
      circle(0, -2, 6, { fill: '#D7AC82' }),
    ];
  if (action === 'shadow')
    return [
      path(
        'M-12 23 Q-28 9 -25 2 Q-22 -2 -15 7 L-15 -19 Q-11 -25 -8 -17 L-5 -27 Q0 -32 3 -24 L6 -16 Q11 -26 14 -18 L14 6 Q26 -4 29 4 L17 23Z',
        { fill: '#79867C', opacity: 0.45 },
      ),
    ];
  if (
    [
      'takeOut',
      'putIn',
      'give',
      'release',
      'transfer',
      'reach',
      'count',
      'fullEmpty',
      'sort',
      'pattern',
      'choose',
      'explore',
      'trackToy',
      'nearFar',
    ].includes(action)
  )
    return [block()];
  return [];
}
export function preparePlayScene(options: PlaySceneOptions): PreparedPlayScene {
  const action = options.action,
    dark = options.colorMode === 'dark';
  const blueprint = CHARACTER_BLUEPRINTS[options.guideSpecies ?? 'rabbit'];
  const prepared = prepareCharacterMotion(blueprint, {
    pose: 'sitting',
    expression: 'happy',
    appearanceStyle: options.appearanceStyle ?? 'forest',
  });
  const guideParts: CharacterPart[] = prepared.parts.map((part, order) => ({
    id: part.id,
    role: part.role,
    order,
    geometry: part.node,
  }));
  const fixed: VectorNode[] = [];
  if (['putIn', 'takeOut', 'fullEmpty', 'nest', 'fit'].includes(action))
    fixed.push(
      group([
        path('M174 182 Q200 195 226 182 L221 201 Q200 214 179 201Z', { fill: '#C8B28E' }),
        ellipse(200, 182, 26, 9, { fill: '#E5D5B5' }),
      ]),
    );
  if (['choose', 'count', 'sort', 'pattern'].includes(action))
    fixed.push(block(170, 190, '#A9BDA6'));
  if (action === 'hideToy') fixed.push(block(200, 184));
  if (action === 'draw' || action === 'plan' || action === 'measure')
    fixed.push(round(155, 151, 88, 47, 5, '#F0E6CF'));
  if (action === 'bridge') fixed.push(block(168, 192), block(232, 192));
  const matte = dark ? '#4C6058' : '#E6E5CC';
  return {
    options,
    guideParts,
    babyParts: prepareBabyParts(options.babyVariant ?? 'neutral', options.babyPose ?? 'reclined'),
    background: [
      ellipse(202, 203, 176, 29, { fill: matte }),
      line('M47 201 Q202 241 355 200', dark ? '#657265' : '#D1D5BB', 1.5),
      path('M30 201 Q15 190 18 177 Q32 179 30 201 M358 201 Q376 183 381 187 Q380 203 358 201', {
        fill: dark ? '#5C7863' : '#C3CFAE',
        opacity: 0.7,
      }),
    ],
    fixedObjects: fixed,
    object: toy(options.object, action),
    reveal:
      action === 'hideToy'
        ? [path('M201 165 Q220 165 228 187 L224 199 Q209 198 201 189Z', { fill: '#C3ADA7' })]
        : action === 'flap' || action === 'book' || action === 'closeBook'
          ? [round(183, 142, 34, 49, 3, '#B8C5A5')]
          : [],
    signal: [line('M179 141 l-4 -8 M192 136 v-9 M205 141 l5 -8', '#C4A977', 2.2)],
    guideVoice: [
      round(132, 77, 40, 25, 10, dark ? '#536960' : '#F2EBD7'),
      path('M135 98 l-4 9 13 -7Z', { fill: dark ? '#536960' : '#F2EBD7' }),
      circle(143, 89, 2, { fill: '#B59972' }),
      circle(152, 89, 2, { fill: '#B59972' }),
      circle(161, 89, 2, { fill: '#B59972' }),
    ],
    babyVoice: [
      round(288, 77, 40, 25, 10, dark ? '#6B615E' : '#F2DDD0'),
      path('M291 98 l-4 9 13 -7Z', { fill: dark ? '#6B615E' : '#F2DDD0' }),
      circle(299, 89, 2, { fill: '#B59972' }),
      circle(308, 89, 2, { fill: '#B59972' }),
      circle(317, 89, 2, { fill: '#B59972' }),
    ],
    cover:
      action === 'peekaboo'
        ? [
            ellipse(82, 125, 12, 17, { fill: blueprint.rig.soft }),
            ellipse(104, 125, 12, 17, { fill: blueprint.rig.soft }),
            line('M79 117 v10 M84 116 v10 M101 117 v10 M106 116 v10', blueprint.rig.ink, 1, 0.35),
          ]
        : [],
  };
}
export function playPartMotion(
  actor: 'baby' | 'guide',
  part: CharacterPart,
  frame: PlayMotionFrame,
): { degrees: number; x: number; y: number } {
  'worklet';
  let degrees = 0,
    x = 0,
    y = 0;
  if (actor === 'baby') {
    if (part.id === 'left-hand') {
      degrees = -frame.leftHand;
      x = -34;
      y = 34;
    } else if (part.id === 'right-hand') {
      degrees = -frame.rightHand;
      x = 34;
      y = 34;
    } else if (part.id === 'left-foot') {
      degrees = frame.leftFoot;
      x = -28;
      y = 100;
    } else if (part.id === 'right-foot') {
      degrees = frame.rightFoot;
      x = 28;
      y = 100;
    } else if (part.role === 'head' || part.role === 'eye') {
      degrees = frame.babyHead;
      y = -20;
    }
  } else {
    if (['head', 'eye', 'nose', 'mouth', 'cheek', 'muzzle', 'ear', 'face'].includes(part.role)) {
      degrees = frame.guideHead;
      y = -3;
    } else if (part.role === 'paw' && !part.id.includes('foot')) {
      degrees = part.id.includes('left') ? -frame.guideHand : frame.guideHand;
      x = part.id.includes('left') ? -45 : 45;
      y = 80;
    }
  }
  return { degrees, x, y };
}
export function playPartTransform(
  actor: 'baby' | 'guide',
  part: CharacterPart,
  frame: PlayMotionFrame,
): string {
  'worklet';
  const { degrees, x, y } = playPartMotion(actor, part, frame);
  return `rotate(${degrees} ${x} ${y})`;
}
export function playLayerProps(
  channel: PlayLayerChannel,
  frame: PlayMotionFrame,
): { transform: string; opacity: number } {
  'worklet';
  if (channel === 'baby')
    return {
      transform: `translate(${270 + frame.babyX} ${141 + frame.babyY}) scale(.52)`,
      opacity: 1,
    };
  if (channel === 'guide') return { transform: 'translate(92 126) scale(.48)', opacity: 1 };
  if (channel === 'object')
    return {
      transform: `translate(${frame.objectX} ${frame.objectY}) rotate(${frame.objectRotation}) scale(${frame.objectScale * frame.objectScaleX} ${frame.objectScale})`,
      opacity: 1,
    };
  if (channel === 'reveal') return { transform: 'translate(0 0)', opacity: frame.reveal };
  if (channel === 'signal') return { transform: 'translate(0 0)', opacity: frame.signal };
  if (channel === 'guideVoice') return { transform: 'translate(0 0)', opacity: frame.guideSignal };
  if (channel === 'babyVoice') return { transform: 'translate(0 0)', opacity: frame.babySignal };
  return { transform: 'translate(0 0)', opacity: 1 - frame.reveal };
}
/** Portable frame compiler also drives export/contact sheets and deterministic tests. */
export function compilePlayScene(options: PlaySceneOptions, progress = 0.5): VectorNode {
  const prepared = preparePlayScene(options),
    frame = samplePlayMotion(options.action, progress);
  const actor = (name: 'baby' | 'guide', parts: readonly CharacterPart[]) =>
    group(
      parts.map((part) =>
        group(
          [group([part.geometry], { transform: playPartTransform(name, part, frame) })],
          part.transform ? { transform: part.transform } : {},
        ),
      ),
      playLayerProps(name, frame),
    );
  const layer = (channel: 'object' | 'reveal' | 'signal' | 'guideVoice' | 'babyVoice' | 'cover') =>
    group(prepared[channel], playLayerProps(channel, frame));
  return group([
    ...prepared.background,
    ...prepared.fixedObjects,
    actor('guide', prepared.guideParts),
    actor('baby', prepared.babyParts),
    ...(['object', 'reveal', 'signal', 'guideVoice', 'babyVoice', 'cover'] as const).map(layer),
  ]);
}
