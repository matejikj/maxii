# LUMI v0.5 on-device Storybook

The Storybook configuration follows React Native Storybook 10.4+ guidance: `withStorybook` from `@storybook/react-native/withStorybook`, a dedicated `.rnstorybook/index.tsx` that registers the root, stories in `apps/expo-showcase/stories`, and `STORYBOOK_ENABLED=true` for entry-point replacement. Ordinary release builds do **not** include Storybook UI modules by this route.

## Prerequisites

```bash
npm install             # Needs reachable npm registry
# Storybook Expo showcase also includes gesture-handler, Reanimated 4, worklets,
# gorhom bottom-sheet and AsyncStorage; confirm Expo SDK 58 alignment with expo install --check
npm run typecheck:all   # Checks RN components, Expo app and stories
npm run expo:doctor
```

## Launch

```bash
npm run expo:start       # Original Expo scene/character labs + new UI Kit tab
npm run expo:storybook   # Separate Storybook app entry point
# or
npm run storybook:android --workspace @lumi/expo-showcase
npm run storybook:ios --workspace @lumi/expo-showcase
```

`npm run expo:storybook:bundle:android` checks the Storybook JS entry in CI. If Storybook version or Expo bundler behavior changes, recheck the `withStorybook` config and generated `storybook.requires.ts`; do not hand-edit generated code.

## Stories currently provided

- Animation v0.6: Character motion, sleep, celebration, Reduce Motion override (requires device to confirm timing)


- Foundations: Typography, Themes (explicit light and dark side by side)
- Actions: Button variants, loading and disabled
- Forms: Input states, Chips, Switch and Progress
- Surfaces: Card variants
- Data: Timeline and ChartContainer
- Overlays: BottomSheet interactive example
- Feedback: EmptyState

The `DesignSystemLab` in the ordinary showcase additionally tests actual state changes and integrated application layouts. Storybook stories are an isolated component catalog, not a substitute for E2E tests.

## Screenshot QA

After building/installing the app on a fixed simulator/device profile, use:

```bash
maestro test .maestro/ui-design-system.yaml
python3 tools/ui-visual-regression.py verify
# Only after human approval of changes:
python3 tools/ui-visual-regression.py approve
```

Keep Android and iOS, font scaling and screen sizes as **separate** screenshot baseline directories. No native screenshots have been captured in this offline workspace; `tests/ui-native/baselines` is intentionally empty. CI must not claim screenshot success without a real device/emulator and reviewed baselines.

## Accessibility QA checklist

- On Android TalkBack / iOS VoiceOver, buttons and switch states are announced and input errors are discoverable.
- VoiceOver focus enters the BottomSheet and returns after closing; verify native Modal behavior for your RN/Expo version.
- At 200% font scaling, buttons grow, labels do not clip and forms remain scrollable.
- Test both system appearance modes and explicit overrides; inspect scene-specific accent contrasts.
- Test reduced-motion sheet behavior and focus visibility with keyboard or hardware controls.
