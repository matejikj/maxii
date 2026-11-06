# LUMI Showcase

Samostatná vývojová aplikace pro framework `@lumi/forest-design`. Obsahuje původní Expo galerii, Scene Lab, Character Lab, Design System Lab, Performance Lab, Motion Lab a Storybook. Ukázková data a experimenty patří sem.

Z kořene repozitáře:

```sh
npm run showcase:start
npm run storybook
npm run expo:bundle:android
npm run expo:bundle:ios
npm run expo:storybook:bundle:android
maestro test apps/lumi-showcase/.maestro/motion.yaml
```

Vlastní `index.ts` registruje běžnou galerii. Storybook wrapper v Metro přepíná vstup na `.rnstorybook/index.tsx` při `STORYBOOK_ENABLED=true`. Generovaný `.rnstorybook/storybook.requires.ts` se necommituje; jeho `.d.ts` deklarace zůstává ve zdrojích.

Původní identifikátor `com.example.lumiforestlab` zůstává zachován pro stávající Maestro scénáře. Aplikace pro rodiče má jiný identifikátor i vlastní vstupní bod v `apps/baby-tracker`.
