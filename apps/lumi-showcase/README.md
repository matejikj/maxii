# LUMI Showcase

Samostatná vývojová aplikace pro framework `@lumi/forest-design`. Obsahuje původní Expo galerii, Scene Lab, Character Lab, Design System Lab, Performance Lab, Motion Lab a Storybook. Ukázková data a experimenty patří sem.

Z kořene repozitáře:

```sh
npm run showcase:start
npm run showcase:web     # galerie v prohlížeči
npm run storybook
npm run storybook:web    # Storybook v prohlížeči
npm run expo:bundle:android
npm run expo:bundle:ios
npm run expo:bundle:web
npm run expo:storybook:bundle:android
npm run expo:storybook:bundle:web
maestro test apps/lumi-showcase/.maestro/motion.yaml
```

Vlastní `index.ts` registruje běžnou galerii. Storybook wrapper v Metro přepíná vstup na `.rnstorybook/index.tsx` při `STORYBOOK_ENABLED=true`. Generovaný `.rnstorybook/storybook.requires.ts` se necommituje; jeho `.d.ts` deklarace zůstává ve zdrojích.

Oba vstupy používají Expo `registerRootComponent`, které zajišťuje také webové spuštění. Po instalaci nových závislostí nebo změně exportů frameworku zastav starý Metro server a spusť jej znovu s `--clear`, například `npm run web --workspace @lumi/showcase -- --clear`.

Původní identifikátor `com.example.lumiforestlab` zůstává zachován pro stávající Maestro scénáře. Aplikace pro rodiče má jiný identifikátor i vlastní vstupní bod v `apps/baby-tracker`.
