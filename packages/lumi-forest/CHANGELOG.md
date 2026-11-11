# Changelog

## 1.0.0 — source release candidate (unreleased)

- Added independent Forest, Garden and Playground app environments: semantic light/dark palettes, validated motif IDs, display metadata and retained day/dusk card scenery in pure vector IR. `LumiThemeProvider` accepts `motif`; `LumiMotifLandscape` renders the same geometry as `compileLumiMotifLandscape`. Existing scene/character APIs remain supported. Contrast, document roundtrips, bounded geometry and twelve image references cover the new motifs.
- Added a botanical flower for diary experiences and a soft settings glyph; all 14 icons retain the same renderer-neutral, optional two-tint API.
- Botanical icon refresh with softly carved silhouettes, translucent planes and optional `accentColor` on core/native icons. Preserved all four navigation IDs and added sleep, nursing, bottle, food, diaper, growth, plus and arrow-right glyphs. Single-tint callers remain supported; no font or remote asset dependency.
- Refreshed all eight character artworks with sculpted silhouettes, species-specific body shapes, matte volume shading, glinting neutral eyes, ear folds, paw/toe detail, otter whiskers and owl wing feathers. Artwork revisions advance to rabbit `b2` / fleet `c2`; blueprint schema, part IDs, rig landmarks and public API stay stable. Material details remain inside their anatomical owners across poses, proportions and motion. Forehead highlights now follow the head; appearance styles also reach grouped anatomy. Updated scene hashes and character/scene/studio/procedural/motion image baselines cover the intentional art refresh.
- `LumiInput` links error/hint text to the field, supports multiline notes, and keeps the system keyboard (optional dictation) without a custom microphone control.
- `LumiBottomSheet` closes on Escape (web), moves accessibility focus into the sheet, and can restore focus to the opener via `returnFocusRef`.
- `LumiChartContainer` accepts an optional `table` of label/value rows so charts always expose a non-visual alternative.
- `LumiButton` compact size uses a 48 logical-unit minimum touch target for primary care actions. Full-width labels use the available row width so complete action names stay readable with larger system text and optional adornments.
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
