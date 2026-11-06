# LUMI Baby Tracker

Samostatná Expo aplikace pro rodiče. Framework používá jako závislost `@lumi/forest-design` a importuje pouze jeho veřejné vstupy. Neobsahuje Storybook, ukázkové laby ani závislost na `apps/lumi-showcase`.

Z kořene repozitáře:

```sh
npm run baby:start
npm run baby:android
npm run baby:ios
npm run baby:web
npm run baby:doctor
npm run baby:bundle:android
npm run baby:bundle:ios
npm run baby:bundle:web
```

`App.tsx` zajišťuje safe areas a LUMI téma podle nastavení systému. `src/screens/HomeScreen.tsx` je úvodní obrazovka bez fiktivních dat. Aplikační obrazovky, doménový model a perzistence patří do tohoto projektu; sdílené vektorové prvky, animace a UI komponenty do frameworku.

Webové závislosti jsou deklarované přímo v tomto workspace. Metro pro web načítá zdroje frameworku přes jeho `browser` export; před spuštěním aplikace proto není potřeba sestavit `lib/`.

Tento krok vytváří základ aplikace, nikoli hotový tracker. Ukládání událostí, účty a synchronizace zatím nejsou implementované. Před vydáním nahraď `com.example.lumibabytracker` vlastním native identifikátorem a nastav podpisy a distribuční konfiguraci.
