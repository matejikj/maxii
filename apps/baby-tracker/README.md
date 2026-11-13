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

| Režim       | Význam                                                              |
| ----------- | ------------------------------------------------------------------- |
| development | Metro / development build, volitelná storage sonda                  |
| staging     | Připravováno pro pozdější rodinnou službu; osobní app ji nevyžaduje |
| production  | Release-like klient bez testovacích fixture a Storybooku            |

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

Spodní navigace používá plovoucí skleněnou kapsli s ikonami Lumi, jemným odleskem a plným zvýrazněním aktivní položky v barvě vybraného motivu. `expo-blur` vzorkuje samostatný `BlurTargetView` právě otevřené záložky; navigace není součástí svého vlastního zdroje rozmazání. Android 12+ používá nativní blur, starší Android zůstává u tónovaného povrchu. Omezení průhlednosti vypne blur a omezení pohybu vypne animaci aktivní kapsle. Stávající tab press, long press, webové odkazy i čtečky zachovává `PlatformPressable` z React Navigation. Velikost a odsazení navigace i spodní prostor všech pěti posuvných pohledů sdílí `forestDockMetrics`; poslední akce se dá vysunout nad kapsli i při velkém písmu. Klávesnice navigaci schová. Po přidání nativního modulu je potřeba nový vývojový build (`npm run android --workspace @maxii/baby-tracker`, případně odpovídající iOS build).

Dnes propojuje `wirePersonalCommands` s plenkovým panelem (tři přímé zápisy + podrobný formulář), poslední péčí z deníku a čtyřmi upravitelnými rychlými akcemi. Historie čte stejný denní výřez; otevření panelu nic nezapisuje.

Úvod Dnes používá světlou lesní mýtinu, zvolenou postavičku a české datum z deníkového pásma. Barevné akční karty zachovávají původní příkazy, pořadí i zachycení dítěte při otevření formuláře. Běžící měření má vlastní čitelný panel; opětovné klepnutí na běžící spánek přejde k existujícímu měření. Poslední zápis vybírá ikonu podle typu události. Dnes a Péče sdílejí botanické materiály i dekorativní krajinu; větší systémové písmo převádí akce do jednoho sloupce a uvolňuje ilustraci pro text.

Spánek: `startSleepSession` / `endSleepSession` ukládají relaci před úspěchem UI; konec drží zamýšlený čas při retry. Na Dnes je rozvinuté měření, na ostatních záložkách kompaktní pruh. Péče nabízí minulý interval a zápis bez délky.

Péče používá botanické ikony Lumi Forest, lesní úvod se zvolenou postavičkou a šest karet denního nebo sedmidenního přehledu. Vizuální hodnoty odvozuje `presentCareOverview` ze stejných projekcí jako popisné souhrny: prázdný den ukazuje „—“, neznámá délka nebo množství zůstávají výslovně neznámé a skutečně zapsaná nula zůstává nulou. Plné popisy jsou zachované pro čtečky. Karty při větším systémovém písmu přecházejí do jednoho sloupce; všechny části respektují světlý a tmavý motiv.

Rozvoj odděluje „Pro vás“ (sdílený denní tip a týdenní ohlédnutí), „Aktivity“ (knihovna a oblíbené) a „Společně“ (rodinné projekty). Připnutá navigace zůstává dostupná při procházení. Hledání v názvech a pomůckách funguje bez diakritiky; kombinuje se s oblastí, oblíbenými a situačními filtry. Výsledky se zobrazují po dvanácti s přesným počtem. Karty ukazují skutečnou délku a věkové rozmezí; knihovna nepředstírá, že jsou všechny aktivity doporučené konkrétnímu dítěti. Detail zachovává podmínky i potvrzování připravenosti, čísluje kroky a vrací uživatele do jeho rozpracovaného hledání i systémovým tlačítkem Zpět. Projekty se načítají až při otevření sekce a při přepnutí zůstávají připojené, aby nezmizel rozepsaný nápad. Celý Rozvoj používá zvolený motiv, tmavý režim a systémové zvětšení písma; běžící měření má vlastní odsazení pod stavovým řádkem.

Historie má samostatné sekce Záznamy, Koncepty a Koš, připnutou navigaci a krajinu z aktuálního motivu. Časová osa seskupuje skutečné události podle místního dne a času péče, nikoli podle pozdějšího uložení. Karty mají významové ikony, čitelné časy a náhled poznámky; interval přes půlnoc výslovně uvádí datum konce. Datum v českém nebo ISO formátu se nejprve ověří a až po potvrzení použije jako filtr. Hledání zůstává místní, reaguje s krátkou prodlevou a starší dotaz nemůže přepsat novější výsledky. Filtrované stránky procházejí i dlouhé úseky jiných druhů péče; hledání v konkrétním dni pokračuje za první dávku indexu. Počet popisuje načtené záznamy. Koncepty mají čitelný náhled uložených polí a původního času; koš patří vybranému dítěti a ukazuje přesnou lhůtu pro obnovení. Detail lze posouvat i při velkém písmu, nabízí zrušení úprav a rozlišuje uložení od smazání; zápisy jsou chráněné proti opakovanému klepnutí během ukládání.

Profil → Vybrat téma nabízí Forest, Garden a Dětské hřiště s náhledy ze stejného vektorového kompilátoru jako aplikace. Výběr se automaticky ukládá do lokální metadata preference `pref_app_motif_v1` a obnovuje po restartu. Starší nebo neznámá hodnota použije výchozí Forest. `ThemePreferenceBridge` mění barvy celé aplikace i prostředí Dnes/Péče bez nového klíče navigace nebo přerušení formuláře. Motiv je nezávislý na zvoleném zvířátku, vzhledu průvodce a pohybu; změna nic nestahuje a nemění deníkové záznamy.

Android má `allowBackup: false`. Ztracený vault klíč nad existující DB se nikdy tiše nepřegeneruje.

Sonda development buildu:

```sh
EXPO_PUBLIC_LUMI_STORAGE_PROBE=1
npm run run:android:cipher --workspace @maxii/baby-tracker
```

Expo Go SQLCipher neobsahuje.

Identifikátor aplikace pro iOS i Android je `com.matejikj`. Vygenerované nativní projekty musí převzít aktuální Expo konfiguraci před dalším buildem. Instalace dřívější vývojové aplikace pod jiným ID má samostatná data; před jejím odstraněním použij přenosnou zálohu a ověř obnovu.

Osobní release kontroly bez obchodního účtu:

```sh
EXPO_PUBLIC_LUMI_ENV=production EXPO_PUBLIC_LUMI_STORAGE_PROBE=0 npm run release:gate --workspace @maxii/baby-tracker
npm run release:android --workspace @maxii/baby-tracker
npm run release:android:care-smoke --workspace @maxii/baby-tracker
npm run release:android:care-matrix --workspace @maxii/baby-tracker
```

`release:gate` ověří studenou rodinnou hranici, absenci tajemství v `EXPO_PUBLIC_*`, nativní ID, APK verzi/oprávnění a hash. Care smoke uloží plenku; care matrix v režimu letadlo projde plenku, lahvičku, poznámku, růst, Rozvoj a Historii po restartu.
