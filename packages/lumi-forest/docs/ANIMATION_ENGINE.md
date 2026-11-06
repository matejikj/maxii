# LUMI v0.6 — Animation Engine architecture

## Design goal and separation of concerns

The 0.6 engine adds behavior to **existing** immutable 0.3 character anatomy, 0.4 procedural scenes and 0.5 UI tokens. It does not add an imperative animation layer to the compiler, does not introduce an image-raster pipeline, and does not change the VectorNode or SceneDocument schemas.

```
CharacterBlueprintV2 ──compileCharacter()──▶ VectorNode IR
                        │
                        ▼  useMemo on semantic inputs (no per-frame renders)
                   prepareCharacterMotion()
                        │
                        ├─ stable compiled parts + rig pivots
                        └─ animated channel annotations
                                   │
     LumiMotionProvider (OS Reduce Motion, AppState) ─┐
                                                      ▼
                                   Reanimated 4 SharedValues/worklets
                                   │                    │
                                   ▼                    ▼
                              Animated SVG G       Animated.View
                              eyes / ears          breathe / lift / float
```

Core: `src/core/motion/` (pure TypeScript), mobile adapter: `src/react-native/motion/`. No engine path imports React Native; no worklet references a compiler. `prepareCharacterMotion` produces part ordering identical to the original source, including sleeping outer transform. Tests reconstruct the original geometry verbatim across all five species × 3 poses × 4 expressions and with accessories/proportions.

## Exposed APIs

- `LumiMotionProvider`: listen to OS Reduce Motion and `AppState` exactly once per mounted provider. **Required** to enable animation; without it, components fail safely to the original still illustration. Optional preference `preferReducedMotion` can further disable but never override OS.
- `LumiAnimatedCharacter`: `species`, `pose`, `expression`, `motion='idle'|'sleeping'|'still'`, `playing`, `celebrationKey`, plus all supported Character Engine props. Geometry recomposes only when semantic inputs change. Increment `celebrationKey` *after a successful milestone-save action*, not for every render.
- `LumiSceneTransition`: crossfades at most two already-compiled `SceneDocument` objects. Never use as a navigation replacement. Pass memoized documents.
- `LumiAnimatedProceduralBackground`: extends the procedural planner by an opt-in 18dp movement envelope; places the original character above the static SVG environment and inside the same safe-zone plan. If there is insufficient space for the whole movement envelope, the planner omits the character rather than overlapping content. Geometry is not recompiled by motion updates.
- `LUMI_MOTION_PROFILE` + `LUMI_MOTION_BUDGETS`: declarative, validated defaults and performance targets.

## Motion channels

| Channel | Technical implementation | Default |
|---|---|---|
| Blink | SVG eye groups scale vertically from 1 to .06 then back, at authored eye pivots | ~4.7s cycle + stable animal offset |
| Breathe | Native Animated.View scale | 1 ↔ 1.018, ~3.8s cycle |
| Ears | Independent left/right SVG group rotation with rig pivots | ±3.2° |
| Sleeping | No blinking or ears; slower breathing and gentle floating | 2.2dp |
| Milestone reaction | One-shot lift + three SVG sparkle shapes with fade | 680ms |
| Scene transition | Crossfade two immutable document views | 360ms |

No timers or JS callbacks drive the frame loop. The only timer on scene transitions removes the outgoing document *after* a native opacity animation; delayed JS scheduling can postpone cleanup, never animation frames. All movement is transform/opacity; avoid layout-affecting animation properties.

## Reduced Motion and lifecycle

When system Reduce Motion is enabled, the optional app preference is set, the app is in background or a screen sets `playing=false`, perpetual Reanimated worklets are cancelled and the original static drawing is retained. The provider initializes conservatively with motion disabled until the OS accessibility query resolves. React Native notifies of subsequent Reduce Motion changes. The provider **does not** globally reconfigure unrelated navigation/sheet animations.

The app decides which screen is visible: use `playing={isFocused}` with React Navigation/Expo Router. Hide/unmount animated tabs instead of keeping dozens of idle worklets. The design system does not inspect the user's personal data and never generates a seed from personally identifying details.

## Example

```tsx
import {
  LumiMotionProvider, LumiAnimatedCharacter, LumiAnimatedProceduralBackground,
} from '@lumi/forest-design';

<LumiMotionProvider enabled>
  <LumiAnimatedCharacter species="fox" motion="sleeping" pose="sleeping" expression="sleepy" />
  <LumiAnimatedCharacter species="rabbit" motion="idle" celebrationKey={milestoneSavedCounter} />
  <LumiAnimatedProceduralBackground
    scene="home" animal="rabbit" seed="anonymous-screen-variant"
    safeZones={[{ id: 'dashboard', x: 14, y: 16, width: 250, height: 300, padding: 12 }]}
  />
</LumiMotionProvider>
```

Stable array/object references for `accessories`, `proportions` and `safeZones` should be memoized in consumers. React.memo/useMemo do not protect against callers that recreate semantic objects on every render.

## Quality evidence and release gates

Executed locally: TypeScript **core**, source syntax, pure motion contract / accessibility / movement-envelope tests, and existing legacy golden + raster regressions. **NOT executed:** native typecheck, Metro, actual animated SVG transforms, Storybook runtime, Maestro, UI-thread/GPU frames or battery profiles. The npm registry is inaccessible in the artifact build environment. `react-native-reanimated` and `react-native-worklets` are already declared for Expo SDK 58, but the new `AnimatedG` numeric `scaleY` and `rotation` props must be verified on real Android/iOS devices before shipping. Do not interpret static screenshot regressions as tests of native animation.

Acceptance: device release build, 60/120Hz testing, real reduced-motion toggle during animation, background/foreground cancellation, rapid scene changes, replays of milestones, and rotation with exclusion zones. Run `.maestro/motion.yaml`, Android `tools/device/measure-motion-android.sh` and iOS Instruments Animation Hitches.
