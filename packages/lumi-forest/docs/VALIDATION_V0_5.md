# v0.5.0 validation record

Platform-independent tests and baseline visual checks were executed in the workspace. This is **not** an on-device RN certification.

| Check | Outcome | Scope |
|---|---|---|
| `npm run typecheck:core` | PASS | Pure TS scene + character + procedural + UI token/theme/accessibility core |
| `npm test` | PASS: 94 tests | Existing tests + 18 UI tests (10 scene/mode color tests + contracts) |
| `npm run test:visual` | PASS: 30/30 | Legacy scene raster goldens |
| `npm run test:characters:visual` | PASS: 40/40 | Original animal variants |
| `npm run test:procedural:visual` | PASS: 30/30 | Original procedural scene sizes |
| `npm run check:tsx` | PASS: syntax only | New RN component and Storybook TSX syntax |
| `npm run typecheck:all` | BLOCKED | npm registry unavailable, React/RN/Storybook typings not installed |
| Expo native builds and Storybook launch | NOT RUN | Require Expo/npm dependencies, simulator/device |
| Maestro screenshots | NOT RUN | No simulator/physical device; no native baselines |
| VoiceOver/TalkBack, keyboard, font scaling | NOT RUN | Require device QA |

Contrast checks verify mathematical token pairs, not visual layout/accessibility behavior in the actual application. The Storybook setup has been authored against its current official documentation but could not be executed against the installed packages in this offline environment.

Note: the static UI mockup in `previews/lumi-v0.5-ui-spec.png` is programmatically drawn from the theme tokens, **not** an image captured from Expo or Storybook. The Storybook-specific Expo native dependencies were declared but could not be installed or resolved in this offline workspace. Native typecheck is the next mandatory release gate.
