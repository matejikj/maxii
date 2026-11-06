# Migrace LUMI 0.1 → 0.2

## Zachováno

- Stávající scény: `home`, `growth`, `sleep`, `feeding`, `milestones`.
- Identifikátory zvířátek a hustoty (`quiet`, `regular`, `playful`).
- API `LumiBackground`, `createLumiSvg`, `LUMI_PALETTES`, `lumi`, `LumiCard`.
- Originální výtvarná geometrie všech pěti zvířátek (převedená z XML do typovaných node dat).

## Změny

- `LumiBackground` již **nepoužívá SvgXml**. Kompiluje dokument a renderuje nativní SVG elementy.
- Pure core a RN adaptér jsou odděleny. `createLumiSvg()` slouží pouze k exportu / testům.
- Generování dekorací je deterministické s přesnými počty; umístění teček se proto vůči 0.1 může změnit.
- `LumiCard` nyní využívá `LumiThemeProvider` (mimo provider fallback home).
- `LumiBackground` získal `mode="cover" | "contain"`.
- `DemoScreen` je v `examples/`, starý import `src/DemoScreen.tsx` je pouze deprecovaný shim.
- SVG v `assets/` jsou původní statické soubory 0.1 pro porovnání; **nové exporty** vznikají v `exports/` a jsou řízené výhradně `SceneDocument`.

## Doporučený upgrade

1. Proveď zálohu starého `src/design/lumi`.
2. Nahraď celý jeho `src/` novým `src/`, aby neexistovaly paralelní kopie stejného katalogu.
3. Nech původní volání `<LumiBackground scene="..." />` – props zůstávají kompatibilní.
4. Ověř změny dekorací a layoutu. `seed` nemusí dát pixelově identický obraz kvůli novému generátoru.
5. `npx expo install react-native-svg` a `npx expo-doctor@latest` v cílovém projektu.
6. Spusť `npm run typecheck`, Metro, release build a srovnání screenshotů.

Starý exporter mohl být používán jako runtime generátor. To již není doporučené; nativní UI přepni na `LumiBackground` / `LumiVectorDocument`.

## v0.2.0 → v0.2.1

No breaking change to `composeScene`, `SceneDocument`, or existing scene SVG output. New exports: `CHARACTER_BLUEPRINTS`, `compileCharacter`, character contracts, `resolveAspectMode`, `computeViewportLayout`, viewport fixtures, performance budgets, node count helper. `CHARACTER_CATALOG` remains available as a compatibility facade. `LumiVectorDocument` adds `mode="auto"` for measured-container responsive display; default is still `cover`. New Expo showcase under `apps/expo-showcase/`; `npm install` from repository root resolves its local `file:../..` framework dependency.

## v0.2.1 → v0.3.0 (Character Engine)

- **No change to default scenes**. `composeScene({ scene: 'home' })`, `createLumiSvg()` and `LumiBackground` without new props preserve original SVG golden hashes.
- The built-in `CHARACTER_BLUEPRINTS` upgrade to `schemaVersion: 2` and named anatomy; custom v1 schemas remain accepted by `compileCharacter()`.
- New optional `pose`, `expression`, `accessories`, `proportions` options on scene and standalone `LumiCharacter` APIs.
- `CHARACTER_ARTWORK` and `CHARACTER_CATALOG` remain available as derived compatibility facades. Do not inspect `blueprint.base.kind === 'legacy'` for built-in animals anymore; use `CHARACTER_CATALOG[species].anatomy` for their original vectors.
- **Important:** `pose: 'default'` maps to sitting for v2. V1 keeps the original explicit variant behavior.
- New visual baseline gate: `npm run test:characters:visual`. Review 40-character matrix before accepting intentional changes.
- Release integration and physical-device QA requirements from v0.2.1 are still outstanding until executed on actual hardware.
