# LUMI Forest — v1.0.0 source release candidate

**Declarative, deterministic vector design system for React Native / Expo.**
The library contains Character Engine (5 animals; expressions, poses and accessories), Procedural Scene Engine with safe zones, accessible UI components, motion and themed illustration assets.

**Certification status:** Pure TypeScript core, offline image regressions and API contracts have been tested. Full React Native typecheck, production mobile bundling and physical-device frame/memory metrics have **NOT** been independently verified in this environment. The release and npm publication workflows deliberately fail closed until these checks and real device evidence are provided. Do not claim a production-certified v1.0.0 yet.

## Supported environment

- Expo SDK **58**, React Native **0.88**, React **19.3**.
- `react-native-svg` 15.16, `react-native-reanimated` 4.7, `react-native-worklets` 0.13.
- Node >= 22.13 for tooling and builds. Skia is **not** a runtime dependency.
- Package name `@lumi/forest-design` is a *local placeholder*: do not attempt npm publication unless you own this namespace and have set a suitable license (currently `UNLICENSED`).

## Install / run the showcase

```sh
npm install                    # Requires npm network access; generate and commit package-lock.json once
npm run build                 # Bob ESM modules + TypeScript declarations
npm run typecheck:all         # Source library + Expo showcase
npm run test:all              # 129 pure tests, 120 image regressions, parser and API checks
npm run expo:doctor
npm run expo:start            # Expo showcase (including Scene, Character, UI, Motion labs)
```

`npm run expo:storybook` starts the separate Storybook entry. Run Metro bundles using `npm run expo:bundle:android` and `npm run expo:bundle:ios` after dependencies are available.

### Renderer-neutral generation (no React Native import)

```ts
import {
  migrateSceneRecipe, encodeSceneRecipe, decodeSceneRecipe, compileSceneRecipe,
  composeScene, compileCharacter, CHARACTER_BLUEPRINTS, serializeScene
} from '@lumi/forest-design/core';

// Stored presets have independent versioning from SceneDocument IR.
const persisted = migrateSceneRecipe({ schemaVersion: 1, scene: 'growth', seed: 'public-example' });
const json = encodeSceneRecipe(persisted); // Store only product-agnostic visual settings
const document = compileSceneRecipe(decodeSceneRecipe(json));
const xml = serializeScene(document); // OFFLINE export; no runtime XML parsing in RN

const rabbit = compileCharacter(CHARACTER_BLUEPRINTS.rabbit, {
  pose: 'standing', expression: 'happy', accessories: ['flower']
});
```

### React Native integration

```tsx
import { LumiThemeProvider, LumiBackground, LumiCard, LumiText, LumiAnimatedCharacter, LumiMotionProvider } from '@lumi/forest-design';

function GrowthScreen() {
  return (
    <LumiThemeProvider scene="growth" mode="system">
      <LumiMotionProvider>
        <LumiBackground scene="growth" seed="non-identifying-seed" />
        <LumiCard><LumiText variant="h2">Růst</LumiText></LumiCard>
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
- `@lumi/forest-design/native`: explicitly mobile-only components.

Only these entrypoints and `package.json` are public. Do not deep-import source files. `contracts/public-api.json` freezes exported symbol names. An intentional change requires `npm run api:approve` and a SemVer review.

## Versions, migrations and compatibility

- Stored Scene Recipe v1 → v2 via `migrateSceneRecipe()`; `compileSceneRecipe()` targets SceneDocument v1 IR to preserve old SVG art.
- SceneDocument v1 is the active stable renderer document format; use `readSceneDocument()` at untrusted JSON boundaries.
- Blueprint v1 and v2 are both accepted. `migrateCharacterBlueprint()` upgrades **only exact-artwork equivalent** bundled legacy blueprints; custom V1 authors should keep V1 or manually author a V2 rig.
- **No silent conversion** of unknown future schema versions; explicit errors preserve data integrity.

See [docs/VERSIONING.md](docs/VERSIONING.md), [docs/API_STABILITY.md](docs/API_STABILITY.md) and [docs/INTEGRATION.md](docs/INTEGRATION.md).

## Quality and performance

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

Existing golden scene SHA-256 hashes remain unchanged. Complexity budgets are enforced in tests. **Node CPU timings do not show mobile FPS or memory consumption**. Real-device performance requires the documented test matrix and evidence gate.

See [docs/PERFORMANCE_V1.md](docs/PERFORMANCE_V1.md), [docs/VALIDATION_V1.md](docs/VALIDATION_V1.md) and [docs/RELEASING.md](docs/RELEASING.md).

## Previous architecture and history

The v0.6 animation, v0.5 UI, v0.4 procedural scene and v0.3 character documentation remains in `docs/`. Architecture retains the same `VectorNode` / `SceneDocument` IR and native `react-native-svg` rendering. Optional Skia / prerendering should be decided only after measured bottlenecks and reproducible A/B comparisons.
