# LUMI Forest — v1.0.0 source release candidate

**Declarative, deterministic vector design system for React Native / Expo.**
The library contains Character Engine (10 animals; expressions, poses, accessories, semantic states and offline props), Procedural Scene Engine with safe zones, accessible UI components, motion and themed illustration assets.

**Certification status:** Automated checks cover core contracts, image regressions, public API, TypeScript, package outputs and Metro exports. A passing result belongs to the tested commit and build. Physical-device rendering, frame/memory metrics, signed native builds and store distribution remain **NOT verified**. The release and npm publication workflows fail closed until real device evidence and the remaining release requirements are provided. Do not claim a production-certified v1.0.0 yet.

## Supported environment

- Expo SDK **58**, React Native **0.88**, React **19.3**.
- `react-native-svg` 15.16, `react-native-reanimated` 4.7, `react-native-worklets` 0.13.
- Node >= 22.13 for tooling and builds. Skia is **not** a runtime dependency.
- Package name `@lumi/forest-design` is a _local placeholder_: do not attempt npm publication unless you own this namespace and have set a suitable license (currently `UNLICENSED`).

## Install / run the showcase

Run these commands from the **repository root**. The framework is a publishable workspace at `packages/lumi-forest`; the Scene, Character, UI, Performance and Motion labs plus Storybook live in `apps/lumi-showcase`. The separate parent-facing app lives in `apps/baby-tracker` and starts with `npm run baby:start`. See the [repository guide](../../README.md).

```sh
npm ci                        # Install from the shared repository-root lockfile
npm run build                 # Bob ESM modules + TypeScript declarations
npm run typecheck:all         # Framework + both applications
npm run test:all              # Framework, workspace boundaries and image regression checks
npm run expo:doctor
npm run expo:start            # Expo showcase (including Scene, Character, UI, Motion labs)
```

`npm run expo:storybook` starts the separate Storybook entry. Run Metro bundles using `npm run expo:bundle:android` and `npm run expo:bundle:ios` after dependencies are available.

### Renderer-neutral generation (no React Native import)

```ts
import {
  migrateSceneRecipe,
  encodeSceneRecipe,
  decodeSceneRecipe,
  compileSceneRecipe,
  composeScene,
  compileCharacter,
  CHARACTER_BLUEPRINTS,
  serializeScene,
} from '@lumi/forest-design/core';

// Stored presets have independent versioning from SceneDocument IR.
const persisted = migrateSceneRecipe({ schemaVersion: 1, scene: 'growth', seed: 'public-example' });
const json = encodeSceneRecipe(persisted); // Store only product-agnostic visual settings
const document = compileSceneRecipe(decodeSceneRecipe(json));
const xml = serializeScene(document); // OFFLINE export; no runtime XML parsing in RN

const rabbit = compileCharacter(CHARACTER_BLUEPRINTS.rabbit, {
  pose: 'standing',
  expression: 'happy',
  accessories: ['flower'],
});
```

### React Native integration

```tsx
import {
  LumiThemeProvider,
  LumiBackground,
  LumiCard,
  LumiText,
  LumiAnimatedCharacter,
  LumiMotionProvider,
} from '@lumi/forest-design';

function GrowthScreen() {
  return (
    <LumiThemeProvider scene="growth" mode="system">
      <LumiMotionProvider>
        <LumiBackground scene="growth" seed="non-identifying-seed" />
        <LumiCard>
          <LumiText variant="h2">Růst</LumiText>
        </LumiCard>
        <LumiAnimatedCharacter species="bear" expression="happy" motion="idle" />
      </LumiMotionProvider>
    </LumiThemeProvider>
  );
}
```

A `LumiBackground` is absolute-positioned decorative SVG; arrange the app's real content layout separately, passing measured safe zones into `LumiProceduralBackground` where needed. See the example app for practical layout.

## Public entrypoints

- `@lumi/forest-design`: core + native components (imports motion peer dependencies).
- `@lumi/forest-design/core`: **pure TypeScript**, suitable for Node, tooling and tests.
- `@lumi/forest-design/native`: React Native UI and motion adapters, including web through `react-native-web`.

Only these entrypoints and `package.json` are public. Do not deep-import source files. `contracts/public-api.json` freezes exported symbol names. An intentional change requires `npm run api:approve` and a SemVer review.

Native and browser consumers use the shipped TypeScript sources through the `react-native` and `browser` export conditions. Expo transpiles these sources for the selected platform, so workspace web development does not depend on a previously generated `lib/`. Default Node/ESM consumers continue to use the Bob build outputs.

## Versions, migrations and compatibility

- Stored Scene Recipe v1 → v2 via `migrateSceneRecipe()`; `compileSceneRecipe()` targets SceneDocument v1 IR to preserve old SVG art.
- SceneDocument v1 is the active stable renderer document format; use `readSceneDocument()` at untrusted JSON boundaries.
- Blueprint v1 and v2 are both accepted. `migrateCharacterBlueprint()` upgrades **only exact-artwork equivalent** bundled legacy blueprints; custom V1 authors should keep V1 or manually author a V2 rig.
- **No silent conversion** of unknown future schema versions; explicit errors preserve data integrity.

## Quality and performance

Run framework-only commands from `packages/lumi-forest`:

```sh
npm run typecheck:core
npm test
npm run api:check
npm run test:visual
npm run test:characters:visual
npm run test:procedural:visual
npm run test:motion:visual
node tools/bench-release.cjs reports/performance/node-cpu-local.json
```

Golden scene SHA-256 hashes and image baselines track the current bundled artwork. Intentional art changes update both after visual review; complexity budgets remain enforced in tests. **Node CPU timings do not show mobile FPS or memory consumption**. Real-device performance requires sanitized physical Android/iPhone measurements for the exact release commit and the release evidence gate. The source repository includes [evidence requirements](release-evidence/README.md) and the verifier at `tools/device/verify-release-evidence.cjs`.

Release checks include `npm run release:verify-device`, `npm run release:verify-package`, and `npm run release:smoke-core`. Publishing additionally requires ownership of the package namespace, an appropriate license, the committed dependency lockfile, and manual approval in the configured GitHub environment.

## Architecture boundaries

App environments are independent of activity scenes and character styles. `LumiThemeProvider motif="garden"` (or `"playground"` / the default `"forest"`) changes semantic UI colors in light/dark mode. `LumiMotifLandscape` follows that context and supports `variant="day"` or `"dusk"`; a `motif` override renders settings previews. Core tools use `compileLumiMotifLandscape()` to obtain the same deterministic 400×200 `SceneDocument`. `LUMI_MOTIFS` supplies the display metadata. Geometry is retained for the twelve supported motif/mode/variant combinations, contains no remote images or effects, and stays within a 180-node budget. Existing activity-scene recipes and stored documents keep their original semantics. Run `npm run test:motifs:visual` for the twelve scenery references.

The framework uses a renderer-neutral `VectorNode` / `SceneDocument` IR and native `react-native-svg` rendering. Core compilers stay independent of React Native; motion works above prepared geometry. Application records, accounts, storage and synchronization remain outside the framework. Optional Skia / prerendering should be decided only after measured bottlenecks and reproducible A/B comparisons. The current release candidate is summarized in [CHANGELOG.md](CHANGELOG.md).

Bundled character artwork uses sculpted Bézier silhouettes, matte light/shadow planes and species-specific fur, feathers, ear folds and paw details. The source authoring pass in `sculptedAnatomy.ts` nests material details inside their existing anatomical part, preserving IDs, painter order, rig landmarks, expression replacement and motion channels. Rabbit artwork revision `b2` and the other species' `c2` revisions keep blueprint schema v2 and the existing public API. The refreshed neutral face has open eyes with a small glint; happy and sleepy expressions retain their calm closed-eye recipes. V1 artwork remains supported as authored and only migrates when it exactly matches the current bundled art.

The 24-unit icon family uses botanical silhouettes, round strokes and translucent material planes. The four stable navigation IDs (`today`, `care`, `development`, `history`) are joined by `sleep`, `nursing`, `bottle`, `food`, `diaper`, `growth`, `plus`, `arrow-right`, `experience` and `settings`. Both `compileLumiIcon()` and native `LumiIcon` accept an optional `accentColor`; omitting it preserves single-tint rendering. Icons remain renderer-neutral vectors, and decorative icons stay outside the accessibility tree unless explicitly labeled.

Task plans and supporting Markdown documents are local-only and excluded from Git and the npm package. Standard project READMEs and changelogs remain versioned.

## Baby avatars and play demonstrations

`LumiBaby` renders the optional `neutral`, `girl` or `boy` avatar. Its named anatomy
and authored `reclined`, `tummy`, `sitting` and `standing` poses use the same vector
IR and part roles as the animal collection, with a separate `BabyBlueprint` and
human rig. Babies are not animal guide IDs. Timi (`tiger`) and Hugo (`hippo`) extend
the existing animal blueprint, expression and appearance pipeline.

`LumiPlayScene` composes a baby, any selected guide and an offline play recipe on
one SVG surface. The caller supplies `action`, optional `object`, `babyVariant`,
`babyPose`, `guideSpecies`, `step`, `stepCount`, `cycle` and `playing`. One continuous
UI-thread clock drives the entire clip, native part transforms and progress line;
geometry is not rebuilt per frame. `onStepChange` reports instruction boundaries
and `onComplete` reports the final frame. `step` and `cycle` are seek/restart
commands: keep reported steps in separate display state to avoid seeking on every
callback. Pausing preserves the exact position and resuming keeps the original
speed. Set `playing={false}` whenever the scene is offscreen or its route loses
focus; foreground changes are also guarded internally.

The default `motionIntent="automatic"` follows the live system/user motion policy.
Use `motionIntent="user"` only for instructional playback deliberately started by
the user. This permits requested demonstrations even with decorative animations
disabled, without changing system settings or enabling other animations. The
activity app starts paused, supports play/pause/resume, step selection and replay,
and binds every bundled published revision explicitly in
`activityDemonstrations.ts`. Viewing a demonstration does not confirm readiness
conditions; the original instructions and conditions still govern doing the game.

`npm run export:play --workspace @lumi/forest-design` exports deterministic SVG
frames for all recipes, both new guides and every baby pose. Generated previews
stay outside Git; core tests check geometry budgets, motion bounds and coverage.
