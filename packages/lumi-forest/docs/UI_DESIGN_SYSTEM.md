# LUMI UI Design System v0.5 — architecture and contracts

## Objective

One semantic, accessible UI foundation for the existing scene, character, and procedural engines. UI is **real React Native views**, not SVG; SVG renders behind content. This separation allows system text scaling, native keyboard behaviors, screen readers, and performant virtualized lists.

## Package organization

```text
src/core/ui/
  tokens.ts           # Immutable, renderer-neutral spacing/type/shape tokens
  theme.ts            # Immutable scene × light/dark semantic theme cache
  accessibility.ts    # Contrast calculation, no React imports
  index.ts
src/react-native/
  LumiThemeProvider.tsx # System appearance + compatibility semantic facade
  ui/
    LumiText.tsx
    LumiButton.tsx
    LumiInput.tsx
    LumiCard.tsx
    LumiChip.tsx
    LumiTimeline.tsx
    LumiChartContainer.tsx
    LumiBottomSheet.tsx
    LumiSwitchRow.tsx
    LumiProgress.tsx
    LumiSectionHeader.tsx
    LumiEmptyState.tsx
apps/lumi-showcase/src/DesignSystemLab.tsx
apps/lumi-showcase/stories/*.stories.tsx
apps/lumi-showcase/.rnstorybook/*
```

No `src/core/` file imports React, React Native, Storybook or native modules. Themes are **pure data**. The theme provider only chooses an already-frozen object; when `(scene, mode)` is unchanged, context reference stays stable. UI components subscribe to theme, not to unrelated app data.

## Theme resolution

- `mode="light"` — explicit light UI.
- `mode="dark"` — explicit dark UI.
- `mode="system"` — responds to `useColorScheme()`.
- Scene accents: `home`, `growth`, `sleep`, `feeding`, `milestones`. **Decorative** scene colors from `SCENE_CATALOG` never automatically become accessible text colors.
- `colors` roles: `background`, `surface`, `surfaceSubtle`, `surfaceElevated`, `text`, `textMuted`, `textInverse`, `border`, `controlBorder`, `focus`, `primary`, `onPrimary`, `secondary`, `onSecondary`, `danger`, `onDanger`, `success`, `warning`, `sceneAccent`, `sceneAccentSoft`, `onSceneAccent`, `overlay`.
- `ui` roles: `space`, `radius`, `size`, `opacity`, `type`.
- Legacy `theme.semantic`, `theme.tokens`, `theme.palette` remain readable; new work must use `theme.colors` and `theme.ui`.

`src/core/ui/accessibility.ts` computes WCAG contrast mathematically. All 5 scenes × 2 modes meet at least **4.5:1** for ordinary text-role combinations. Form outlines and focus rings meet **3:1** against the surface; these are token-level checks, **not** a substitute for screen-reader or real-world usability testing.

## Components

| Component | Contract | Accessibility / performance |
|---|---|---|
| `LumiText` | `variant`, `tone`, native TextProps | Dynamic Type remains enabled; all typography from tokens |
| `LumiButton` | `title`, `variant`, `size`, `loading`, `disabled`, native PressableProps | 44dp+ hit area; busy/disabled states; readable labels; keyboard focus ring |
| `LumiInput` | `label` (required), `hint`, `error`, TextInputProps | Descriptive label, error announcement, controlled/uncontrolled native input, keyboard focus/error border |
| `LumiCard` | `variant`, `padding`, ViewProps | Non-interactive View; preserves v0.4 props |
| `LumiChip` | `label`, `selected`, PressableProps | Checkbox semantics and 44dp hit area |
| `LumiTimeline` | `items[]` with stable ids | Each item exposed as a spoken event; use FlatList for large datasets |
| `LumiChartContainer` | `title`, **`summary` required**, `children`, `footer` | Visual chart exposed with textual equivalent; chart renderer is pluggable |
| `LumiBottomSheet` | `visible`, `title`, `onClose`, `bottomInset` | Native Modal, Android back action, dismiss backdrop, scrollable content, reduced-motion behavior |
| `LumiSwitchRow` | `label`, `description`, `value`, `onValueChange` | Native Switch semantics |
| `LumiProgress` | `label`, `value`, `max` | Native `progressbar` role and value |
| `LumiSectionHeader` | `title`, `subtitle`, optional action | Header semantics and optional action button |
| `LumiEmptyState` | `title`, `description`, optional action | Readable state plus named action |

## API

```tsx
import { LumiThemeProvider, LumiText, LumiButton, LumiInput,
  LumiCard, LumiBottomSheet, LumiChartContainer } from '@lumi/forest-design';

function Screen() {
  return <LumiThemeProvider scene="growth" mode="system">
    <LumiCard>
      <LumiText variant="h1">Růst dítěte</LumiText>
      <LumiInput label="Hmotnost" keyboardType="decimal-pad" />
      <LumiButton title="Uložit měření" onPress={() => {}} />
    </LumiCard>
  </LumiThemeProvider>;
}
```

For a chart, always provide a real, meaningful `summary` of its key information. Do not substitute a decorative caption or a placeholder.

### Accessibility invariants

- Native Text/Pressable/TextInput/Switch/Modal are used instead of drawing controls in SVG.
- Do not disable font scaling. Avoid fixed text container heights.
- No interactive target smaller than 44 logical dp.
- All controls are labelled and dynamic states are exposed through native `accessibilityRole`/`accessibilityState`/`accessibilityValue`.
- External state, form validation, and data persistence belong to application code.
- Test VoiceOver/TalkBack focus order, text scaling to 200%, keyboard navigation, modal presentation/dismissal and reduced-motion on physical devices before release. Native interactions are **not yet device-verified**.
- Use `bottomInset={useSafeAreaInsets().bottom}` on BottomSheet if the host screen needs more room around the home indicator; keep safe area management at the application edge.
- The current `LumiBottomSheet` is a lightweight native Modal-based sheet, **not** a gesture-driven sheet. If swipe-to-dismiss, drag snap points or strong focus trapping are necessary, swap its internal implementation behind this stable public contract after device QA.

### Performance invariants

- No SVG-to-XML parsing on a UI component render.
- No JS-frame animation for default components; static state switches only.
- Native platform controls for inputs and toggles.
- Stable, prebuilt theme objects; tiny `React.memo` wrappers where useful.
- `LumiTimeline` is small-list only; use FlatList/FlashList around large historical datasets rather than rendering all events.
- Profile UI transitions, touch latency and sheet dismissal in release builds; JSX syntax checking and token tests do not measure device FPS.

## Storybook

See [STORYBOOK.md](STORYBOOK.md). The standalone on-device Storybook uses `STORYBOOK_ENABLED=true` to **swap entry points**, so no Storybook code is bundled in the ordinary app. This is aligned with Storybook React Native v10.4+ configuration guidance.

## Migration from v0.4

- Existing `LumiThemeProvider scene="home"` remains a valid call. The default mode now follows the system; set `mode="light"` to preserve an always-light design.
- Existing `<LumiCard style={...}>` remains valid, with equivalent surface and border behavior. Padding defaults to 24 rather than the old 20; pass `style={{ padding: 20 }}` for pixel-identical padding.
- All old `LumiBackground`, `LumiProceduralBackground`, `LumiCharacter`, pure compilers and exported SVG golden files are unchanged.
- `LumiText` is the preferred text primitive instead of custom `Text` style declarations on new screens.
- The original Expo scene/character/performance demonstrations still have legacy static styling and intentionally render inside a light-mode provider. The new UI Lab is fully theme-token-driven; migrate old demonstration-only screen styles before treating those labs as production app screens.

## Release blockers

1. Full React Native and Storybook typecheck once the npm registry is available.
2. Android/iOS Metro bundles including the **Storybook** entry point.
3. Device screenshot baselines and Maestro tests on fixed device profiles.
4. VoiceOver/TalkBack, 200% font scaling, high contrast, reduced motion, UI keyboard and focus order.
5. Performance profiling using the v0.2.1 device/perf tools.
