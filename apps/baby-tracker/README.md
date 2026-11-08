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
npm run baby:test
```

`App.tsx` zajišťuje safe areas a LUMI téma podle nastavení systému. `src/screens/HomeScreen.tsx` je úvodní obrazovka bez fiktivních dat. Aplikační obrazovky, doménový model a perzistence patří do tohoto projektu; sdílené vektorové prvky, animace a UI komponenty do frameworku.

Webové závislosti jsou deklarované přímo v tomto workspace. Metro pro web načítá zdroje frameworku přes jeho `browser` export; před spuštěním aplikace proto není potřeba sestavit `lib/`.

## Místní úložiště a ověřovací sondy

Produktová databáze ještě není hotová. V `src/infrastructure` jsou ověřené základy:

- `expo-sqlite` se `useSQLCipher: true` a odmítnutím otevření soukromých záznamů bez `PRAGMA cipher_version`
- `expo-secure-store` pro náhodný klíč databáze (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`)
- přenosný recovery obal Argon2id + XChaCha20-Poly1305 (`@noble/ciphers`, `@noble/hashes`)
- IndexedDB adaptér přes Dexie pro web
- kompatibilita React Navigation, Zod, Luxon a in-memory TanStack Query

Development build s aktivní sondou:

```sh
npm run baby:prebuild
cd apps/baby-tracker
EXPO_PUBLIC_LUMI_STORAGE_PROBE=1 npx expo run:android
# nebo: EXPO_PUBLIC_LUMI_STORAGE_PROBE=1 npx expo run:ios
```

V logu hledej `LUMI_STORAGE_PROBE_OK` / `LUMI_STORAGE_PROBE_FAIL`. Expo Go SQLCipher neobsahuje a pro soukromé záznamy se nesmí používat.

Tento krok vytváří základ aplikace, nikoli hotový tracker. Ukládání událostí, účty a synchronizace zatím nejsou implementované. Před vydáním nahraď `com.example.lumibabytracker` vlastním native identifikátorem a nastav podpisy a distribuční konfiguraci.
