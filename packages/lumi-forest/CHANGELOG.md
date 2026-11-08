# Changelog

## 1.0.0 — source release candidate (unreleased)

- `LumiInput` links error/hint text to the field, supports multiline notes, and keeps the system keyboard (optional dictation) without a custom microphone control.
- `LumiBottomSheet` closes on Escape (web), moves accessibility focus into the sheet, and can restore focus to the opener via `returnFocusRef`.
- `LumiChartContainer` accepts an optional `table` of label/value rows so charts always expose a non-visual alternative.
- `LumiButton` compact size uses a 48 logical-unit minimum touch target for primary care actions.
- Stable public entrypoints (`.`, `./core`, `./native`) with public-name snapshot/compatibility gate.
- Versioned, strict, serializable Scene Recipe v2 and pure v1→v2 migration; exact SVG preservation.
- Blueprint v1/v2 validation with fail-closed, lossless-only conversion of matching legacy artwork.
- Safe external SceneDocument v1 JSON ingestion; bounded geometry, numeric attributes and safe SVG paint/path values.
- Dedicated release CPU diagnostics and physical Android/iOS evidence schema, with no fabricated native metrics.
- Bob ESM/TypeScript publishing configuration; GitHub quality, manual release-candidate and optional OIDC npm publishing workflows.
- Source and documentation updated for supported Expo SDK 58 / RN 0.88 / React 19.3.
- Character and procedural engines, semantic light/dark UI and Reanimated motion share the same renderer-neutral vector representation.
- Workspace separation keeps the framework, Expo showcase/Storybook and parent-facing application independent.
- Native and browser consumers resolve the TypeScript sources; Node consumers use the built ESM outputs.
- Current local technical documentation is consolidated into architecture, integration, versioning and validation/release guides; local plans and supporting documents are excluded from Git and the npm package.
