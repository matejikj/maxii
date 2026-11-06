# Integrating LUMI in a React Native app

## Dependencies

1. Select Expo SDK 58 with React Native 0.88 and React 19.3.
2. Install the LUMI library from a **built audited tarball**, after publication, or as a local workspace.
3. Use `npx expo install react-native-svg react-native-reanimated react-native-worklets`. Expo chooses versions compatible with its SDK.
4. Wrap app content in `LumiThemeProvider`; add `LumiMotionProvider` around animated content.
5. Use `LumiProceduralBackground` when the screen contains UI safe zones; feed its layout from `onLayout` and stable named zones, not from arbitrary render-time random values.

### Layout and performance constraints

- Keep background illustrations behind primary content. SVG surfaces must ignore pointer events and accessibility focus.
- Use memoized `seed`, `safeZones` and style props; otherwise changing object identity can force unnecessary work.
- Do **not** recompile scene documents on each animation frame, scroll event or character blink. Animations modify native shared values only.
- Limit simultaneous animated characters; reserve extra breathing room around moving geometry.
- Measure low-end Android plus one iPhone in release mode. Expo Go/dev profiling is not sufficient.
- Never pass private child/health data or personally identifying fields into seed strings. Character Engine and scene engine process appearance only.

### Common pitfalls

- Importing from `@lumi/forest-design/core` in Node is appropriate; importing `@lumi/forest-design` in Node is **not**, because it also imports native adapters.
- Do not store arbitrary exported SVG inside app records. Store a versioned `StoredSceneRecipe` and regenerate a `SceneDocument` when needed.
- If you need editable vector data, use `readSceneDocument` at any trust boundary; don't inject raw XML into `SvgXml`.
- Keep Storybook excluded from production entry and confirm via Metro bundle.

Refer to `apps/expo-showcase/App.tsx` for the actual showcase.
