# Maxii / LUMI

Jeden npm monorepozitář se třemi samostatnými projekty:

| Projekt | Účel | npm balíček |
| --- | --- | --- |
| `packages/lumi-forest` | Publikovatelný framework: vektorové scény, postavy, UI, témata a animace | `@lumi/forest-design` |
| `apps/lumi-showcase` | Vývojová galerie, Storybook, Scene/Character/UI/Performance/Motion Lab a Maestro scénáře | `@lumi/showcase` (privátní) |
| `apps/baby-tracker` | Aplikace pro rodiče využívající veřejné API frameworku | `@maxii/baby-tracker` (privátní) |

Obě aplikace deklarují závislost na `@lumi/forest-design`. npm je propojí s lokálním workspace; framework neimportuje aplikace a Baby Tracker neimportuje galerii ani Storybook. Metro používá automatickou podporu Expo pro monorepozitáře bez ručních aliasů na zdrojové soubory. TypeScript v aplikacích používá podmínku `react-native`, takže kontroluje stejné zdrojové vstupy jako Metro.

Kořenové `overrides` sjednocuje Worklets na verzi `0.13.0`, kterou vyžaduje Expo SDK 58. Test lockfilu hlídá jedinou instalaci Reactu a sdílených nativních modulů napříč workspace projekty.

## Vývoj

Node.js >= 22.13. Všechny následující příkazy spouštěj z kořene repozitáře:

```sh
npm ci
npm run baby:start       # aplikace pro rodiče (také npm start)
npm run baby:web         # aplikace pro rodiče v prohlížeči
npm run showcase:start   # všechny vývojové laby včetně Motion Labu
npm run showcase:web     # vývojová galerie v prohlížeči
npm run storybook        # samostatný Storybook vstup galerie
npm run storybook:web    # stejný katalog komponent v prohlížeči
```

Instalace a společný `package-lock.json` patří do kořene. Při změně závislostí použij `npm install` a commitni i upravený lockfile; běžné instalace a CI používají `npm ci`. Nepřidávej lockfily do jednotlivých workspace adresářů.

Baby Tracker má vlastní Expo konfiguraci, vstupní bod a úvodní obrazovku postavenou na LUMI. Je to základ pro produktový vývoj; ukládání záznamů, uživatelské účty, synchronizace ani hotové sledování krmení a spánku zatím implementované nejsou. Obě aplikace mají oddělené native identifikátory; hodnoty `com.example.*` před distribucí nahraď identifikátory vlastněné organizace.

## Ověření a build

```sh
npm run build           # pouze distribuovatelný framework, včetně deklarací
npm run typecheck       # framework a obě aplikace
npm test                # framework + hranice projektů + katalog Storybooku
npm run check:tsx       # kontrola syntaxe React Native zdrojů a obou aplikací
npm run check:boundaries
npm run check:secrets
npm run check:lockfile
npm run lint:baby
npm run test:all        # navíc API kontrakt, Python parser a obrazové regrese
npm run sbom            # lokální CycloneDX inventář do reports/ (ignorováno Gitem)
npm run expo:doctor
npm run baby:doctor
```

Rychlá PR sada CI spouští typecheck/testy/hranice/secrety. Dlouhé Metro exporty a Playwright web E2E jsou v workflow `device-quality` ( bundlování ≠ běh nativního klienta ).

```sh
npm run expo:bundle:android
npm run expo:bundle:ios
npm run expo:bundle:web
npm run expo:storybook:bundle:android
npm run expo:storybook:bundle:web
npm run baby:bundle:android
npm run baby:bundle:ios
npm run baby:bundle:web
```

Obrazové regrese vyžadují Python a `python3 -m pip install -r packages/lumi-forest/tools/requirements-visual.txt`. Referenční snímky patří do Gitu, exporty, náhledy, zachycené snímky a lokální reporty se ignorují. Maestro scénáře pro galerii jsou v `apps/lumi-showcase/.maestro`.

Jednotlivé projekty lze ovládat i přes npm workspace:

```sh
npm run test --workspace @lumi/forest-design
npm run android --workspace @lumi/showcase
npm run ios --workspace @maxii/baby-tracker
npm pack --workspace @lumi/forest-design --dry-run --ignore-scripts
```

## CI a publikování

GitHub Actions jsou v kořenovém `.github/workflows`. CI kontroluje všechny tři projekty. Release a npm publikace cílí výhradně na `@lumi/forest-design`; aplikace mají `private: true`. Publikování zůstává ruční a podmíněné schválením, licencí, lockfilem a fyzickým měřením na Androidu i iOS. Viz [framework](packages/lumi-forest/README.md) a [požadavky na důkazy z fyzických zařízení](packages/lumi-forest/release-evidence/README.md).

Tasky, produktové návrhy a podpůrné Markdown dokumenty zůstávají pouze lokálně a jsou ignorované Gitem. Verzují se standardní projektové `README.md` a changelogy; kořenový adresář `docs/` je celý lokální. Podpůrné dokumenty nejsou součástí distribuovaného npm balíčku.

Výsledek automatických kontrol se vztahuje ke konkrétnímu commitu a buildu; aktuální stav určují výstupy testů a CI. Kontroly zdrojů, obrazových referencí a JS bundlů nenahrazují ověření fyzických zařízení, podepsaných native buildů a vydání do obchodů. Tyto distribuční a device podmínky zůstávají samostatnou branou vydání.

Konfigurace navazuje na oficiální dokumentaci [Expo monorepozitářů](https://docs.expo.dev/guides/monorepos/), [npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/) a [odděleného vstupu React Native Storybooku](https://storybookjs.github.io/react-native/docs/intro/getting-started/).
