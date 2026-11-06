# LUMI Forest — Vector Design Framework v0.1

Autorský vizuální systém pro mobilní aplikaci (React Native / Expo) pro zaznamenávání dětského vývoje. Součástí jsou skutečná SVG pozadí, ukázkové obrazovky a generátor (`LumiBackground.tsx`) produkující SVG dynamicky bez externí grafické služby.

## Návrhový princip

**Jedna rodina ilustrací, více scén.** Zvířátka jsou vytvořena ze společné gramatiky siluet a obličejů, nikoliv jako izolované assety. Mají objemné oblé tělo a hlavu, mini tlapky, malé oči, tlumené tvářičky, středový symbol semínka, jemnou asymetrii. Rozdíly určuje profil uší/ocasu, tvar hlavy a barvy. Bez obrysové černé linky po celém těle, bez fotorealismu, bez 3D shaderů.

**Jednotný svět:** třístupňové organické horizonty, plošné křivky, větvičky, minimální jiskřičky, velká tichá plocha pro data. Decentní emoční doprovod, ne interaktivní rozptylování.

**Rozdělení vrstev:**

1. `Canvas`: tón pozadí (100 % viewportu).
2. `Landscape`: vrstvy kopců v dolních 35 %.
3. `Character`: 1 hlavní zvířátko, vpravo dole, sedící na vrstvě krajiny.
4. `Microdetails`: malé hvězdy, sprigy/semínka, vždy se deterministicky generují ze seedu.
5. `Content`: neprůhledné / téměř neprůhledné bílé UI karty a text, vykreslené **nad** SVG, v React Native.

## Barevné motivy

| Scéna | Zvíře | Pozadí | Terén | Akcent | Význam |
|---|---|---|---|---|---|
| `home` | králíček Lumi | `#FAF7F1` | `#DDE9DB` | `#92B3A1` | každodenní přehled |
| `growth` | medvídek Momo | `#FCF9F2` | `#DCE8D8` | `#91AF8F` | výška, váha, obvody |
| `sleep` | lištička Nori | `#F7F5FB` | `#E0DFF1` | `#A29AC6` | spánek a režim |
| `feeding` | vydra Kiko | `#FAF8F1` | `#E8E6D8` | `#C5A78A` | kojení, UM, příkrmy |
| `milestones` | ježek Piko | `#FDF8F4` | `#F0DCCF` | `#CEA89A` | milníky a vzpomínky |

**Důležitá poznámka:** barevné ilustrativní akcenty se **nesmí** používat jako běžný malý text na světlém podkladu, protože nemají dostatečný kontrast. Pro text je součástí `LUMI_PALETTES` odlišný `accentText`, běžný text má barvu `ink`.

## Instalace

### Expo

```bash
npx expo install react-native-svg
```

### Bare React Native

```bash
npm install react-native-svg
cd ios && pod install
```

Zkopíruj adresář `src/` do svého projektu, např. `src/design/lumi/`.

```tsx
import { LumiBackground, LumiCard } from './design/lumi';

export function GrowthScreen() {
  return (
    <View style={{flex:1}}>
      <LumiBackground scene="growth" seed="stable-local-key" density="quiet" />
      <ScrollView contentContainerStyle={{padding:24, paddingTop:64}}>
        <LumiCard>
          <Text>Poslední měření</Text>
          <Text>7,8 kg</Text>
        </LumiCard>
      </ScrollView>
    </View>
  );
}
```

V příkladu importuj také `View`, `ScrollView`, `Text` z `react-native`. Hodnoty v demonstračních obrazovkách jsou pouze ilustrační, nikoliv skutečné zdravotní údaje.

### API

```tsx
<LumiBackground
  scene="sleep"
  seed="local-child-seed-123"  // stabilní lokální seed, ne jméno / datum narození
  animal="fox"               // volitelné přepsání postavičky
  density="quiet"            // 'quiet' | 'regular' | 'playful'
/>
```

`createLumiSvg({scene,seed,density})` vrátí přímo SVG XML řetězec. Pro statické exporty a Figma je připraveno 5 souborů v `assets/`. Pro prezentační a marketingové použití je 5 hotových mockupů v `previews/`.

## Kompoziční pravidla (design contract)

- **Základní plátno:** `390 × 844` s `viewBox`, SVG se škáluje na viewport. V produkci ověřit různé poměry stran a dostatek místa pro spodní navigaci.
- **Safe area dat:** horních přibližně 60 % vizuálně tichých. Kartám dopřát plné neprůhledné nebo min. 93% bílé pozadí.
- **Pozice postavy:** vpravo dole, v zóně, kterou lze částečně překrýt spodní navigací. Nikdy nezasahuje do číselných hodnot nebo ovládacích prvků.
- **Jeden hlavní charakter na scénu.** Více zvířátek pouze v titulních nebo slavnostních scénách.
- **Mikrodetaily:** max. 5/13/21 podle hustoty, deterministicky seedované. Žádný `Math.random()` při rerenderu.
- **Písmo:** zaoblený kvalitní sans (např. Nunito Sans), systémový fallback; typografie je součástí skutečného UI, nikoliv zahrnutá do SVG pozadí.
- **Karty:** 26px radius, 20px padding, vysoká čitelnost, minimální shadow.
- **Animace:** přípustné jednorázové animace postavy (mrknutí / pohyb uší) a záznamu milníku; nikdy plošný neustálý pohyb celé scény. Respect reduced motion.
- **Personalizace:** neměnit zásadní anatomii podle data narození; kombinovat barvy, dekorace, prostředí a drobné doplňky přes stabilní seed.
- **Konzistence:** novou postavu schvaluj až po kontrole siluety, očiček, proporcí, obou tváří, badge semínka, základních barev a přístupnosti.

## Struktura

```text
lumi-forest/
├── README.md
├── DESIGN_TOKENS.md
├── src/
│   ├── LumiBackground.tsx  # hlavní runtime generátor a renderer
│   ├── LumiCard.tsx        # čitelná obsahová karta
│   ├── DemoScreen.tsx      # ukázka integrace
│   ├── tokens.ts           # semantic design tokens
│   └── index.ts
├── assets/                  # 5 čistých vektorových SVG pozadí
├── previews/                # 5 SVG mockupů + PNG a přehled
├── build_previews.py        # generování exportovatelných SVG a PNG
└── gen_ts.py               # generace TypeScript textových vektorů ze stejných zvířat
```

## Produkční doporučení

Pro aplikaci, která pracuje s údaji o dítěti: soustředit se na lokální šifrované ukládání dat, rodičovské oprávnění, důslednou ochranu fotek a export/smazání dat. Zvířátka jsou pouze vizuální doprovod; nikdy podle metrik nevytvářet zavádějící zdravotní soudy. Následnou verzi doplnit testy layoutu na menších telefonech, dark mode, lokalizace a snapshot testy SVG.

**Původ ilustrací:** tvarové definice v tomto prototypu byly vytvořeny pro tento design, nejsou převzatými stock zvířátky. Název LUMI je pracovní — před komerčním použitím ověřit dostupnost značky.
