/** Original draft-r1 payloads retained for historical lookup. Do not regenerate or edit. */
import type { ActivityRevision } from '../model/types';

export const FIRST_YEAR_ARCHIVED_CONTENT_VERSION = 'first-year-drafts.v1' as const;

export const FIRST_YEAR_ARCHIVED_REVISIONS = [
  {
    activityId: 'face-hello',
    revisionId: 'face-hello.draft-r1',
    language: 'cs',
    title: 'Pozdrav tváří v tvář',
    ageMonths: {
      fromInclusive: 0,
      toInclusive: 11,
    },
    readinessNotes: 'Pohled není povinnost; při odvrácení dejte pauzu.',
    environments: ['quiet'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Pohodlná bezpečná poloha s potřebnou oporou, bez pomůcek.',
      'Pohled není povinnost; při odvrácení dejte pauzu.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: [
      'Nabídněte svůj obličej v pohodlné blízkosti',
      'Usmějte se a pozdravte',
      'Počkejte na reakci',
    ],
    conversationPrompt: '„Ahoj, jsem tady.“',
    primaryArea: 'relationship',
    relatedAreas: [],
    topicIds: ['rel.eye-contact'],
    sources: [
      {
        label: 'CDC — Milestones by 2 Months, Tips and activities',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.cdc.gov/act-early/milestones/2-months.html',
        supportsPrinciple:
          'kontakt, odpovídání, blízkost a pozorování signálů dítěte. Milníky nejsou termín úspěšného absolvování.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 0,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
      {
        kind: 'materials_none',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'babble-answer',
    revisionId: 'babble-answer.draft-r1',
    language: 'cs',
    title: 'Odpověď na vlastní zvuk',
    ageMonths: {
      fromInclusive: 0,
      toInclusive: 11,
    },
    readinessNotes: 'Bez pobízení k určité slabice; ticho je v pořádku.',
    environments: ['quiet'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Dítě samo vydá zvuk, nikoli pláč vyžadující péči; bez pomůcek.',
      'Bez pobízení k určité slabice; ticho je v pořádku.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Poslouchejte', 'Jemně zopakujte jeden zvuk', 'Nechte prostor další odpovědi'],
    conversationPrompt: '„Áá, slyším tě.“',
    primaryArea: 'speech',
    relatedAreas: [],
    topicIds: ['speech.babble'],
    sources: [
      {
        label: 'NHS — Help your baby learn to talk',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.nhs.uk/baby/babys-development/play-and-learning/help-your-baby-learn-to-talk/',
        supportsPrinciple:
          'komentování činností, opakování zvuků, krátké věty a pojmenování skutečného zájmu.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 0,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
      {
        kind: 'materials_none',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'care-narration',
    revisionId: 'care-narration.draft-r1',
    language: 'cs',
    title: 'Co právě děláme',
    ageMonths: {
      fromInclusive: 0,
      toInclusive: 11,
    },
    readinessNotes: 'Péče má přednost; nemusíte komentovat nepřetržitě.',
    environments: ['home'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Běžná bezpečná péče, bez dalších pomůcek.',
      'Péče má přednost; nemusíte komentovat nepřetržitě.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Popište právě probíhající úkon', 'Použijte krátkou větu', 'Udělejte pauzu'],
    conversationPrompt: '„Teď oblékáme ponožku.“',
    primaryArea: 'speech',
    relatedAreas: [],
    topicIds: ['speech.naming'],
    sources: [
      {
        label: 'NHS — Help your baby learn to talk',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.nhs.uk/baby/babys-development/play-and-learning/help-your-baby-learn-to-talk/',
        supportsPrinciple:
          'komentování činností, opakování zvuků, krátké věty a pojmenování skutečného zájmu.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 0,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'materials_none',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'comfort-together',
    revisionId: 'comfort-together.draft-r1',
    language: 'cs',
    title: 'Klidný hlas a blízkost',
    ageMonths: {
      fromInclusive: 0,
      toInclusive: 11,
    },
    readinessNotes: 'Netestujte, jak dlouho vydrží bez útěchy; řešte potřebnou péči.',
    environments: ['quiet'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Dítě přijímá držení; bezpečná opora, bez pomůcek.',
      'Netestujte, jak dlouho vydrží bez útěchy; řešte potřebnou péči.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Nabídněte blízkost', 'Mluvte tiše', 'Přizpůsobte se jeho reakci'],
    conversationPrompt: '„Jsem s tebou.“',
    primaryArea: 'relationship',
    relatedAreas: [],
    topicIds: ['rel.comfort'],
    sources: [
      {
        label: 'CDC — Milestones by 2 Months, Tips and activities',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.cdc.gov/act-early/milestones/2-months.html',
        supportsPrinciple:
          'kontakt, odpovídání, blízkost a pozorování signálů dítěte. Milníky nejsou termín úspěšného absolvování.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 0,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
      {
        kind: 'materials_none',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'book-voice',
    revisionId: 'book-voice.draft-r1',
    language: 'cs',
    title: 'Kousek knížky vaším hlasem',
    ageMonths: {
      fromInclusive: 0,
      toInclusive: 11,
    },
    readinessNotes: 'Není třeba číst celý příběh nebo dítě zkoušet.',
    environments: ['quiet'],
    materials: ['Jednoduchá dětská knížka v rukou dospělého'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Jednoduchá dětská knížka v rukou dospělého.',
      'Není třeba číst celý příběh nebo dítě zkoušet.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: [
      'Pohodlně se usaďte s oporou dítěte',
      'Přečtěte nebo popište jednu stránku',
      'Počkejte',
    ],
    conversationPrompt: '„Tady je malý pejsek.“',
    primaryArea: 'speech',
    relatedAreas: [],
    topicIds: ['speech.listening'],
    sources: [
      {
        label: 'AAP / HealthyChildren — How to Share Books With Your Baby',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.healthychildren.org/English/ages-stages/baby/Pages/how-to-share-books-with-your-baby.aspx',
        supportsPrinciple: 'sdílení knížek od nejútlejšího věku, dotyk a následování zájmu.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 0,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'single-contrast-picture',
    revisionId: 'single-contrast-picture.draft-r1',
    language: 'cs',
    title: 'Jeden jednoduchý obrázek',
    ageMonths: {
      fromInclusive: 0,
      toInclusive: 5,
    },
    readinessNotes: 'Žádné blikání nebo nucené sledování.',
    environments: ['quiet'],
    materials: ['Kontrastní pevná dětská obrázková karta, drží dospělý'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Kontrastní pevná dětská obrázková karta, drží dospělý.',
      'Žádné blikání nebo nucené sledování.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Nabídněte jediný obrázek', 'Chvíli ho držte klidně', 'Sledujte zájem'],
    conversationPrompt: '„Tady je kruh.“',
    primaryArea: 'senses',
    relatedAreas: [],
    topicIds: ['sense.high-contrast'],
    sources: [
      {
        label: 'HSE — Play and toys, 0 to 6 months',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www2.hse.ie/babies-children/play/0-6-months/',
        supportsPrinciple: 'pohled, hlas, bezpečné předměty a prostor pro volný pohyb.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 0,
        toInclusive: 5,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'familiar-melody',
    revisionId: 'familiar-melody.draft-r1',
    language: 'cs',
    title: 'Známá krátká melodie',
    ageMonths: {
      fromInclusive: 0,
      toInclusive: 11,
    },
    readinessNotes: 'Běžná jemná hlasitost; zpěv není povinné uspávání.',
    environments: ['quiet'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Hlas dospělého, bez nahrávky a dalších pomůcek.',
      'Běžná jemná hlasitost; zpěv není povinné uspávání.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Zazpívejte krátký známý motiv', 'Udělejte ticho', 'Při zájmu jej zopakujte'],
    conversationPrompt: 'Zpívejte vlastní jednoduchou melodii.',
    primaryArea: 'creationRhythm',
    relatedAreas: [],
    topicIds: ['create.repeat'],
    sources: [
      {
        label: 'Canadian Paediatric Society — Read, speak, sing to your baby',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://caringforkids.cps.ca/handouts/behavior-and-development/read_speak_sing_to_your_baby',
        supportsPrinciple: 'hlas, říkanky, zpěv a opakování v každodenních situacích.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 0,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
      {
        kind: 'materials_none',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'free-kicking',
    revisionId: 'free-kicking.draft-r1',
    language: 'cs',
    title: 'Volné nožky',
    ageMonths: {
      fromInclusive: 0,
      toInclusive: 5,
    },
    readinessNotes: 'Nešlapejte nožkami za dítě; při nepohodě skončete.',
    environments: ['home'],
    materials: ['Pevný bezpečný podklad na podlaze, dítě na zádech'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Pevný bezpečný podklad na podlaze, dítě na zádech.',
      'Nešlapejte nožkami za dítě; při nepohodě skončete.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Uvolněte prostor pro ruce a nohy', 'Nechte vlastní pohyb', 'Klidně ho komentujte'],
    conversationPrompt: '„Nožky se hýbou.“',
    primaryArea: 'movement',
    relatedAreas: [],
    topicIds: ['move.kick'],
    sources: [
      {
        label: 'HSE — Play and toys, 0 to 6 months',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www2.hse.ie/babies-children/play/0-6-months/',
        supportsPrinciple: 'pohled, hlas, bezpečné předměty a prostor pro volný pohyb.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 0,
        toInclusive: 5,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'awake-tummy-moment',
    revisionId: 'awake-tummy-moment.draft-r1',
    language: 'cs',
    title: 'Krátká bdělá chvilka na bříšku',
    ageMonths: {
      fromInclusive: 0,
      toInclusive: 5,
    },
    readinessNotes: 'Při ospalosti přesunout do bezpečného prostoru pro spánek na záda.',
    environments: ['home'],
    materials: ['Známé bezpečné provedení bez individuálního omezení; pevný podklad, stálý dohled'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Známé bezpečné provedení bez individuálního omezení; pevný podklad, stálý dohled.',
      'Při ospalosti přesunout do bezpečného prostoru pro spánek na záda.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: [
      'Nabídněte krátkou bdělou polohu',
      'Buďte u úrovně obličeje',
      'Ukončete podle tolerance',
    ],
    conversationPrompt: '„Vidíme se.“',
    primaryArea: 'movement',
    relatedAreas: [],
    topicIds: ['move.tummy'],
    sources: [
      {
        label: 'AAP / HealthyChildren — Back to Sleep, Tummy to Play',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/Back-to-Sleep-Tummy-to-Play.aspx',
        supportsPrinciple: 'rozlišení bdělé hry pod dohledem a bezpečného spánku.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 0,
        toInclusive: 5,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'gentle-palm-contact',
    revisionId: 'gentle-palm-contact.draft-r1',
    language: 'cs',
    title: 'Jemný dotek dlaně',
    ageMonths: {
      fromInclusive: 0,
      toInclusive: 11,
    },
    readinessNotes: 'Neotvírejte pěst násilím; nejde o masážní nebo rehabilitační techniku.',
    environments: ['quiet'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Dítě přijímá dotek; čisté ruce, bez pomůcek.',
      'Neotvírejte pěst násilím; nejde o masážní nebo rehabilitační techniku.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Nabídněte lehký dotek dlaně', 'Vnímejte reakci', 'Nechte ruku volnou'],
    conversationPrompt: '„Tady je moje ruka.“',
    primaryArea: 'relationship',
    relatedAreas: [],
    topicIds: ['rel.bonding-touch'],
    sources: [
      {
        label: 'UNICEF — The power of play from birth',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.unicef.org/asia-pacific/place-for-parents/power-play-moment-your-baby-born',
        supportsPrinciple: 'kontakt, společné objevování a následování zájmu dítěte.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 0,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
      {
        kind: 'materials_none',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'slow-face-follow',
    revisionId: 'slow-face-follow.draft-r1',
    language: 'cs',
    title: 'Pomalu sledujeme obličej',
    ageMonths: {
      fromInclusive: 0,
      toInclusive: 5,
    },
    readinessNotes: 'Neotáčejte hlavou dítěte; nesledování není neúspěch.',
    environments: ['quiet'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Dítě bdělé a pohodlně uložené; bez pomůcek.',
      'Neotáčejte hlavou dítěte; nesledování není neúspěch.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Navazujte přirozený pohled', 'Pomalu posuňte svůj obličej kousek stranou', 'Počkejte'],
    conversationPrompt: '„Tady jsem.“',
    primaryArea: 'attention',
    relatedAreas: [],
    topicIds: ['attn.track'],
    sources: [
      {
        label: 'CDC — Milestones by 2 Months, Tips and activities',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.cdc.gov/act-early/milestones/2-months.html',
        supportsPrinciple:
          'kontakt, odpovídání, blízkost a pozorování signálů dítěte. Milníky nejsou termín úspěšného absolvování.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 0,
        toInclusive: 5,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
      {
        kind: 'materials_none',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'baby-led-pause',
    revisionId: 'baby-led-pause.draft-r1',
    language: 'cs',
    title: 'Pauza podle miminka',
    ageMonths: {
      fromInclusive: 0,
      toInclusive: 11,
    },
    readinessNotes: 'Nejde o nácvik samostatného uklidnění nebo ignorování pláče.',
    environments: ['quiet'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Dospělý zůstává dostupný, bez pomůcek.',
      'Nejde o nácvik samostatného uklidnění nebo ignorování pláče.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: [
      'Všimněte si odvrácení nebo únavy',
      'Přestaňte přidávat podněty',
      'Nabídněte potřebný klid a kontakt',
    ],
    conversationPrompt: '„Dáme si pauzu.“',
    primaryArea: 'autonomy',
    relatedAreas: [],
    topicIds: ['auto.self-soothe'],
    sources: [
      {
        label: 'Harvard — 5 Steps for Brain-Building Serve and Return',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://developingchild.harvard.edu/resources/handouts-tools/5-steps-for-brain-building-serve-and-return/',
        supportsPrinciple: 'následování zájmu, střídání, čekání a respektování konce interakce.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 0,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
      {
        kind: 'materials_none',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'mirror-together',
    revisionId: 'mirror-together.draft-r1',
    language: 'cs',
    title: 'Společný pohled do zrcátka',
    ageMonths: {
      fromInclusive: 3,
      toInclusive: 11,
    },
    readinessNotes: 'Nepředpokládejte, že dítě poznává samo sebe; sklo nepoužívat.',
    environments: ['home'],
    materials: ['Nerozbitné dětské zrcátko bezpečně drží dospělý'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Nerozbitné dětské zrcátko bezpečně drží dospělý.',
      'Nepředpokládejte, že dítě poznává samo sebe; sklo nepoužívat.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Ukažte společný odraz', 'Jemně změňte výraz', 'Počkejte na zájem'],
    conversationPrompt: '„Vidíme obličej.“',
    primaryArea: 'attention',
    relatedAreas: [],
    topicIds: ['attn.shared'],
    sources: [
      {
        label: 'Nationwide Children’s — Infant Play',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.nationwidechildrens.org/conditions/health-library/infant-play',
        supportsPrinciple:
          'zrakové a sluchové objevování, zrcadlo a věkově přiměřené podněty. Jemný stín je vlastní scénář bez přímého světelného zdroje.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 3,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'toy-within-reach',
    revisionId: 'toy-within-reach.draft-r1',
    language: 'cs',
    title: 'Hračka u ruky',
    ageMonths: {
      fromInclusive: 3,
      toInclusive: 8,
    },
    readinessNotes: 'Hračku nevzdalujte za výkonem; dotyk není povinnost.',
    environments: ['home'],
    materials: ['Vhodná lehká kojenecká hračka, bezpečná poloha na podlaze'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Vhodná lehká kojenecká hračka, bezpečná poloha na podlaze.',
      'Hračku nevzdalujte za výkonem; dotyk není povinnost.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Nabídněte hračku blízko ruky', 'Nechte vlastní pokus', 'Při zájmu změňte stranu'],
    conversationPrompt: '„Můžeš se dotknout.“',
    primaryArea: 'movement',
    relatedAreas: [],
    topicIds: ['move.reach'],
    sources: [
      {
        label: 'CDC — Milestones by 4 Months, Tips and activities',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.cdc.gov/act-early/milestones/4-months.html',
        supportsPrinciple: 'bezpečné sahání, pohyb a manipulace s věkově vhodnou hračkou.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 3,
        toInclusive: 8,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'two-safe-textures',
    revisionId: 'two-safe-textures.draft-r1',
    language: 'cs',
    title: 'Dva bezpečné povrchy',
    ageMonths: {
      fromInclusive: 3,
      toInclusive: 11,
    },
    readinessNotes: 'Bez volných nití, chlupů a drobných částí; nepříjemný povrch vynechte.',
    environments: ['home'],
    materials: ['Dvě nepoškozené kojenecké hračky s různým povrchem'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Dvě nepoškozené kojenecké hračky s různým povrchem.',
      'Bez volných nití, chlupů a drobných částí; nepříjemný povrch vynechte.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Nabídněte jeden povrch', 'Po pauze druhý', 'Popište rozdíl'],
    conversationPrompt: '„Hladké. Tohle je hrbolaté.“',
    primaryArea: 'senses',
    relatedAreas: [],
    topicIds: ['sense.texture'],
    sources: [
      {
        label: 'Canadian Paediatric Society — Playtime with your baby',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://caringforkids.cps.ca/handouts/pregnancy-and-babies/playtime_with_your_baby',
        supportsPrinciple:
          'vztahová hra, bezpečné pomůcky, hmat a jednoduché společné zvuky/pohyby.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 3,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'slow-toy-tracking',
    revisionId: 'slow-toy-tracking.draft-r1',
    language: 'cs',
    title: 'Pomalá cesta hračky',
    ageMonths: {
      fromInclusive: 3,
      toInclusive: 8,
    },
    readinessNotes: 'Nezkoušejte krajní rozsah pohledu ani rychlé sledování.',
    environments: ['quiet'],
    materials: ['Jedna věkově vhodná dobře viditelná hračka'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Jedna věkově vhodná dobře viditelná hračka.',
      'Nezkoušejte krajní rozsah pohledu ani rychlé sledování.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Nabídněte ji ve výhledu', 'Posuňte pomalu do strany', 'Zastavte'],
    conversationPrompt: '„Jede pomalu.“',
    primaryArea: 'attention',
    relatedAreas: [],
    topicIds: ['attn.track'],
    sources: [
      {
        label: 'CDC — Milestones by 4 Months, Tips and activities',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.cdc.gov/act-early/milestones/4-months.html',
        supportsPrinciple: 'bezpečné sahání, pohyb a manipulace s věkově vhodnou hračkou.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 3,
        toInclusive: 8,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'holding-a-ring',
    revisionId: 'holding-a-ring.draft-r1',
    language: 'cs',
    title: 'Vlastní držení kroužku',
    ageMonths: {
      fromInclusive: 3,
      toInclusive: 11,
    },
    readinessNotes: 'Vyžaduje potvrzenou připravenost: grasp.',
    environments: ['home'],
    materials: ['jednodílný kojenecký kroužek'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Potvrzené `grasp`; jednodílný kojenecký kroužek.',
      'Nezavírejte mu ruku a za hračku netahejte.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Nabídněte kroužek', 'Nechte dítě samo uchopit', 'Dovolte kdykoli pustit'],
    conversationPrompt: '„Držíš kroužek.“',
    primaryArea: 'autonomy',
    relatedAreas: [],
    topicIds: ['auto.grasp'],
    sources: [
      {
        label: 'CDC — Milestones by 4 Months, Tips and activities',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.cdc.gov/act-early/milestones/4-months.html',
        supportsPrinciple: 'bezpečné sahání, pohyb a manipulace s věkově vhodnou hračkou.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 3,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'readiness_confirmed',
        key: 'grasp',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'gentle-voice-play',
    revisionId: 'gentle-voice-play.draft-r1',
    language: 'cs',
    title: 'Hlas má různé barvy',
    ageMonths: {
      fromInclusive: 3,
      toInclusive: 11,
    },
    readinessNotes: 'Reakci nevyžadujte; při úleku se vraťte ke klidu.',
    environments: ['quiet'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Bez pomůcek, dítě přijímá hlasový kontakt.',
      'Reakci nevyžadujte; při úleku se vraťte ke klidu.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Řekněte krátký zvuk běžným hlasem', 'Zkuste jemně jinou melodii', 'Počkejte'],
    conversationPrompt: '„Áá?“ měkce a bez hlasitého překvapení.',
    primaryArea: 'creationRhythm',
    relatedAreas: [],
    topicIds: ['create.voice-play'],
    sources: [
      {
        label: 'Canadian Paediatric Society — Read, speak, sing to your baby',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://caringforkids.cps.ca/handouts/behavior-and-development/read_speak_sing_to_your_baby',
        supportsPrinciple: 'hlas, říkanky, zpěv a opakování v každodenních situacích.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 3,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
      {
        kind: 'materials_none',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'dressing-rhyme',
    revisionId: 'dressing-rhyme.draft-r1',
    language: 'cs',
    title: 'Říkanka při oblékání',
    ageMonths: {
      fromInclusive: 3,
      toInclusive: 11,
    },
    readinessNotes: 'Nepřetahujte paži za gestem a neodvádějte pozornost od bezpečnosti.',
    environments: ['home'],
    materials: ['Běžné oblečení při bezpečné péči; žádná další pomůcka'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Běžné oblečení při bezpečné péči; žádná další pomůcka.',
      'Nepřetahujte paži za gestem a neodvádějte pozornost od bezpečnosti.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Pojmenujte část oblečení', 'Přidejte krátký rytmický verš', 'V klidu dokončete péči'],
    conversationPrompt: '„Rukávek, ruka, hotovo.“',
    primaryArea: 'speech',
    relatedAreas: [],
    topicIds: ['speech.songs'],
    sources: [
      {
        label: 'Canadian Paediatric Society — Read, speak, sing to your baby',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://caringforkids.cps.ca/handouts/behavior-and-development/read_speak_sing_to_your_baby',
        supportsPrinciple: 'hlas, říkanky, zpěv a opakování v každodenních situacích.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 3,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'touching-a-book',
    revisionId: 'touching-a-book.draft-r1',
    language: 'cs',
    title: 'Knížka pod rukama',
    ageMonths: {
      fromInclusive: 3,
      toInclusive: 11,
    },
    readinessNotes: 'Bez odtržitelných doplňků; prozkoumání má přednost před dočtením.',
    environments: ['home'],
    materials: ['Čistá látková nebo pevná kojenecká knížka'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Čistá látková nebo pevná kojenecká knížka.',
      'Bez odtržitelných doplňků; prozkoumání má přednost před dočtením.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Přidržte otevřenou stránku', 'Dovolte dotyk', 'Pojmenujte, čeho se dítě dotýká'],
    conversationPrompt: '„Dotýkáš se medvídka.“',
    primaryArea: 'speech',
    relatedAreas: [],
    topicIds: ['speech.listening'],
    sources: [
      {
        label: 'AAP / HealthyChildren — How to Share Books With Your Baby',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.healthychildren.org/English/ages-stages/baby/Pages/how-to-share-books-with-your-baby.aspx',
        supportsPrinciple: 'sdílení knížek od nejútlejšího věku, dotyk a následování zájmu.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 3,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'self-led-side-reach',
    revisionId: 'self-led-side-reach.draft-r1',
    language: 'cs',
    title: 'Hračka po straně při vlastním otáčení',
    ageMonths: {
      fromInclusive: 3,
      toInclusive: 8,
    },
    readinessNotes: 'Vyžaduje potvrzenou připravenost: rollAttempt.',
    environments: ['home'],
    materials: ['bezpečná hračka a podklad'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      '`rollAttempt`; bezpečná hračka a podklad.',
      'Nepřetáčejte dítě za ruce ani pánev.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Dejte hračku blízko na stranu', 'Nechte vlastní pokus', 'Případně ji přibližte'],
    conversationPrompt: '„Je vedle tebe.“',
    primaryArea: 'movement',
    relatedAreas: [],
    topicIds: ['move.roll'],
    sources: [
      {
        label: 'Head Start — Tummy Time Activities During Home Visits',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://headstart.gov/publication/tummy-time-activities-during-home-visits',
        supportsPrinciple:
          'bezpečná bdělá hra na podlaze, dospělý přítomný a nabídka podnětu. Nepřebíráme odborné manipulační techniky.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 3,
        toInclusive: 8,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'readiness_confirmed',
        key: 'rollAttempt',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'soft-hand-shadow',
    revisionId: 'soft-hand-shadow.draft-r1',
    language: 'cs',
    title: 'Jemný stín ruky',
    ageMonths: {
      fromInclusive: 3,
      toInclusive: 11,
    },
    readinessNotes: 'Bez baterky do očí, slunce, blikání nebo zatemňování dítěte.',
    environments: ['home'],
    materials: ['Klidný stín na stěně při běžném nepřímém osvětlení'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Klidný stín na stěně při běžném nepřímém osvětlení.',
      'Bez baterky do očí, slunce, blikání nebo zatemňování dítěte.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Ukažte stín své ruky', 'Pomalu s ní pohněte', 'Zastavte'],
    conversationPrompt: '„Stín se pohnul.“',
    primaryArea: 'senses',
    relatedAreas: [],
    topicIds: ['sense.light'],
    sources: [
      {
        label: 'Nationwide Children’s — Infant Play',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.nationwidechildrens.org/conditions/health-library/infant-play',
        supportsPrinciple:
          'zrakové a sluchové objevování, zrcadlo a věkově přiměřené podněty. Jemný stín je vlastní scénář bez přímého světelného zdroje.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 3,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'parent-knee-rhythm',
    revisionId: 'parent-knee-rhythm.draft-r1',
    language: 'cs',
    title: 'Rytmus na vlastních kolenou',
    ageMonths: {
      fromInclusive: 3,
      toInclusive: 11,
    },
    readinessNotes: 'Nedržte dítěti ruce a nevynucujte napodobení.',
    environments: ['quiet'],
    materials: ['Dospělý má volné ruce, dítě bezpečně uložené'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Dospělý má volné ruce, dítě bezpečně uložené.',
      'Nedržte dítěti ruce a nevynucujte napodobení.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Tiše poklepejte na vlastní kolena', 'Udělejte pauzu', 'Při zájmu zopakujte'],
    conversationPrompt: '„Ťuk, ťuk, pauza.“',
    primaryArea: 'creationRhythm',
    relatedAreas: [],
    topicIds: ['create.rhythm'],
    sources: [
      {
        label: 'Canadian Paediatric Society — Playtime with your baby',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://caringforkids.cps.ca/handouts/pregnancy-and-babies/playtime_with_your_baby',
        supportsPrinciple:
          'vztahová hra, bezpečné pomůcky, hmat a jednoduché společné zvuky/pohyby.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 3,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'near-and-far-toy',
    revisionId: 'near-and-far-toy.draft-r1',
    language: 'cs',
    title: 'Blíž a o kousek dál',
    ageMonths: {
      fromInclusive: 3,
      toInclusive: 8,
    },
    readinessNotes: 'Bez prudkého přibližování k obličeji nebo testování zraku.',
    environments: ['home'],
    materials: ['Jedna dobře viditelná kojenecká hračka v ruce dospělého'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Jedna dobře viditelná kojenecká hračka v ruce dospělého.',
      'Bez prudkého přibližování k obličeji nebo testování zraku.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Ukažte ji v pohodlném výhledu', 'Mírně změňte vzdálenost', 'Zastavte'],
    conversationPrompt: '„Teď je blíž.“',
    primaryArea: 'spaceQuantity',
    relatedAreas: [],
    topicIds: ['space.near-far'],
    sources: [
      {
        label: 'HSE — Play and toys, 0 to 6 months',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www2.hse.ie/babies-children/play/0-6-months/',
        supportsPrinciple: 'pohled, hlas, bezpečné předměty a prostor pro volný pohyb.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 3,
        toInclusive: 8,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'familiar-voices-greeting',
    revisionId: 'familiar-voices-greeting.draft-r1',
    language: 'cs',
    title: 'Pozdrav dvou blízkých lidí',
    ageMonths: {
      fromInclusive: 3,
      toInclusive: 11,
    },
    readinessNotes: 'Nevyžadujte přenos pohledu ani kontakt s neznámou osobou.',
    environments: ['quiet'],
    materials: ['Dva známí pečující, dítě přijímá jejich přítomnost'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Dva známí pečující, dítě přijímá jejich přítomnost.',
      'Nevyžadujte přenos pohledu ani kontakt s neznámou osobou.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Jeden krátce pozdraví', 'Po pauze druhý', 'Nechte dítě zvolit pozornost'],
    conversationPrompt: 'Každý řekne prosté „Ahoj“.',
    primaryArea: 'relationship',
    relatedAreas: [],
    topicIds: ['rel.turn-taking'],
    sources: [
      {
        label: 'UNICEF — The power of play from birth',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.unicef.org/asia-pacific/place-for-parents/power-play-moment-your-baby-born',
        supportsPrinciple: 'kontakt, společné objevování a následování zájmu dítěte.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 3,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'choose-by-looking',
    revisionId: 'choose-by-looking.draft-r1',
    language: 'cs',
    title: 'Dvě nabídky, vlastní zájem',
    ageMonths: {
      fromInclusive: 3,
      toInclusive: 11,
    },
    readinessNotes: 'Nezájem není chyba; volbu nevydávejte za trvalou preferenci.',
    environments: ['home'],
    materials: ['Dvě bezpečné kojenecké hračky'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Dvě bezpečné kojenecké hračky.',
      'Nezájem není chyba; volbu nevydávejte za trvalou preferenci.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Ukažte obě bez mávání', 'Všimněte si pohledu či natažení', 'Nabídněte vybranou'],
    conversationPrompt: '„Zajímá tě tahle?“',
    primaryArea: 'autonomy',
    relatedAreas: [],
    topicIds: ['auto.choice'],
    sources: [
      {
        label: 'UNICEF — The power of play from birth',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.unicef.org/asia-pacific/place-for-parents/power-play-moment-your-baby-born',
        supportsPrinciple: 'kontakt, společné objevování a následování zájmu dítěte.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 3,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'hand-to-hand-toy',
    revisionId: 'hand-to-hand-toy.draft-r1',
    language: 'cs',
    title: 'Z jedné ruky do druhé',
    ageMonths: {
      fromInclusive: 6,
      toInclusive: 11,
    },
    readinessNotes: 'Vyžaduje potvrzenou připravenost: grasp.',
    environments: ['home'],
    materials: ['lehká jednodílná hračka, bezpečná poloha'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      '`grasp`; lehká jednodílná hračka, bezpečná poloha.',
      'Nepřekládejte ji násilně a nedržte druhou ruku.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: [
      'Nechte dítě uchopit hračku',
      'Ponechte obě ruce volné',
      'Vyčkejte na vlastní manipulaci',
    ],
    conversationPrompt: '„Teď je v druhé ruce.“',
    primaryArea: 'autonomy',
    relatedAreas: [],
    topicIds: ['auto.grasp'],
    sources: [
      {
        label: 'CDC — Milestones by 6 Months, Tips and activities',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.cdc.gov/act-early/milestones/6-months.html',
        supportsPrinciple: 'zvukové střídání, pojmenovávání a vlastní zkoumání předmětů.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 6,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'readiness_confirmed',
        key: 'grasp',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'soft-toy-release',
    revisionId: 'soft-toy-release.draft-r1',
    language: 'cs',
    title: 'Pustím a dostanu zpátky',
    ageMonths: {
      fromInclusive: 6,
      toInclusive: 11,
    },
    readinessNotes: 'Vyžaduje potvrzenou připravenost: grasp, release.',
    environments: ['home'],
    materials: ['měkká hračka, nízko nad podlahou'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      '`grasp`, `release`; měkká hračka, nízko nad podlahou.',
      'Bez pádu tvrdých předmětů a bez nuceného otevření dlaně.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Nechte hračku samostatně pustit', 'Vraťte ji do dosahu', 'Počkejte'],
    conversationPrompt: '„Spadla. Tady je.“',
    primaryArea: 'autonomy',
    relatedAreas: [],
    topicIds: ['auto.release'],
    sources: [
      {
        label: 'CDC — Milestones by 9 Months, Tips and activities',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.cdc.gov/act-early/milestones/9-months.html',
        supportsPrinciple:
          'předávání, nádoby, vracení upuštěného předmětu a srozumitelné loučení se zachovanou oporou.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 6,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'readiness_confirmed',
        key: 'grasp',
      },
      {
        kind: 'readiness_confirmed',
        key: 'release',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'take-out-a-toy',
    revisionId: 'take-out-a-toy.draft-r1',
    language: 'cs',
    title: 'Vyndám věc z misky',
    ageMonths: {
      fromInclusive: 6,
      toInclusive: 11,
    },
    readinessNotes: 'Vyžaduje potvrzenou připravenost: grasp.',
    environments: ['home'],
    materials: ['široká nerozbitná miska a velká bezpečná hračka'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      '`grasp`; široká nerozbitná miska a velká bezpečná hračka.',
      'Bez zachycení ruky, hluboké nádoby nebo ostrých hran.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Ukažte hračku uvnitř', 'Nabídněte dosažitelnou misku', 'Nechte vlastní vyjmutí'],
    conversationPrompt: '„Uvnitř. Teď venku.“',
    primaryArea: 'spaceQuantity',
    relatedAreas: [],
    topicIds: ['space.in-out'],
    sources: [
      {
        label: 'HSE — Play and toys, 6 to 12 months',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www2.hse.ie/babies-children/play/6-12-months/',
        supportsPrinciple:
          'velké míče, kelímky, skládací hračky a jednoduchý rytmus. Vodní a plavecké náměty do této sady nepřebíráme.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 6,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'readiness_confirmed',
        key: 'grasp',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'rattle-and-pause',
    revisionId: 'rattle-and-pause.draft-r1',
    language: 'cs',
    title: 'Chrastítko a ticho',
    ageMonths: {
      fromInclusive: 6,
      toInclusive: 11,
    },
    readinessNotes: 'Ne u ucha; nezkoušíte sluch hlasitým překvapením.',
    environments: ['quiet'],
    materials: ['Nepoškozené věkově vhodné uzavřené chrastítko v ruce dospělého'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Nepoškozené věkově vhodné uzavřené chrastítko v ruce dospělého.',
      'Ne u ucha; nezkoušíte sluch hlasitým překvapením.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Krátce jemně zachrastěte ve výhledu', 'Zastavte', 'Počkejte na reakci'],
    conversationPrompt: '„Slyšíme. Teď ticho.“',
    primaryArea: 'senses',
    relatedAreas: [],
    topicIds: ['sense.sound'],
    sources: [
      {
        label: 'CDC — Milestones by 6 Months, Tips and activities',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.cdc.gov/act-early/milestones/6-months.html',
        supportsPrinciple: 'zvukové střídání, pojmenovávání a vlastní zkoumání předmětů.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 6,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'parent-peekaboo',
    revisionId: 'parent-peekaboo.draft-r1',
    language: 'cs',
    title: 'Kuk za vlastními dlaněmi',
    ageMonths: {
      fromInclusive: 6,
      toInclusive: 11,
    },
    readinessNotes: 'Nezakrývat obličej dítěte; při nejistotě zůstat vidět.',
    environments: ['quiet'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Bez pomůcek, dítě přijímá hru s obličejem.',
      'Nezakrývat obličej dítěte; při nejistotě zůstat vidět.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Zakryjte si na okamžik svůj obličej dlaněmi', 'Odkryjte ho', 'Vyčkejte'],
    conversationPrompt: '„Kuk, jsem tady.“',
    primaryArea: 'relationship',
    relatedAreas: [],
    topicIds: ['rel.turn-taking'],
    sources: [
      {
        label: 'UNICEF — 21 learning activities for babies and toddlers',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.unicef.org/parenting/child-care/21-learning-activities-babies-and-toddlers',
        supportsPrinciple:
          'vlastní aktivita dítěte, jednoduché střídání a hra s pečujícím. Nejde o převzetí celého seznamu ani jeho rizikovějších variant.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 6,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
      {
        kind: 'materials_none',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'quiet-sound-direction',
    revisionId: 'quiet-sound-direction.draft-r1',
    language: 'cs',
    title: 'Odkud je tichý zvuk',
    ageMonths: {
      fromInclusive: 6,
      toInclusive: 11,
    },
    readinessNotes: 'Nenuťte otočení hlavy; žádný hluk za zády nebo u ucha.',
    environments: ['quiet'],
    materials: ['Bezpečně podepřené dítě, tiché kojenecké chrastítko'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Bezpečně podepřené dítě, tiché kojenecké chrastítko.',
      'Nenuťte otočení hlavy; žádný hluk za zády nebo u ucha.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Ukažte zdroj', 'Posuňte ho mírně stranou a krátce zazvučte', 'Čekejte'],
    conversationPrompt: '„Ozvalo se tady.“',
    primaryArea: 'senses',
    relatedAreas: [],
    topicIds: ['sense.sound'],
    sources: [
      {
        label: 'Nationwide Children’s — Infant Play',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.nationwidechildrens.org/conditions/health-library/infant-play',
        supportsPrinciple:
          'zrakové a sluchové objevování, zrcadlo a věkově přiměřené podněty. Jemný stín je vlastní scénář bez přímého světelného zdroje.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 6,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'floor-play-partner',
    revisionId: 'floor-play-partner.draft-r1',
    language: 'cs',
    title: 'Dospělý na podlaze vedle mě',
    ageMonths: {
      fromInclusive: 6,
      toInclusive: 11,
    },
    readinessNotes: 'Neučíte sed nebo lezení tahem či podpíráním do nové polohy.',
    environments: ['home'],
    materials: ['Bezpečný podklad; dítě ve zvládnuté poloze. Hračka je nepovinná'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Bezpečný podklad; dítě ve zvládnuté poloze. Hračka je nepovinná.',
      'Neučíte sed nebo lezení tahem či podpíráním do nové polohy.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Sedněte si blízko', 'Nabídněte ruku nebo známou hračku', 'Nechte vlastní pohyb'],
    conversationPrompt: '„Jsem vedle tebe.“',
    primaryArea: 'movement',
    relatedAreas: [],
    topicIds: ['move.reach'],
    sources: [
      {
        label: 'NHS — How to keep your baby or toddler active',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.nhs.uk/baby/babys-development/play-and-learning/keep-baby-or-toddler-active/',
        supportsPrinciple:
          'volný pohyb a bezpečné prostředí. Oblékání je vlastní kontext pro dobrovolný pohyb, nikoli rehabilitační instrukce.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 6,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'body-part-names',
    revisionId: 'body-part-names.draft-r1',
    language: 'cs',
    title: 'Nos a ruce při hře',
    ageMonths: {
      fromInclusive: 6,
      toInclusive: 11,
    },
    readinessNotes: 'Nevyžadujte ukázání ani odpověď; nesahejte dítěti do očí či nosu.',
    environments: ['quiet'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Bez pomůcek, dítě přijímá kontakt.',
      'Nevyžadujte ukázání ani odpověď; nesahejte dítěti do očí či nosu.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Ukažte svůj nos', 'Pak své ruce', 'Pojmenujte je s pauzou'],
    conversationPrompt: '„Nos. Tady jsou ruce.“',
    primaryArea: 'speech',
    relatedAreas: [],
    topicIds: ['speech.naming'],
    sources: [
      {
        label: 'Canadian Paediatric Society — Playtime with your baby',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://caringforkids.cps.ca/handouts/pregnancy-and-babies/playtime_with_your_baby',
        supportsPrinciple:
          'vztahová hra, bezpečné pomůcky, hmat a jednoduché společné zvuky/pohyby.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 6,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
      {
        kind: 'materials_none',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'one-and-another',
    revisionId: 'one-and-another.draft-r1',
    language: 'cs',
    title: 'Jeden předmět a ještě jeden',
    ageMonths: {
      fromInclusive: 6,
      toInclusive: 11,
    },
    readinessNotes: 'Nejde o počítání na povel ani test rozpoznání množství.',
    environments: ['home'],
    materials: ['Dvě velké nepoškozené kojenecké kostky'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Dvě velké nepoškozené kojenecké kostky.',
      'Nejde o počítání na povel ani test rozpoznání množství.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Ukažte jednu', 'Přidejte druhou', 'Nechte obě prohlédnout nebo prozkoumat'],
    conversationPrompt: '„Jedna a ještě jedna.“',
    primaryArea: 'spaceQuantity',
    relatedAreas: [],
    topicIds: ['space.more-less'],
    sources: [
      {
        label: 'NHS — Baby and toddler play ideas',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.nhs.uk/baby/babys-development/play-and-learning/baby-and-toddler-play-ideas/',
        supportsPrinciple:
          'jednoduché materiály a manipulace. Srovnávání velikostí a prázdna je vlastní scénář, nikoli test matematické dovednosti.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 6,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'book-flap-discovery',
    revisionId: 'book-flap-discovery.draft-r1',
    language: 'cs',
    title: 'Obrázek za velkou klopou',
    ageMonths: {
      fromInclusive: 6,
      toInclusive: 11,
    },
    readinessNotes: 'Klopu může ovládat dospělý; nevyžadovat hledání nebo jemný úchop.',
    environments: ['home'],
    materials: ['Kojenecká knížka s pevně připojenou velkou bezpečnou klopou'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Kojenecká knížka s pevně připojenou velkou bezpečnou klopou.',
      'Klopu může ovládat dospělý; nevyžadovat hledání nebo jemný úchop.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Ukažte obrázek', 'Částečně ho zakryjte klopou', 'Znovu odkryjte'],
    conversationPrompt: '„Byl schovaný, tady je.“',
    primaryArea: 'attention',
    relatedAreas: [],
    topicIds: ['attn.short-focus'],
    sources: [
      {
        label: 'Illinois Early Learning — Sharing Books with Your Baby',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://illinoisearlylearning.org/tipsheets/booksbaby/',
        supportsPrinciple:
          'společné prohlížení a aktivní zkoumání knih. Konkrétní hra s klopou je vlastní redakční varianta tohoto principu.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 6,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'slow-approaching-ball',
    revisionId: 'slow-approaching-ball.draft-r1',
    language: 'cs',
    title: 'Míček se pomalu přibližuje',
    ageMonths: {
      fromInclusive: 6,
      toInclusive: 11,
    },
    readinessNotes: 'Bez zásahu obličeje a bez natahování dítěte za hranici stability.',
    environments: ['home'],
    materials: ['Velký měkký kojenecký míček, bezpečný podklad a zvládnutá poloha'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Velký měkký kojenecký míček, bezpečný podklad a zvládnutá poloha.',
      'Bez zásahu obličeje a bez natahování dítěte za hranici stability.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Položte míček blízko', 'Pomalu jej přikutálejte do dosahu', 'Nechte dotyk'],
    conversationPrompt: '„Míček přijel.“',
    primaryArea: 'movement',
    relatedAreas: [],
    topicIds: ['move.reach'],
    sources: [
      {
        label: 'Seattle Children’s — Toys and Play: Birth to 12 Months',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.seattlechildrens.org/health-safety/parenting/toys-and-play-birth-to-12-months/',
        supportsPrinciple:
          'velké míče, manipulace s pojízdnými a mechanickými kojeneckými hračkami.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 6,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'baby-hand-drum',
    revisionId: 'baby-hand-drum.draft-r1',
    language: 'cs',
    title: 'Moje ruka dělá ťuk',
    ageMonths: {
      fromInclusive: 6,
      toInclusive: 11,
    },
    readinessNotes: 'Vyžaduje potvrzenou připravenost: floorSit.',
    environments: ['home'],
    materials: ['bezpečný kojenecký bubínek bez paliček a volných částí'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      '`floorSit`; bezpečný kojenecký bubínek bez paliček a volných částí.',
      'Nevodit ruce; při nejistém sedu zvolit jinou činnost.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Ukažte tiché klepnutí rukou', 'Nabídněte bubínek', 'Nechte vlastní pokus'],
    conversationPrompt: '„Ťuk a pauza.“',
    primaryArea: 'creationRhythm',
    relatedAreas: [],
    topicIds: ['create.rhythm'],
    sources: [
      {
        label: 'HSE — Play and toys, 6 to 12 months',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www2.hse.ie/babies-children/play/6-12-months/',
        supportsPrinciple:
          'velké míče, kelímky, skládací hračky a jednoduchý rytmus. Vodní a plavecké náměty do této sady nepřebíráme.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 6,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'readiness_confirmed',
        key: 'floorSit',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'unhurried-exploration',
    revisionId: 'unhurried-exploration.draft-r1',
    language: 'cs',
    title: 'Nerušíme vlastní objev',
    ageMonths: {
      fromInclusive: 6,
      toInclusive: 11,
    },
    readinessNotes: 'Neměřte výdrž a neodcházejte od dohledu.',
    environments: ['quiet'],
    materials: ['Dítě právě bezpečně zkoumá vhodný předmět; dospělý zůstává blízko'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Dítě právě bezpečně zkoumá vhodný předmět; dospělý zůstává blízko.',
      'Neměřte výdrž a neodcházejte od dohledu.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Všimněte si jeho zájmu', 'Nepřidávejte další hračku', 'Odpovězte, až naváže kontakt'],
    conversationPrompt: 'Krátce pojmenujte jeho objev.',
    primaryArea: 'attention',
    relatedAreas: [],
    topicIds: ['attn.short-focus'],
    sources: [
      {
        label: 'Harvard — 5 Steps for Brain-Building Serve and Return',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://developingchild.harvard.edu/resources/handouts-tools/5-steps-for-brain-building-serve-and-return/',
        supportsPrinciple: 'následování zájmu, střídání, čekání a respektování konce interakce.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 6,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'name-a-real-interest',
    revisionId: 'name-a-real-interest.draft-r1',
    language: 'cs',
    title: 'Slovo pro to, co zaujalo',
    ageMonths: {
      fromInclusive: 6,
      toInclusive: 11,
    },
    readinessNotes: 'Bez zkoušení slov a bez odvádění pozornosti při přesunu.',
    environments: ['home', 'outdoor'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Dospělý stojí či sedí bezpečně, dítě má potřebnou oporu; bez pomůcek.',
      'Bez zkoušení slov a bez odvádění pozornosti při přesunu.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Sledujte zájem dítěte', 'Pojmenujte viděnou věc', 'Počkejte'],
    conversationPrompt: '„To je strom.“',
    primaryArea: 'speech',
    relatedAreas: [],
    topicIds: ['speech.naming'],
    sources: [
      {
        label: 'CDC — Milestones by 6 Months, Tips and activities',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.cdc.gov/act-early/milestones/6-months.html',
        supportsPrinciple: 'zvukové střídání, pojmenovávání a vlastní zkoumání předmětů.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 6,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home', 'outdoor'],
      },
      {
        kind: 'materials_none',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'familiar-faces-book',
    revisionId: 'familiar-faces-book.draft-r1',
    language: 'cs',
    title: 'Knížka s blízkými obličeji',
    ageMonths: {
      fromInclusive: 6,
      toInclusive: 11,
    },
    readinessNotes: 'Bez zkoušení paměti a volných fotografií do úst.',
    environments: ['quiet'],
    materials: ['Pevná knížka s obličeji nebo bezpečně chráněné obrázky drží dospělý'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Pevná knížka s obličeji nebo bezpečně chráněné obrázky drží dospělý.',
      'Bez zkoušení paměti a volných fotografií do úst.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Ukažte jeden obličej', 'Pojmenujte známou osobu', 'Počkejte na zájem'],
    conversationPrompt: '„Tady je babička.“',
    primaryArea: 'relationship',
    relatedAreas: [],
    topicIds: ['rel.eye-contact'],
    sources: [
      {
        label: 'NCCA — Enjoying books with your baby, birth–18 months',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://ncca.ie/media/5615/enjoying-books-with-your-baby_ef-8.pdf',
        supportsPrinciple:
          'pevné a látkové knížky, známé obrazy, vlastní manipulace a opakované společné čtení.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 6,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'self-led-floor-exploring',
    revisionId: 'self-led-floor-exploring.draft-r1',
    language: 'cs',
    title: 'Vlastní cesta po bezpečné podlaze',
    ageMonths: {
      fromInclusive: 6,
      toInclusive: 11,
    },
    readinessNotes: 'Vyžaduje potvrzenou připravenost: floorMove.',
    environments: ['home'],
    materials: ['předem zabezpečený prostor, dospělý blízko'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      '`floorMove`; předem zabezpečený prostor, dospělý blízko.',
      'Nevyžadujte lezení určitým způsobem a nepřidávejte překážkovou dráhu.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Uvolněte malou bezpečnou plochu', 'Nechte volbu směru', 'Doprovázejte podle potřeby'],
    conversationPrompt: '„Jdu s tebou.“',
    primaryArea: 'autonomy',
    relatedAreas: [],
    topicIds: ['auto.explore-safe'],
    sources: [
      {
        label: 'NHS — How to keep your baby or toddler active',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.nhs.uk/baby/babys-development/play-and-learning/keep-baby-or-toddler-active/',
        supportsPrinciple:
          'volný pohyb a bezpečné prostředí. Oblékání je vlastní kontext pro dobrovolný pohyb, nikoli rehabilitační instrukce.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 6,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'readiness_confirmed',
        key: 'floorMove',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'put-a-toy-in',
    revisionId: 'put-a-toy-in.draft-r1',
    language: 'cs',
    title: 'Hračka dovnitř',
    ageMonths: {
      fromInclusive: 9,
      toInclusive: 11,
    },
    readinessNotes: 'Vyžaduje potvrzenou připravenost: grasp, release.',
    environments: ['home'],
    materials: ['široká miska a velká kojenecká kostka'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      '`grasp`, `release`; široká miska a velká kojenecká kostka.',
      'Miska nesmí zachytit ruku; neberte dítěti hračku násilím.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Ukažte vložení', 'Nabídněte hračku', 'Vyčkejte na vlastní pokus'],
    conversationPrompt: '„Kostka je uvnitř.“',
    primaryArea: 'spaceQuantity',
    relatedAreas: [],
    topicIds: ['space.in-out'],
    sources: [
      {
        label: 'CDC — Milestones by 9 Months, Tips and activities',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.cdc.gov/act-early/milestones/9-months.html',
        supportsPrinciple:
          'předávání, nádoby, vracení upuštěného předmětu a srozumitelné loučení se zachovanou oporou.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 9,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'readiness_confirmed',
        key: 'grasp',
      },
      {
        kind: 'readiness_confirmed',
        key: 'release',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'nesting-cups',
    revisionId: 'nesting-cups.draft-r1',
    language: 'cs',
    title: 'Kelímek v kelímku',
    ageMonths: {
      fromInclusive: 9,
      toInclusive: 11,
    },
    readinessNotes: 'Vyžaduje potvrzenou připravenost: grasp.',
    environments: ['home'],
    materials: ['dva velké stohovací kelímky určené kojencům'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      '`grasp`; dva velké stohovací kelímky určené kojencům.',
      'Bez drobných dílů, tlaku na správné složení a sevření prstů.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Ukažte menší uvnitř většího', 'Oddělte je', 'Nabídněte manipulaci'],
    conversationPrompt: '„Tenhle se vejde.“',
    primaryArea: 'spaceQuantity',
    relatedAreas: [],
    topicIds: ['space.in-out'],
    sources: [
      {
        label: 'HSE — Play and toys, 6 to 12 months',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www2.hse.ie/babies-children/play/6-12-months/',
        supportsPrinciple:
          'velké míče, kelímky, skládací hračky a jednoduchý rytmus. Vodní a plavecké náměty do této sady nepřebíráme.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 9,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'readiness_confirmed',
        key: 'grasp',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'toy-and-container-fit',
    revisionId: 'toy-and-container-fit.draft-r1',
    language: 'cs',
    title: 'Kam se vejde velká hračka',
    ageMonths: {
      fromInclusive: 9,
      toInclusive: 11,
    },
    readinessNotes: 'Vyžaduje potvrzenou připravenost: grasp.',
    environments: ['home'],
    materials: ['velká bezpečná hračka a dvě široké nerozbitné nádoby'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      '`grasp`; velká bezpečná hračka a dvě široké nerozbitné nádoby.',
      'Bez násilného vtlačování; nejde o úkol se správnou odpovědí.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Nabídněte nádobu, kam se vejde', 'Ukažte rozdíl velikostí', 'Nechte průzkum'],
    conversationPrompt: '„Tady má víc místa.“',
    primaryArea: 'spaceQuantity',
    relatedAreas: [],
    topicIds: ['space.in-out'],
    sources: [
      {
        label: 'NHS — Baby and toddler play ideas',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.nhs.uk/baby/babys-development/play-and-learning/baby-and-toddler-play-ideas/',
        supportsPrinciple:
          'jednoduché materiály a manipulace. Srovnávání velikostí a prázdna je vlastní scénář, nikoli test matematické dovednosti.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 9,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'readiness_confirmed',
        key: 'grasp',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'rolling-turns',
    revisionId: 'rolling-turns.draft-r1',
    language: 'cs',
    title: 'Míček mezi námi',
    ageMonths: {
      fromInclusive: 9,
      toInclusive: 11,
    },
    readinessNotes: 'Vyžaduje potvrzenou připravenost: floorSit.',
    environments: ['home'],
    materials: ['velký měkký míček, dospělý v dosahu'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      '`floorSit`; velký měkký míček, dospělý v dosahu.',
      'Vracení nevyžadujte a neohrozte stabilitu sedu.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Pomalu přikutálejte míček', 'Čekejte na dotyk či postrčení', 'Reagujte na jeho akci'],
    conversationPrompt: '„Teď k tobě, teď ke mně.“',
    primaryArea: 'relationship',
    relatedAreas: [],
    topicIds: ['rel.turn-taking'],
    sources: [
      {
        label: 'UNICEF — 21 learning activities for babies and toddlers',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.unicef.org/parenting/child-care/21-learning-activities-babies-and-toddlers',
        supportsPrinciple:
          'vlastní aktivita dítěte, jednoduché střídání a hra s pečujícím. Nejde o převzetí celého seznamu ani jeho rizikovějších variant.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 9,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'readiness_confirmed',
        key: 'floorSit',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'offer-and-receive',
    revisionId: 'offer-and-receive.draft-r1',
    language: 'cs',
    title: 'Nabídnout a přijmout',
    ageMonths: {
      fromInclusive: 9,
      toInclusive: 11,
    },
    readinessNotes: 'Vyžaduje potvrzenou připravenost: grasp, release.',
    environments: ['home'],
    materials: ['bezpečná kojenecká hračka'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      '`grasp`, `release`; bezpečná kojenecká hračka.',
      'Hračku nevytahujte z ruky; odmítnutí je přípustné.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Nabídněte otevřenou dlaň', 'Pokud dítě předá, přijměte', 'Nabídněte zpátky'],
    conversationPrompt: '„Děkuji. Chceš zpátky?“',
    primaryArea: 'autonomy',
    relatedAreas: [],
    topicIds: ['auto.release'],
    sources: [
      {
        label: 'UNICEF — 21 learning activities for babies and toddlers',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.unicef.org/parenting/child-care/21-learning-activities-babies-and-toddlers',
        supportsPrinciple:
          'vlastní aktivita dítěte, jednoduché střídání a hra s pečujícím. Nejde o převzetí celého seznamu ani jeho rizikovějších variant.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 9,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'readiness_confirmed',
        key: 'grasp',
      },
      {
        kind: 'readiness_confirmed',
        key: 'release',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'push-a-baby-car',
    revisionId: 'push-a-baby-car.draft-r1',
    language: 'cs',
    title: 'Autíčko se rozjede',
    ageMonths: {
      fromInclusive: 9,
      toInclusive: 11,
    },
    readinessNotes: 'Vyžaduje potvrzenou připravenost: grasp.',
    environments: ['home'],
    materials: ['velká nepoškozená pojízdná hračka určená kojencům'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      '`grasp`; velká nepoškozená pojízdná hračka určená kojencům.',
      'Bez odtržitelných koleček a nutnosti hračku honit.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Ukažte pomalé postrčení na podlaze', 'Vraťte hračku do dosahu', 'Nechte pokus'],
    conversationPrompt: '„Jede a zastaví.“',
    primaryArea: 'movement',
    relatedAreas: [],
    topicIds: ['move.reach'],
    sources: [
      {
        label: 'Seattle Children’s — Toys and Play: Birth to 12 Months',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.seattlechildrens.org/health-safety/parenting/toys-and-play-birth-to-12-months/',
        supportsPrinciple:
          'velké míče, manipulace s pojízdnými a mechanickými kojeneckými hračkami.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 9,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'readiness_confirmed',
        key: 'grasp',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'respond-to-pointing',
    revisionId: 'respond-to-pointing.draft-r1',
    language: 'cs',
    title: 'Odpovím na ukázání',
    ageMonths: {
      fromInclusive: 9,
      toInclusive: 11,
    },
    readinessNotes: 'Vyžaduje potvrzenou připravenost: gesture.',
    environments: ['home'],
    materials: ['společně prohlížená dětská knížka'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      '`gesture`; společně prohlížená dětská knížka.',
      'Nedělejte gesto jeho rukou a nevyžadujte další ukazování.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Všimněte si vlastního ukázání dítěte', 'Pojmenujte obrázek', 'Navazujte jeho zájem'],
    conversationPrompt: '„Ukazuješ na kočku.“',
    primaryArea: 'speech',
    relatedAreas: [],
    topicIds: ['speech.naming'],
    sources: [
      {
        label: 'AAP / HealthyChildren — How to Share Books With Your Baby',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.healthychildren.org/English/ages-stages/baby/Pages/how-to-share-books-with-your-baby.aspx',
        supportsPrinciple: 'sdílení knížek od nejútlejšího věku, dotyk a následování zájmu.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 9,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'readiness_confirmed',
        key: 'gesture',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'one-word-response',
    revisionId: 'one-word-response.draft-r1',
    language: 'cs',
    title: 'Jedno slovo navíc',
    ageMonths: {
      fromInclusive: 9,
      toInclusive: 11,
    },
    readinessNotes: 'Nevyžadujte první slovo ani neopravujte každý pokus.',
    environments: ['quiet'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Dítě samo hlasově naváže kontakt; bez pomůcek.',
      'Nevyžadujte první slovo ani neopravujte každý pokus.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Odpovězte na jeho zvuk', 'Přidejte krátké slovo podle situace', 'Počkejte'],
    conversationPrompt: '„Ba? Ano, balón.“',
    primaryArea: 'speech',
    relatedAreas: [],
    topicIds: ['speech.babble'],
    sources: [
      {
        label: 'NHS — Help your baby learn to talk',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.nhs.uk/baby/babys-development/play-and-learning/help-your-baby-learn-to-talk/',
        supportsPrinciple:
          'komentování činností, opakování zvuků, krátké věty a pojmenování skutečného zájmu.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 9,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
      {
        kind: 'materials_none',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'wave-and-word',
    revisionId: 'wave-and-word.draft-r1',
    language: 'cs',
    title: 'Krátké pá-pá',
    ageMonths: {
      fromInclusive: 9,
      toInclusive: 11,
    },
    readinessNotes: 'Mávejte sami, ne rukou dítěte; napodobení není podmínkou.',
    environments: ['quiet'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Dítě sleduje pečujícího, bez pomůcek.',
      'Mávejte sami, ne rukou dítěte; napodobení není podmínkou.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Řekněte „pá-pá“', 'Pomalu zamávejte svou rukou', 'Nechte prostor reakci'],
    conversationPrompt: '„Pá-pá.“',
    primaryArea: 'speech',
    relatedAreas: [],
    topicIds: ['speech.songs'],
    sources: [
      {
        label: 'Canadian Paediatric Society — Read, Speak, Sing, position statement',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://cps.ca/en/documents/position/read-speak-sing-promoting-literacy',
        supportsPrinciple:
          'vstřícná komunikace a rytmické společné interakce; podklad jazykového principu, ne přesného věku jednotlivého gesta.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 9,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
      {
        kind: 'materials_none',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'animal-picture-sound',
    revisionId: 'animal-picture-sound.draft-r1',
    language: 'cs',
    title: 'Zvířátko a jeho zvuk',
    ageMonths: {
      fromInclusive: 9,
      toInclusive: 11,
    },
    readinessNotes: 'Bez hlasitého lekání, nahrávek nebo požadavku zvuk zopakovat.',
    environments: ['quiet'],
    materials: ['Knížka s jedním dobře viditelným zvířetem'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Knížka s jedním dobře viditelným zvířetem.',
      'Bez hlasitého lekání, nahrávek nebo požadavku zvuk zopakovat.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Ukažte zvíře', 'Pojmenujte ho a přidejte jemný zvuk', 'Počkejte'],
    conversationPrompt: '„Kočka. Mňau.“',
    primaryArea: 'creationRhythm',
    relatedAreas: [],
    topicIds: ['create.voice-play'],
    sources: [
      {
        label: 'Canadian Paediatric Society — Read, Speak, Sing, position statement',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://cps.ca/en/documents/position/read-speak-sing-promoting-literacy',
        supportsPrinciple:
          'vstřícná komunikace a rytmické společné interakce; podklad jazykového principu, ne přesného věku jednotlivého gesta.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 9,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'answer-a-rhythm',
    revisionId: 'answer-a-rhythm.draft-r1',
    language: 'cs',
    title: 'Tvůj rytmus, moje odpověď',
    ageMonths: {
      fromInclusive: 9,
      toInclusive: 11,
    },
    readinessNotes: 'Bez držení rukou a zkoušení správného počtu úderů.',
    environments: ['home'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Dítě samo dělá bezpečné rytmické gesto; bez pomůcek.',
      'Bez držení rukou a zkoušení správného počtu úderů.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Všimněte si gesta', 'Krátce odpovězte stejným rytmem', 'Vyčkejte'],
    conversationPrompt: '„Slyším tvůj rytmus.“',
    primaryArea: 'creationRhythm',
    relatedAreas: [],
    topicIds: ['create.repeat'],
    sources: [
      {
        label: 'Canadian Paediatric Society — Read, Speak, Sing, position statement',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://cps.ca/en/documents/position/read-speak-sing-promoting-literacy',
        supportsPrinciple:
          'vstřícná komunikace a rytmické společné interakce; podklad jazykového principu, ne přesného věku jednotlivého gesta.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 9,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'materials_none',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'turn-a-board-page',
    revisionId: 'turn-a-board-page.draft-r1',
    language: 'cs',
    title: 'Otočím pevnou stránku',
    ageMonths: {
      fromInclusive: 9,
      toInclusive: 11,
    },
    readinessNotes: 'Vyžaduje potvrzenou připravenost: grasp.',
    environments: ['quiet'],
    materials: ['nepoškozené leporelo s velkými pevnými stránkami'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      '`grasp`; nepoškozené leporelo s velkými pevnými stránkami.',
      'Bez oddělitelných rohů a nucení jemného pinzetového úchopu.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Přidržte knihu', 'Nabídněte uvolněný okraj', 'Nechte vlastní otočení'],
    conversationPrompt: '„Další stránka.“',
    primaryArea: 'autonomy',
    relatedAreas: [],
    topicIds: ['auto.grasp'],
    sources: [
      {
        label: 'NCCA — Enjoying books with your baby, birth–18 months',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://ncca.ie/media/5615/enjoying-books-with-your-baby_ef-8.pdf',
        supportsPrinciple:
          'pevné a látkové knížky, známé obrazy, vlastní manipulace a opakované společné čtení.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 9,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
      {
        kind: 'readiness_confirmed',
        key: 'grasp',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'clear-caregiver-goodbye',
    revisionId: 'clear-caregiver-goodbye.draft-r1',
    language: 'cs',
    title: 'Srozumitelné krátké rozloučení',
    ageMonths: {
      fromInclusive: 9,
      toInclusive: 11,
    },
    readinessNotes: 'Nevytvářejte odloučení jako test a nenechávejte dítě samotné.',
    environments: ['home'],
    materials: ['Jeden známý pečující skutečně odchází; druhý zůstává s dítětem'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Jeden známý pečující skutečně odchází; druhý zůstává s dítětem.',
      'Nevytvářejte odloučení jako test a nenechávejte dítě samotné.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Krátce se rozlučte', 'Předejte potřebnou oporu', 'Při návratu se pozdravte'],
    conversationPrompt: '„Teď odcházím. Babička je s tebou.“',
    primaryArea: 'relationship',
    relatedAreas: [],
    topicIds: ['rel.comfort'],
    sources: [
      {
        label: 'CDC — Milestones by 9 Months, Tips and activities',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.cdc.gov/act-early/milestones/9-months.html',
        supportsPrinciple:
          'předávání, nádoby, vracení upuštěného předmětu a srozumitelné loučení se zachovanou oporou.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 9,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'familiar-object-picture',
    revisionId: 'familiar-object-picture.draft-r1',
    language: 'cs',
    title: 'Známá věc na obrázku',
    ageMonths: {
      fromInclusive: 9,
      toInclusive: 11,
    },
    readinessNotes: 'Nejde o zkoušení rozpoznání nebo slovní zásoby.',
    environments: ['quiet'],
    materials: ['Pevná knížka s běžnými předměty, například hrnkem'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Pevná knížka s běžnými předměty, například hrnkem.',
      'Nejde o zkoušení rozpoznání nebo slovní zásoby.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Ukažte známý obrázek', 'Připomeňte skutečnou věc', 'Nechte dítě určovat pokračování'],
    conversationPrompt: '„Hrnek, takový známe doma.“',
    primaryArea: 'attention',
    relatedAreas: [],
    topicIds: ['attn.shared'],
    sources: [
      {
        label: 'NCCA — Enjoying books with your baby, birth–18 months',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://ncca.ie/media/5615/enjoying-books-with-your-baby_ef-8.pdf',
        supportsPrinciple:
          'pevné a látkové knížky, známé obrazy, vlastní manipulace a opakované společné čtení.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 9,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'baby-safe-cause-effect',
    revisionId: 'baby-safe-cause-effect.draft-r1',
    language: 'cs',
    title: 'Stisknu a něco se změní',
    ageMonths: {
      fromInclusive: 9,
      toInclusive: 11,
    },
    readinessNotes: 'Vyžaduje potvrzenou připravenost: grasp.',
    environments: ['home'],
    materials: ['kojenecká mechanická hračka s velkým bezpečným prvkem'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      '`grasp`; kojenecká mechanická hračka s velkým bezpečným prvkem.',
      'Bez sevření prstů, přístupné baterie nebo hlasitého efektu.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Ukažte jedinou akci', 'Nabídněte hračku', 'Nechte samostatné zkoumání'],
    conversationPrompt: '„Stisk a otevřelo se.“',
    primaryArea: 'attention',
    relatedAreas: [],
    topicIds: ['attn.short-focus'],
    sources: [
      {
        label: 'Seattle Children’s — Toys and Play: Birth to 12 Months',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.seattlechildrens.org/health-safety/parenting/toys-and-play-birth-to-12-months/',
        supportsPrinciple:
          'velké míče, manipulace s pojízdnými a mechanickými kojeneckými hračkami.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 9,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'readiness_confirmed',
        key: 'grasp',
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'empty-and-full-bowl',
    revisionId: 'empty-and-full-bowl.draft-r1',
    language: 'cs',
    title: 'Prázdno a plno na pohled',
    ageMonths: {
      fromInclusive: 9,
      toInclusive: 11,
    },
    readinessNotes: 'Bez požadavku třídit, počítat nebo hledat správnou nádobu.',
    environments: ['home'],
    materials: ['Dvě široké misky a několik velkých bezpečných kojeneckých kostek'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Dvě široké misky a několik velkých bezpečných kojeneckých kostek.',
      'Bez požadavku třídit, počítat nebo hledat správnou nádobu.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Ukažte prázdnou misku', 'Druhou naplňte kostkami', 'Dovolte prozkoumat rozdíl'],
    conversationPrompt: '„Tady prázdno, tady jsou kostky.“',
    primaryArea: 'spaceQuantity',
    relatedAreas: [],
    topicIds: ['space.more-less'],
    sources: [
      {
        label: 'NHS — Baby and toddler play ideas',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.nhs.uk/baby/babys-development/play-and-learning/baby-and-toddler-play-ideas/',
        supportsPrinciple:
          'jednoduché materiály a manipulace. Srovnávání velikostí a prázdna je vlastní scénář, nikoli test matematické dovednosti.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 9,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'participating-in-dressing',
    revisionId: 'participating-in-dressing.draft-r1',
    language: 'cs',
    title: 'Moje ruka při oblékání',
    ageMonths: {
      fromInclusive: 9,
      toInclusive: 11,
    },
    readinessNotes: 'Nejde o cvičení paže; netahat za ruku a neprodlužovat nepohodu.',
    environments: ['home'],
    materials: ['Bezpečná poloha při péči, běžné pohodlné oblečení'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Bezpečná poloha při péči, běžné pohodlné oblečení.',
      'Nejde o cvičení paže; netahat za ruku a neprodlužovat nepohodu.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Ukažte otevřený rukáv', 'Vyčkejte na vlastní pohyb', 'Jemně dokončete oblékání'],
    conversationPrompt: '„Tady je rukáv.“',
    primaryArea: 'autonomy',
    relatedAreas: [],
    topicIds: ['auto.choice'],
    sources: [
      {
        label: 'NHS — How to keep your baby or toddler active',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.nhs.uk/baby/babys-development/play-and-learning/keep-baby-or-toddler-active/',
        supportsPrinciple:
          'volný pohyb a bezpečné prostředí. Oblékání je vlastní kontext pro dobrovolný pohyb, nikoli rehabilitační instrukce.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 9,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'book-ending-ritual',
    revisionId: 'book-ending-ritual.draft-r1',
    language: 'cs',
    title: 'Knížku spolu zavřeme',
    ageMonths: {
      fromInclusive: 9,
      toInclusive: 11,
    },
    readinessNotes: 'Dočtení není povinnost a konec nevytváří dluh.',
    environments: ['quiet'],
    materials: ['Známá dětská knížka, dítě dává najevo konec zájmu'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
      'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
      'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
      'Známá dětská knížka, dítě dává najevo konec zájmu.',
      'Dočtení není povinnost a konec nevytváří dluh.',
    ],
    duration: {
      kind: 'moment',
    },
    steps: ['Respektujte konec', 'Zavřete knížku', 'Přirozeně přejděte k další potřebě'],
    conversationPrompt: '„Pro dnešek hotovo.“',
    primaryArea: 'relationship',
    relatedAreas: [],
    topicIds: ['rel.comfort'],
    sources: [
      {
        label: 'Harvard — 5 Steps for Brain-Building Serve and Return',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://developingchild.harvard.edu/resources/handouts-tools/5-steps-for-brain-building-serve-and-return/',
        supportsPrinciple: 'následování zájmu, střídání, čekání a respektování konce interakce.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 9,
        toInclusive: 11,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
] as const satisfies readonly ActivityRevision[];
