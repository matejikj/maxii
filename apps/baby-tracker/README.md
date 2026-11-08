# LUMI Baby Tracker

Samostatná Expo aplikace pro rodiče. Framework používá jako závislost `@lumi/forest-design` a importuje pouze jeho veřejné vstupy. Neobsahuje Storybook, ukázkové laby ani závislost na `apps/lumi-showcase`.

## Struktura

```text
src/
  app/             # composition root, providers, veřejná konfigurace
  domain/          # čistá pravidla a porty (bez React/Expo)
  application/     # aplikační služby a porty
  features/today/  # úvodní Today shell
  infrastructure/  # DB/crypto/telemetry/time/ids
  shared/          # skutečně sdílené pomocné funkce
tests/
  domain/ storage/ component/ e2e/
```

Obsahové balíky přibudou později; do produkčního bundle se nedostanou testovací fixture ani Storybook.

## Lokální příkazy (z kořene monorepa)

```sh
npm ci
npm run baby:start
npm run baby:web
npm run baby:test          # domain + storage + component
npm run lint:baby
npm run check:boundaries
npm run check:secrets
npm run check:lockfile
npm run baby:doctor
npm run baby:bundle:web    # Metro export only — not a running client
```

Oddělené sady v `apps/baby-tracker`:

```sh
npm run test:domain --workspace @maxii/baby-tracker
npm run test:storage --workspace @maxii/baby-tracker
npm run test:components --workspace @maxii/baby-tracker
npm run export:web --workspace @maxii/baby-tracker && npm run test:e2e --workspace @maxii/baby-tracker
npm run test:e2e:native --workspace @maxii/baby-tracker   # Maestro na development buildu
```

## Prostředí

Zkopíruj `.env.example` podle potřeby. Povolené jsou jen `EXPO_PUBLIC_*` hodnoty. Service secrets, podpisové materiály a recovery hesla do klienta nepatří.

Rozlišení:

| Režim | Význam |
| --- | --- |
| development | Metro / development build, volitelná storage sonda |
| staging | Připravováno pro pozdější rodinnou službu; osobní app ji nevyžaduje |
| production | Release-like klient bez testovacích fixture a Storybooku |

## Nativní nástroje

- Node.js >= 22.13
- Pro SQLCipher development build: Android SDK / Xcode, `npm run baby:prebuild`
- Maestro (volitelně) pro `.maestro/smoke.yaml`
- Playwright Chromium pro web E2E proti `dist-web`

## Úložiště

Nativní osobní deník používá SQLCipher (`useSQLCipher`), SecureStore klíč a verzované migrace přes `openPrivateDatabase` / `createNativeUnitOfWorkFactory`.

Webový deník je IndexedDB/Dexie (`openWebDatabase` / `createWebUnitOfWorkFactory`) se stejným UnitOfWork kontraktem, oddělenou lock DB pro záložky a bez tvrzení o hardwarovém trezoru nebo jisté perzistenci po vymazání prohlížeče. Aplikační cache nesmí sdílet jméno s deníkem (`lumi-web-app-cache` vs `lumi-web-diary`). Citlivá data nepatří do `localStorage` ani URL.

Zápisy jdou přes `createCommandDispatcher`: entita, revize a receipt v jedné UnitOfWork, idempotentní retry, měkké smazání se sedmidenním košem a desetisekundovým Zpět. Koncepty se odkládají lokálně (`createDraftAutosave`) a do souhrnů nevstupují.

Osobní start založí jeden místní profil „Miminko“ bez účtu a API. Navigace má záložky Dnes / Péče / Rozvoj / Historie; profil je v hlavičce. Chybějící backend není chybový stav.

Produktové UI skládá veřejné Lumi komponenty (`features/ui`): přímé akce vs „Uložit“, poznámka se systémovou klávesnicí, undo feedback a aktivní měření bez sekundového hlášení čtečce. Kanonické texty jsou v `productCopy.ts`.

Dnes propojuje `wirePersonalCommands` s plenkovým panelem (tři přímé zápisy + podrobný formulář), poslední péčí z deníku a čtyřmi upravitelnými rychlými akcemi. Historie čte stejný denní výřez; otevření panelu nic nezapisuje.

Spánek: `startSleepSession` / `endSleepSession` ukládají relaci před úspěchem UI; konec drží zamýšlený čas při retry. Na Dnes je rozvinuté měření, na ostatních záložkách kompaktní pruh. Péče nabízí minulý interval a zápis bez délky.

Android má `allowBackup: false`. Ztracený vault klíč nad existující DB se nikdy tiše nepřegeneruje.

Sonda development buildu:

```sh
EXPO_PUBLIC_LUMI_STORAGE_PROBE=1
npm run run:android:cipher --workspace @maxii/baby-tracker
```

Expo Go SQLCipher neobsahuje.

Před vydáním nahraď `com.example.lumibabytracker` vlastním identifikátorem.
