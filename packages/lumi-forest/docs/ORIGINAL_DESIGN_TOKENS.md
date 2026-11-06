# LUMI Forest • design tokens

## Geometrie

- Base canvas: 390 × 844 SVG user units, raster independent.
- Character geometry: 190–230 logical units wide, approx. 240 logical units high. Head width ≈ body width; eyes tiny and separated, never dominate the face.
- Landscape: wide Bézier hills at Y510, Y665 and Y765; no angular mountains.
- Decorative density: quiet 5, regular 13, playful 21; skip lower-right animal area.
- Corner system: 12 (small), 18 (medium), 26 (card), 999 (pill).
- Spacing grid: 4 / 8 / 12 / 16 / 24 / 32 / 40.

## Type

- Large screen title: 28/34 bold.
- Secondary heading: 21/28 bold.
- Main copy: 15/23 regular.
- Secondary / labels: 12/18 medium.
- Numeric statistics: 36/42 semibold or bold.
- Text never over decorative animals; chart semantics encoded in native UI, not SVG.

## Mark of authorship

**The seed** is a small leaf/teardrop at the belly and in the visual logo. It communicates growth without gender stereotypes and unifies all animals. The secondary '4-way sparkle' and distinctive leaf sprig have the same simple Bézier curves as the animal anatomy.

## Interaction and accessibility

- Minimum tap target 44×44 points on iOS; Android recommended 48×48 dp.
- `LumiBackground` is decorative and non-interactive (`pointerEvents=none`, `accessible=false`).
- Normal small text should meet WCAG 4.5:1 contrast ratio. Ink and `accentText` rather than illustrative `accent`.
- Test accessibility screen reader, bold text settings, large fonts and `reduceMotion`.
- Motion is optional and nonessential; avoid periodic continuous motion around bedtime screen.

## Future assets

- Portrait animal stickers (1:1) based on same anatomy.
- Empty states: sleeping animal for missing sleep records, explorer for first milestone.
- Seasonal scenes: add one accessory, not a whole new incompatible animal style.
- Age progression: illustration transforms gently; no developmental expectations tied to the user's child data.
