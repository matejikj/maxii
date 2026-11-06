# Roadmap: tři engines bez přepsání současného systému

## Fáze A — Character Engine (v0.3) — IMPLEMENTOVÁNO (CORE + SHOWCASE)

Původní geometrie je beze změny rozložena do 93 pojmenovaných anatomických dílů a reprezentována jako `CharacterBlueprintV2` s typovanými rolemi (ears/head/body/face/paws/tail/seed/accessories), výrazy a pózami. `compileCharacter(blueprint, options) -> VectorNode` zachová výstup kompatibilní s rendererem. V1 anatomie nemusí umět automatické generování libovolných zvířat; schválená gramatika je důležitější než neomezená náhodnost.

Acceptance: 5 zvířátek, 4 výrazy, 2 hlavní pózy (+ sleeping), 40 charakterových PNG snapshotů, 5 původních SVG hashů beze změny. **Pure-core kontrola splněna.** Expo native QA a fyzická měření zatím čekají.

## Fáze B — Procedural Scene Engine (v0.4)

Oddělit layout pravidla (`SafeZones`, horizon constraints), sky props, foliage grammar, density profiles, a generování decorations. `composeScene()` orchestrace zůstává, ale místo pevně daných kopců volá `compileLandscape()` a `placeObjects()` s deterministickou validací kolizí. Místo absolutní 390×844 kompozice přidat `SceneViewport`, breakpoints a constraint solving pro portrait/tablet.

Acceptance criteria: 3 poměry stran, zadekorovaná oblast mimo text a navigaci, výstup stabilní pro stejný seed/verzi algoritmu, bounded runtime a bez překryvů postav.

## Fáze C — LUMI UI Design System (v0.5)

Rozšířit `LumiThemeProvider` o light/dark a sémantické tokeny. Přidat Button, Text, Input, ListRow, ChartContainer, EmptyState, Timeline, BottomSheet wrapper; používají jednotný spacing/radius/typografii. Při tvorbě zdravotních komponent držet význam hodnot mimo ilustrace. Samostatný katalog komponent (Storybook), interakční/kontrastní a accessibility testy.

Acceptance criteria: audit kontrastu, VoiceOver/TalkBack, dynamické fonty, testy minimálních tap targetů, RTL/lokalizace a dark theme.

## Další samostatná fáze — Animace a backendy

Pohyb řešit až nad ověřeným generátorem pozic: respektovat Reduce Motion, oddělit animation clock od SCENE compileru. Vysokofrekvenční `shared values` jen ve vrstvě rendereru. Případné Skia/Canvas backendy nesmějí vytvářet druhý autorský zdroj ilustrací.

## v0.2.1 integration foundation update (2026-11-06)

Introduced Expo SDK58 showcase, typed `CharacterBlueprint` with explicit authored variants and named anatomy parts, pure `compileCharacter`, adaptive display-mode policy, 47 pure tests, 30 off-device image baselines, Maestro screenshot capture, Android profiling scripts, performance budgets, and GitHub Actions checks. Native device execution, full React Native typecheck and Metro bundling remain to run in a networked mobile development environment. Next: lockfile and first actual device profiling, then Character Engine v0.3 anatomy grammar.

## v0.3.0 stav (2026-11-06)

Postavy mají každá 4 výrazy × 2 pózy, 4 typy doplňků a omezené proporce. Zavedena jednotná anatomie a cache, `LumiCharacter` komponenta, Expo Character Lab, 40 nových pixel snapshots a samostatné SVG exporty. Fáze B (Procedural Scene Engine v0.4) zatím nezačala; nativní Expo QA není dokončená.

## v0.4.0 — Procedural Scene Engine (2026-11-06)

Core procedural generator shipped as **opt-in** `planProceduralScene()`/`composeProceduralScene()`; background is directly composited in DP viewport coordinates with deterministic terrain, sky motifs, plants/objects, and collision-aware character placement. User-interface safe zones are clipped and always enforced, even when the zones overlap. New Expo `SceneLab`, 30 offline goldens, 6 form-factor fixtures and Node microbenchmark. No changes to the five legacy vector scenes. Physical React Native release-build FPS and screenshots remain a separate acceptance gate.
