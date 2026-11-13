/**
 * Published primary 5–8 catalog (completed months 60–95). Derived from draft-r1
 * after documented expert, language/UX and parent reviews on 2026-11-08.
 */
import type { ActivityRevision } from '../model/types';

export const PRIMARY_5_8_PUBLISHED_CONTENT_VERSION = 'primary-5-8.v1' as const;

export const PRIMARY_5_8_PUBLISHED_REVISIONS = [
  {
    activityId: 'primary-plan-with-two-choices',
    revisionId: 'primary-plan-with-two-choices.r1',
    language: 'cs',
    title: 'Plán se dvěma nápady',
    ageMonths: {
      fromInclusive: 60,
      toInclusive: 95,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Souhlas není vynucený; nepoužívat skutečný citlivý rodinný spor jako úkol.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Každý nabídne jednu bezpečnou společnou činnost',
      'Vyberte malou část obou nápadů nebo společně jeden z nich',
      'Domluvte se, že plán lze změnit',
    ],
    conversationPrompt: 'Jak se můžeme domluvit, aby měl každý prostor?',
    primaryArea: 'relationship',
    relatedAreas: [],
    topicIds: ['rel.cooperation'],
    activityFamilyId: 'family.primary-cooperation',
    sources: [
      {
        label: 'NAEYC — Play',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.naeyc.org/resources/topics/play',
        supportsPrinciple:
          'hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky.',
      },
      {
        label: 'Harvard Center on the Developing Child — Serve and Return',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://developingchild.harvard.edu/key-concept/serve-and-return/',
        supportsPrinciple:
          'citlivá odpověď dospělého na iniciativu dítěte. Nevyžaduje, aby dítě odpovídalo jedním předepsaným způsobem.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 60,
        toInclusive: 95,
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
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'Tomáš Holý',
          note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
          atMs: 1794127800000,
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'Alena Světlá',
          note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
          atMs: 1794138600000,
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'Barbora Bílá',
          note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
          atMs: 1794149400000,
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'redakce LUMI',
          note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
          atMs: 1794156600000,
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'primary-ordinary-object-story',
    revisionId: 'primary-ordinary-object-story.r1',
    language: 'cs',
    title: 'Příběh jedné obyčejné věci',
    ageMonths: {
      fromInclusive: 60,
      toInclusive: 95,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['jeden velký bezpečný běžný předmět'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Nevyžaduje čtení ani psaní; vlastní odpověď není chyba.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Dítě vybere předmět a vymyslí mu roli v příběhu',
      'Společně přidejte jednu situaci a změnu',
      'Dítě zvolí konec, obrázek nebo pauzu',
    ],
    conversationPrompt: 'Kdyby ta věc mohla vyprávět, co by řekla?',
    primaryArea: 'speech',
    relatedAreas: [],
    topicIds: ['speech.storytelling'],
    activityFamilyId: 'family.primary-story',
    sources: [
      {
        label: 'Harvard Center on the Developing Child — Serve and Return',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://developingchild.harvard.edu/key-concept/serve-and-return/',
        supportsPrinciple:
          'citlivá odpověď dospělého na iniciativu dítěte. Nevyžaduje, aby dítě odpovídalo jedním předepsaným způsobem.',
      },
      {
        label: 'NAEYC — Everyday Steps to Reading and Writing',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.naeyc.org/our-work/families/everyday-steps-reading-and-writing',
        supportsPrinciple:
          'význam čtení, vyprávění a smysluplného používání jazyka doma. Nejde o povinný termín samostatného čtení.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 60,
        toInclusive: 95,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'materials_all_of',
        materials: ['jeden velký bezpečný běžný předmět'],
      },
    ],
    editorial: {
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'Tomáš Holý',
          note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
          atMs: 1794127800000,
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'Alena Světlá',
          note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
          atMs: 1794138600000,
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'Barbora Bílá',
          note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
          atMs: 1794149400000,
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'redakce LUMI',
          note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
          atMs: 1794156600000,
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'primary-own-move-sequence',
    revisionId: 'primary-own-move-sequence.r1',
    language: 'cs',
    title: 'Moje krátká pohybová sestava',
    ageMonths: {
      fromInclusive: 60,
      toInclusive: 95,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Bez akrobacie, výkonového měření nebo pohybu přes bolest; lze provést pažemi vsedě.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Vyberte dva nebo tři pohodlné osvojené pohyby',
      'Dítě je uspořádá a dospělý zkusí následovat',
      'Změňte jeden pohyb nebo skončete',
    ],
    conversationPrompt: 'Jaký pohyb patří podle tebe na začátek?',
    primaryArea: 'movement',
    relatedAreas: [],
    topicIds: ['move.sequence'],
    activityFamilyId: 'family.primary-movement',
    sources: [
      {
        label: 'NAEYC — Play',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.naeyc.org/resources/topics/play',
        supportsPrinciple:
          'hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky.',
      },
      {
        label: "Royal Children's Hospital — Toy safety",
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.rch.org.au/kidsinfo/fact_sheets/Toy_safety/',
        supportsPrinciple:
          'bezpečnost a věkové určení pomůcek. Slouží jako podklad pro kontrolu rizik; nenahrazuje posouzení každého materiálu a situace.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 60,
        toInclusive: 95,
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
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'Tomáš Holý',
          note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
          atMs: 1794127800000,
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'Alena Světlá',
          note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
          atMs: 1794138600000,
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'Barbora Bílá',
          note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
          atMs: 1794149400000,
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'redakce LUMI',
          note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
          atMs: 1794156600000,
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'primary-sound-map-on-paper',
    revisionId: 'primary-sound-map-on-paper.r1',
    language: 'cs',
    title: 'Zvuková mapa na papíře',
    ageMonths: {
      fromInclusive: 60,
      toInclusive: 95,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['quiet'],
    materials: ['papír a kreslicí pomůcka', 'dospělý může zapisovat'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Žádné nahrávání zvuku, přesná poloha ani vyhledávání hlasitých zdrojů.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Na bezpečném místě chvíli poslouchejte běžné okolí',
      'Nakreslete symbol jednoho zvuku a odkud přibližně přicházel',
      'Porovnejte vlastní vjemy bez hledání správné odpovědi',
    ],
    conversationPrompt: 'Co jsi zaznamenal/a a jak bys to označil/a?',
    primaryArea: 'senses',
    relatedAreas: [],
    topicIds: ['sense.sound'],
    activityFamilyId: null,
    sources: [
      {
        label: 'NAEYC — Play',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.naeyc.org/resources/topics/play',
        supportsPrinciple:
          'hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky.',
      },
      {
        label: "Royal Children's Hospital — Toy safety",
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.rch.org.au/kidsinfo/fact_sheets/Toy_safety/',
        supportsPrinciple:
          'bezpečnost a věkové určení pomůcek. Slouží jako podklad pro kontrolu rizik; nenahrazuje posouzení každého materiálu a situace.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 60,
        toInclusive: 95,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['quiet'],
      },
      {
        kind: 'materials_all_of',
        materials: ['papír a kreslicí pomůcka', 'dospělý může zapisovat'],
      },
    ],
    editorial: {
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'Tomáš Holý',
          note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
          atMs: 1794127800000,
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'Alena Světlá',
          note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
          atMs: 1794138600000,
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'Barbora Bílá',
          note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
          atMs: 1794149400000,
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'redakce LUMI',
          note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
          atMs: 1794156600000,
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'primary-two-step-plan',
    revisionId: 'primary-two-step-plan.r1',
    language: 'cs',
    title: 'Nejdřív nápad, potom pokus',
    ageMonths: {
      fromInclusive: 60,
      toInclusive: 95,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['velké věkově vhodné kostky'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Bez požadavku plán dokončit; změna není selhání.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 10,
    },
    steps: [
      'Dítě si vybere, co malého chce postavit',
      'Řekne nebo ukáže první dva kroky a vyzkouší je',
      'Krátce nabídněte, co chce příště změnit',
    ],
    conversationPrompt: 'Chceš svůj plán nechat, nebo upravit?',
    primaryArea: 'attention',
    relatedAreas: [],
    topicIds: ['attn.plan-reflect'],
    activityFamilyId: 'family.primary-plan',
    sources: [
      {
        label: 'NAEYC — Play',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.naeyc.org/resources/topics/play',
        supportsPrinciple:
          'hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky.',
      },
      {
        label: 'EEF — Metacognition and self-regulation',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/metacognition-and-self-Regulation',
        supportsPrinciple:
          'plánování, průběžná úprava a reflexe v konkrétní činnosti. Školní důkazy nepřenášet jako měřený účinek na batolata nebo na naši aplikaci.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 60,
        toInclusive: 95,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'materials_all_of',
        materials: ['velké věkově vhodné kostky'],
      },
    ],
    editorial: {
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'Tomáš Holý',
          note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
          atMs: 1794127800000,
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'Alena Světlá',
          note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
          atMs: 1794138600000,
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'Barbora Bílá',
          note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
          atMs: 1794149400000,
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'redakce LUMI',
          note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
          atMs: 1794156600000,
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'primary-measure-with-paper-strip',
    revisionId: 'primary-measure-with-paper-strip.r1',
    language: 'cs',
    title: 'Měříme vlastním proužkem',
    ageMonths: {
      fromInclusive: 60,
      toInclusive: 95,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['velké předem připravené papírové proužky a bezpečný malý předmět'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Bez nůžek v tomto postupu, omotávání těla nebo přístupu k nebezpečným předmětům.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 10,
    },
    steps: [
      'Dospělý připraví několik stejně dlouhých proužků',
      'Dítě je přikládá podél předmětu bez šplhání',
      'Povídejte si o mezerách a o tom, co srovnání mění',
    ],
    conversationPrompt: 'Jak poznáme, že měříme podobně?',
    primaryArea: 'spaceQuantity',
    relatedAreas: [],
    topicIds: ['space.measure'],
    activityFamilyId: 'family.primary-quantity',
    sources: [
      {
        label: 'NAEYC — Articles for Families on Math',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.naeyc.org/our-work/families/math',
        supportsPrinciple:
          'množství, třídění, prostor a měření v běžném prostředí. Není důkazem, že náš věkový filtr vyhovuje konkrétnímu dítěti.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 60,
        toInclusive: 95,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'materials_all_of',
        materials: ['velké předem připravené papírové proužky a bezpečný malý předmět'],
      },
    ],
    editorial: {
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'Tomáš Holý',
          note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
          atMs: 1794127800000,
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'Alena Světlá',
          note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
          atMs: 1794138600000,
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'Barbora Bílá',
          note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
          atMs: 1794149400000,
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'redakce LUMI',
          note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
          atMs: 1794156600000,
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'primary-three-panel-comic',
    revisionId: 'primary-three-panel-comic.r1',
    language: 'cs',
    title: 'Komiks ve třech polích',
    ageMonths: {
      fromInclusive: 60,
      toInclusive: 95,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['papír a bezpečné kreslicí pomůcky'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Pravopis a kreslířská přesnost se nehodnotí; žádná povinná fotografie.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 10,
    },
    steps: [
      'Dospělý může připravit tři velká pole',
      'Dítě nakreslí událost, změnu a libovolné pokračování',
      'Text může nadiktovat dospělému nebo jej vynechat',
    ],
    conversationPrompt: 'Který obrázek chceš ukázat jako první?',
    primaryArea: 'creationRhythm',
    relatedAreas: [],
    topicIds: ['create.story-art'],
    activityFamilyId: 'family.primary-story',
    sources: [
      {
        label: 'NAEYC — Play',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.naeyc.org/resources/topics/play',
        supportsPrinciple:
          'hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 60,
        toInclusive: 95,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'materials_all_of',
        materials: ['papír a bezpečné kreslicí pomůcky'],
      },
    ],
    editorial: {
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'Tomáš Holý',
          note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
          atMs: 1794127800000,
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'Alena Světlá',
          note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
          atMs: 1794138600000,
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'Barbora Bílá',
          note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
          atMs: 1794149400000,
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'redakce LUMI',
          note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
          atMs: 1794156600000,
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'primary-prepare-my-work-place',
    revisionId: 'primary-prepare-my-work-place.r1',
    language: 'cs',
    title: 'Připravím si místo',
    ageMonths: {
      fromInclusive: 60,
      toInclusive: 95,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['bezpečné pomůcky vybrané činnosti'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Bez manipulace s elektrickými zařízeními či těžkým nábytkem; dospělý nese odpovědnost za bezpečí.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Dospělý ověří vhodnou pracovní plochu a pomůcky',
      'Dítě vybere dvě nebo tři věci, které chce mít po ruce',
      'Po činnosti nabídněte společné odložení',
    ],
    conversationPrompt: 'Co ti pomůže, aby se ti tu dobře tvořilo?',
    primaryArea: 'autonomy',
    relatedAreas: [],
    topicIds: ['auto.routine'],
    activityFamilyId: null,
    sources: [
      {
        label: 'EEF — Metacognition and self-regulation',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/metacognition-and-self-Regulation',
        supportsPrinciple:
          'plánování, průběžná úprava a reflexe v konkrétní činnosti. Školní důkazy nepřenášet jako měřený účinek na batolata nebo na naši aplikaci.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 60,
        toInclusive: 95,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'materials_all_of',
        materials: ['bezpečné pomůcky vybrané činnosti'],
      },
    ],
    editorial: {
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'Tomáš Holý',
          note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
          atMs: 1794127800000,
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'Alena Světlá',
          note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
          atMs: 1794138600000,
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'Barbora Bílá',
          note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
          atMs: 1794149400000,
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'redakce LUMI',
          note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
          atMs: 1794156600000,
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'primary-explain-with-role-swap',
    revisionId: 'primary-explain-with-role-swap.r1',
    language: 'cs',
    title: 'Vysvětlíme si dva pohledy',
    ageMonths: {
      fromInclusive: 72,
      toInclusive: 95,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Nezkoušet empatii na skutečné traumatické situaci; dítě může odmítnout roli.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Vymyslete dvě postavy s odlišným nápadem',
      'Každý zkusí vysvětlit jeden pohled a pak si role vyměňte',
      'Hledejte, čemu by oba mohli rozumět',
    ],
    conversationPrompt: 'Co je pro tuhle postavu důležité?',
    primaryArea: 'relationship',
    relatedAreas: [],
    topicIds: ['rel.perspective'],
    activityFamilyId: 'family.primary-cooperation',
    sources: [
      {
        label: 'NAEYC — Play',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.naeyc.org/resources/topics/play',
        supportsPrinciple:
          'hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky.',
      },
      {
        label: 'Harvard Center on the Developing Child — Serve and Return',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://developingchild.harvard.edu/key-concept/serve-and-return/',
        supportsPrinciple:
          'citlivá odpověď dospělého na iniciativu dítěte. Nevyžaduje, aby dítě odpovídalo jedním předepsaným způsobem.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 72,
        toInclusive: 95,
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
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'Tomáš Holý',
          note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
          atMs: 1794127800000,
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'Alena Světlá',
          note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
          atMs: 1794138600000,
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'Barbora Bílá',
          note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
          atMs: 1794149400000,
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'redakce LUMI',
          note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
          atMs: 1794156600000,
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'primary-two-story-versions',
    revisionId: 'primary-two-story-versions.r1',
    language: 'cs',
    title: 'Dvě verze jednoho příběhu',
    ageMonths: {
      fromInclusive: 72,
      toInclusive: 95,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['dva krátké vlastní příběhy nebo obrázkové varianty'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Čtení dospělým je plnohodnotná cesta; bez testu paměti nebo slovní zásoby.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Dospělý přečte nebo převypráví obě krátké verze',
      'Dítě vybere jednu podobnost nebo rozdíl',
      'Vytvořte třetí možnost, pokud chce',
    ],
    conversationPrompt: 'Co se změnilo a které pokračování by sis vybral/a?',
    primaryArea: 'speech',
    relatedAreas: [],
    topicIds: ['speech.storytelling'],
    activityFamilyId: 'family.primary-story',
    sources: [
      {
        label: 'Harvard Center on the Developing Child — Serve and Return',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://developingchild.harvard.edu/key-concept/serve-and-return/',
        supportsPrinciple:
          'citlivá odpověď dospělého na iniciativu dítěte. Nevyžaduje, aby dítě odpovídalo jedním předepsaným způsobem.',
      },
      {
        label: 'NAEYC — Everyday Steps to Reading and Writing',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.naeyc.org/our-work/families/everyday-steps-reading-and-writing',
        supportsPrinciple:
          'význam čtení, vyprávění a smysluplného používání jazyka doma. Nejde o povinný termín samostatného čtení.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 72,
        toInclusive: 95,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'materials_all_of',
        materials: ['dva krátké vlastní příběhy nebo obrázkové varianty'],
      },
    ],
    editorial: {
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'Tomáš Holý',
          note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
          atMs: 1794127800000,
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'Alena Světlá',
          note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
          atMs: 1794138600000,
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'Barbora Bílá',
          note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
          atMs: 1794149400000,
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'redakce LUMI',
          note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
          atMs: 1794156600000,
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'primary-together-ball-route',
    revisionId: 'primary-together-ball-route.r1',
    language: 'cs',
    title: 'Společná cesta míče',
    ageMonths: {
      fromInclusive: 72,
      toInclusive: 95,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['velký měkký míč', 'volný bezpečný prostor'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Bez soutěže, překážek a házení na člověka; dohled a bezpečný dosah.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Zvolte krátkou pomalou trasu po podlaze',
      'Střídejte se v jemném posunutí míče',
      'Dohodněte změnu, která bude oběma pohodlná',
    ],
    conversationPrompt: 'Jak ho pošleme dál společně?',
    primaryArea: 'movement',
    relatedAreas: [],
    topicIds: ['move.coordination'],
    activityFamilyId: 'family.primary-movement',
    sources: [
      {
        label: 'NAEYC — Play',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.naeyc.org/resources/topics/play',
        supportsPrinciple:
          'hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky.',
      },
      {
        label: "Royal Children's Hospital — Toy safety",
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.rch.org.au/kidsinfo/fact_sheets/Toy_safety/',
        supportsPrinciple:
          'bezpečnost a věkové určení pomůcek. Slouží jako podklad pro kontrolu rizik; nenahrazuje posouzení každého materiálu a situace.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 72,
        toInclusive: 95,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'materials_all_of',
        materials: ['velký měkký míč', 'volný bezpečný prostor'],
      },
    ],
    editorial: {
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'Tomáš Holý',
          note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
          atMs: 1794127800000,
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'Alena Světlá',
          note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
          atMs: 1794138600000,
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'Barbora Bílá',
          note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
          atMs: 1794149400000,
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'redakce LUMI',
          note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
          atMs: 1794156600000,
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'primary-plant-observation-page',
    revisionId: 'primary-plant-observation-page.r1',
    language: 'cs',
    title: 'Stránka o známé rostlině',
    ageMonths: {
      fromInclusive: 72,
      toInclusive: 95,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['dospělým ověřená bezpečná rostlina', 'papír'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Neznámých rostlin, zeminy a chemických přípravků se nedotýkat; žádná povinná denní péče.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Prohlédněte si jednu viditelnou část bez ochutnávání',
      'Dítě zakreslí, co vidí, nebo to popíše dospělému',
      'Jindy lze dobrovolně porovnat nový pohled',
    ],
    conversationPrompt: 'Co vidíš dnes a co si zatím jen myslíš?',
    primaryArea: 'senses',
    relatedAreas: [],
    topicIds: ['sense.observe'],
    activityFamilyId: 'family.primary-observe',
    sources: [
      {
        label: 'NAEYC — Play',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.naeyc.org/resources/topics/play',
        supportsPrinciple:
          'hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky.',
      },
      {
        label: "Royal Children's Hospital — Toy safety",
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.rch.org.au/kidsinfo/fact_sheets/Toy_safety/',
        supportsPrinciple:
          'bezpečnost a věkové určení pomůcek. Slouží jako podklad pro kontrolu rizik; nenahrazuje posouzení každého materiálu a situace.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 72,
        toInclusive: 95,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'materials_all_of',
        materials: ['dospělým ověřená bezpečná rostlina', 'papír'],
      },
    ],
    editorial: {
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'Tomáš Holý',
          note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
          atMs: 1794127800000,
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'Alena Světlá',
          note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
          atMs: 1794138600000,
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'Barbora Bílá',
          note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
          atMs: 1794149400000,
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'redakce LUMI',
          note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
          atMs: 1794156600000,
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'primary-question-for-paper-bridge',
    revisionId: 'primary-question-for-paper-bridge.r1',
    language: 'cs',
    title: 'Otázka pro papírový most',
    ageMonths: {
      fromInclusive: 72,
      toInclusive: 95,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['papír a dvě nízké stabilní podpěry bez ostrých hran'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Pouze stolní/podlahový model, nikdy most pro tělo; žádné ostré hrany nebo slib nosnosti.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 10,
    },
    steps: [
      'Zeptejte se, zda se rovný a přeložený papír prohne stejně',
      'Dospělý připraví nízké podpěry a dítě vybere tvar papíru',
      'Porovnejte bez zatěžování těžkým předmětem',
    ],
    conversationPrompt: 'Co jsme změnili a co zůstalo podobné?',
    primaryArea: 'attention',
    relatedAreas: [],
    topicIds: ['attn.change-test'],
    activityFamilyId: 'family.primary-change',
    sources: [
      {
        label: 'NAEYC — Play',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.naeyc.org/resources/topics/play',
        supportsPrinciple:
          'hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky.',
      },
      {
        label: 'EEF — Metacognition and self-regulation',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/metacognition-and-self-Regulation',
        supportsPrinciple:
          'plánování, průběžná úprava a reflexe v konkrétní činnosti. Školní důkazy nepřenášet jako měřený účinek na batolata nebo na naši aplikaci.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 72,
        toInclusive: 95,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'materials_all_of',
        materials: ['papír a dvě nízké stabilní podpěry bez ostrých hran'],
      },
    ],
    editorial: {
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'Tomáš Holý',
          note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
          atMs: 1794127800000,
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'Alena Světlá',
          note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
          atMs: 1794138600000,
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'Barbora Bílá',
          note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
          atMs: 1794149400000,
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'redakce LUMI',
          note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
          atMs: 1794156600000,
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'primary-same-amount-new-layout',
    revisionId: 'primary-same-amount-new-layout.r1',
    language: 'cs',
    title: 'Stejné kostky, jiné uspořádání',
    ageMonths: {
      fromInclusive: 72,
      toInclusive: 95,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['šest velkých bezpečných kostek'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Bez zkoušky správného počtu; upravit množství podle zájmu, ne podle normy.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 10,
    },
    steps: [
      'Rozložte stejné kostky do dvou různých uspořádání',
      'Dítě je může přesunout, porovnat nebo spárovat',
      'Povídejte si o tom, co je stejné a co jiné',
    ],
    conversationPrompt: 'Změnilo se něco kromě jejich místa?',
    primaryArea: 'spaceQuantity',
    relatedAreas: [],
    topicIds: ['space.grouping'],
    activityFamilyId: 'family.primary-quantity',
    sources: [
      {
        label: 'NAEYC — Articles for Families on Math',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.naeyc.org/our-work/families/math',
        supportsPrinciple:
          'množství, třídění, prostor a měření v běžném prostředí. Není důkazem, že náš věkový filtr vyhovuje konkrétnímu dítěti.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 72,
        toInclusive: 95,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'materials_all_of',
        materials: ['šest velkých bezpečných kostek'],
      },
    ],
    editorial: {
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'Tomáš Holý',
          note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
          atMs: 1794127800000,
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'Alena Světlá',
          note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
          atMs: 1794138600000,
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'Barbora Bílá',
          note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
          atMs: 1794149400000,
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'redakce LUMI',
          note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
          atMs: 1794156600000,
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'primary-create-and-change-pattern',
    revisionId: 'primary-create-and-change-pattern.r1',
    language: 'cs',
    title: 'Vzor, který mohu změnit',
    ageMonths: {
      fromInclusive: 72,
      toInclusive: 95,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['papír a dvě bezpečné barvy nebo jen vlastní dlaně'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Žádné jediné správné pokračování nebo povinné čtení písmen.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 10,
    },
    steps: [
      'Dítě vytvoří krátký opakující se motiv',
      'Dospělý požádá o ukázání jeho pokračování',
      'Změňte jedno místo a vymyslete nový motiv',
    ],
    conversationPrompt: 'Jak by zněl nebo vypadal tvůj další vzor?',
    primaryArea: 'creationRhythm',
    relatedAreas: [],
    topicIds: ['create.repeat'],
    activityFamilyId: 'family.primary-change',
    sources: [
      {
        label: 'NAEYC — Play',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.naeyc.org/resources/topics/play',
        supportsPrinciple:
          'hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 72,
        toInclusive: 95,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'materials_all_of',
        materials: ['papír a dvě bezpečné barvy nebo jen vlastní dlaně'],
      },
    ],
    editorial: {
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'Tomáš Holý',
          note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
          atMs: 1794127800000,
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'Alena Světlá',
          note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
          atMs: 1794138600000,
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'Barbora Bílá',
          note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
          atMs: 1794149400000,
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'redakce LUMI',
          note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
          atMs: 1794156600000,
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'primary-choose-next-small-session',
    revisionId: 'primary-choose-next-small-session.r1',
    language: 'cs',
    title: 'Vyberu si další malou chvíli',
    ageMonths: {
      fromInclusive: 72,
      toInclusive: 95,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Žádný streak, sankce za odložení nebo přenesení dospělé odpovědnosti.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Dítě vybere drobnou činnost a potřebnou pomoc',
      'Domluvte jeden blízký vhodný okamžik bez budíku v aplikaci',
      'Při změně zájmu plán upravte nebo zrušte',
    ],
    conversationPrompt: 'Co bys chtěl/a zkusit a kdo ti má být nablízku?',
    primaryArea: 'autonomy',
    relatedAreas: [],
    topicIds: ['auto.plan-choice'],
    activityFamilyId: 'family.primary-plan',
    sources: [
      {
        label: 'EEF — Metacognition and self-regulation',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/metacognition-and-self-Regulation',
        supportsPrinciple:
          'plánování, průběžná úprava a reflexe v konkrétní činnosti. Školní důkazy nepřenášet jako měřený účinek na batolata nebo na naši aplikaci.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 72,
        toInclusive: 95,
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
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'Tomáš Holý',
          note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
          atMs: 1794127800000,
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'Alena Světlá',
          note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
          atMs: 1794138600000,
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'Barbora Bílá',
          note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
          atMs: 1794149400000,
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'redakce LUMI',
          note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
          atMs: 1794156600000,
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'primary-opinion-and-reason',
    revisionId: 'primary-opinion-and-reason.r1',
    language: 'cs',
    title: 'Nápad a jeden důvod',
    ageMonths: {
      fromInclusive: 84,
      toInclusive: 95,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Nehodnotit osobnost podle názoru; skutečný citlivý konflikt není cvičení.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Každý navrhne jednu bezpečnou podobu smyšleného místa',
      'Přidá důvod, pokud chce',
      'Společně vyberte, co by se dalo spojit',
    ],
    conversationPrompt: 'Co se ti na tom líbí a co bys změnil/a?',
    primaryArea: 'relationship',
    relatedAreas: [],
    topicIds: ['rel.cooperation'],
    activityFamilyId: 'family.primary-cooperation',
    sources: [
      {
        label: 'NAEYC — Play',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.naeyc.org/resources/topics/play',
        supportsPrinciple:
          'hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky.',
      },
      {
        label: 'Harvard Center on the Developing Child — Serve and Return',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://developingchild.harvard.edu/key-concept/serve-and-return/',
        supportsPrinciple:
          'citlivá odpověď dospělého na iniciativu dítěte. Nevyžaduje, aby dítě odpovídalo jedním předepsaným způsobem.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 84,
        toInclusive: 95,
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
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'Tomáš Holý',
          note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
          atMs: 1794127800000,
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'Alena Světlá',
          note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
          atMs: 1794138600000,
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'Barbora Bílá',
          note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
          atMs: 1794149400000,
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'redakce LUMI',
          note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
          atMs: 1794156600000,
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'primary-instructions-for-builder',
    revisionId: 'primary-instructions-for-builder.r1',
    language: 'cs',
    title: 'Návod pro druhého stavitele',
    ageMonths: {
      fromInclusive: 84,
      toInclusive: 95,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['velké bezpečné kostky'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Bez zesměšňování nejasného návodu; programování je zde myšlenka postupu, žádný kód ke spuštění.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Dítě si zvolí malou stavbu a popíše první krok',
      'Dospělý postupuje podle popisu a doptá se',
      'Dítě může návod upravit nebo ukázat jinak',
    ],
    conversationPrompt: 'Co mám udělat nejdřív a co mám vědět dál?',
    primaryArea: 'speech',
    relatedAreas: [],
    topicIds: ['speech.instructions'],
    activityFamilyId: null,
    sources: [
      {
        label: 'Harvard Center on the Developing Child — Serve and Return',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://developingchild.harvard.edu/key-concept/serve-and-return/',
        supportsPrinciple:
          'citlivá odpověď dospělého na iniciativu dítěte. Nevyžaduje, aby dítě odpovídalo jedním předepsaným způsobem.',
      },
      {
        label: 'NAEYC — Everyday Steps to Reading and Writing',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.naeyc.org/our-work/families/everyday-steps-reading-and-writing',
        supportsPrinciple:
          'význam čtení, vyprávění a smysluplného používání jazyka doma. Nejde o povinný termín samostatného čtení.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 84,
        toInclusive: 95,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'materials_all_of',
        materials: ['velké bezpečné kostky'],
      },
    ],
    editorial: {
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'Tomáš Holý',
          note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
          atMs: 1794127800000,
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'Alena Světlá',
          note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
          atMs: 1794138600000,
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'Barbora Bílá',
          note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
          atMs: 1794149400000,
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'redakce LUMI',
          note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
          atMs: 1794156600000,
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'primary-route-by-own-plan',
    revisionId: 'primary-route-by-own-plan.r1',
    language: 'cs',
    title: 'Cesta podle vlastního plánu',
    ageMonths: {
      fromInclusive: 84,
      toInclusive: 95,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['papír s jednoduchými šipkami', 'bezpečný volný prostor'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Bez zavřených očí, lezení, provozu a soutěžení; papírová varianta je rovnocenná.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Dítě navrhne dva nebo tři malé pohyby či směry',
      'Dospělý ověří proveditelnost v prostoru',
      'Zkuste plán nebo jej ukažte rukou na papíře',
    ],
    conversationPrompt: 'Kde svůj plán změníš, aby ti byl příjemný?',
    primaryArea: 'movement',
    relatedAreas: [],
    topicIds: ['move.sequence'],
    activityFamilyId: 'family.primary-movement',
    sources: [
      {
        label: 'NAEYC — Play',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.naeyc.org/resources/topics/play',
        supportsPrinciple:
          'hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky.',
      },
      {
        label: "Royal Children's Hospital — Toy safety",
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.rch.org.au/kidsinfo/fact_sheets/Toy_safety/',
        supportsPrinciple:
          'bezpečnost a věkové určení pomůcek. Slouží jako podklad pro kontrolu rizik; nenahrazuje posouzení každého materiálu a situace.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 84,
        toInclusive: 95,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'materials_all_of',
        materials: ['papír s jednoduchými šipkami', 'bezpečný volný prostor'],
      },
    ],
    editorial: {
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'Tomáš Holý',
          note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
          atMs: 1794127800000,
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'Alena Světlá',
          note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
          atMs: 1794138600000,
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'Barbora Bílá',
          note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
          atMs: 1794149400000,
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'redakce LUMI',
          note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
          atMs: 1794156600000,
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'primary-see-and-infer',
    revisionId: 'primary-see-and-infer.r1',
    language: 'cs',
    title: 'Co vidím a co odhaduji',
    ageMonths: {
      fromInclusive: 84,
      toInclusive: 95,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['velký bezpečný běžný předmět'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Nevyšetřovat tělo, lidi ani citlivé soukromé věci; nejistota je přijatelná.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Dítě popíše nebo ukáže jednu přímo viditelnou vlastnost',
      'Společně odlište odhad o předmětu od pozorování',
      'Navrhněte bezpečný způsob, jak se zeptat nebo ověřit',
    ],
    conversationPrompt: 'Co opravdu vidíme a co zatím nevíme?',
    primaryArea: 'senses',
    relatedAreas: [],
    topicIds: ['sense.observe'],
    activityFamilyId: 'family.primary-observe',
    sources: [
      {
        label: 'NAEYC — Play',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.naeyc.org/resources/topics/play',
        supportsPrinciple:
          'hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky.',
      },
      {
        label: "Royal Children's Hospital — Toy safety",
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.rch.org.au/kidsinfo/fact_sheets/Toy_safety/',
        supportsPrinciple:
          'bezpečnost a věkové určení pomůcek. Slouží jako podklad pro kontrolu rizik; nenahrazuje posouzení každého materiálu a situace.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 84,
        toInclusive: 95,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'materials_all_of',
        materials: ['velký bezpečný běžný předmět'],
      },
    ],
    editorial: {
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'Tomáš Holý',
          note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
          atMs: 1794127800000,
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'Alena Světlá',
          note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
          atMs: 1794138600000,
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'Barbora Bílá',
          note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
          atMs: 1794149400000,
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'redakce LUMI',
          note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
          atMs: 1794156600000,
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'primary-one-change-two-attempts',
    revisionId: 'primary-one-change-two-attempts.r1',
    language: 'cs',
    title: 'Dva pokusy, jedna změna',
    ageMonths: {
      fromInclusive: 84,
      toInclusive: 95,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['velké lehké papírové listy a stabilní podložka'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Žádný test nosnosti člověkem, lezení, závod nebo tvrzení, že jeden pokus dokazuje zákon.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 10,
    },
    steps: [
      'Dítě vybere dva tvary skládání nízké papírové konstrukce',
      'Změní jen jednu zvolenou vlastnost a oba modely pozoruje',
      'Zaznamená náčrt, slovo nebo nic podle chuti',
    ],
    conversationPrompt: 'Kterou změnu chceme porovnat tentokrát?',
    primaryArea: 'attention',
    relatedAreas: [],
    topicIds: ['attn.change-test'],
    activityFamilyId: 'family.primary-change',
    sources: [
      {
        label: 'NAEYC — Play',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.naeyc.org/resources/topics/play',
        supportsPrinciple:
          'hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky.',
      },
      {
        label: 'EEF — Metacognition and self-regulation',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/metacognition-and-self-Regulation',
        supportsPrinciple:
          'plánování, průběžná úprava a reflexe v konkrétní činnosti. Školní důkazy nepřenášet jako měřený účinek na batolata nebo na naši aplikaci.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 84,
        toInclusive: 95,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'materials_all_of',
        materials: ['velké lehké papírové listy a stabilní podložka'],
      },
    ],
    editorial: {
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'Tomáš Holý',
          note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
          atMs: 1794127800000,
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'Alena Světlá',
          note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
          atMs: 1794138600000,
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'Barbora Bílá',
          note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
          atMs: 1794149400000,
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'redakce LUMI',
          note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
          atMs: 1794156600000,
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'primary-share-into-groups',
    revisionId: 'primary-share-into-groups.r1',
    language: 'cs',
    title: 'Rozdělení do vlastních skupin',
    ageMonths: {
      fromInclusive: 84,
      toInclusive: 95,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['několik velkých bezpečných kostek'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Bez povinného matematického zápisu nebo bodování; nejde o rozdělování skutečných odměn.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 10,
    },
    steps: [
      'Dítě zvolí počet skupin a rozloží kostky',
      'Porovnejte možnosti stejného i různého rozdělení',
      'Zbytek lze nechat stranou a pojmenovat',
    ],
    conversationPrompt: 'Jak by to šlo rozdělit jiným způsobem?',
    primaryArea: 'spaceQuantity',
    relatedAreas: [],
    topicIds: ['space.grouping'],
    activityFamilyId: 'family.primary-quantity',
    sources: [
      {
        label: 'NAEYC — Articles for Families on Math',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.naeyc.org/our-work/families/math',
        supportsPrinciple:
          'množství, třídění, prostor a měření v běžném prostředí. Není důkazem, že náš věkový filtr vyhovuje konkrétnímu dítěti.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 84,
        toInclusive: 95,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'materials_all_of',
        materials: ['několik velkých bezpečných kostek'],
      },
    ],
    editorial: {
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'Tomáš Holý',
          note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
          atMs: 1794127800000,
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'Alena Světlá',
          note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
          atMs: 1794138600000,
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'Barbora Bílá',
          note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
          atMs: 1794149400000,
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'redakce LUMI',
          note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
          atMs: 1794156600000,
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'primary-small-book-own-topic',
    revisionId: 'primary-small-book-own-topic.r1',
    language: 'cs',
    title: 'Moje malá kniha',
    ageMonths: {
      fromInclusive: 84,
      toInclusive: 95,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['papír a bezpečné kreslicí pomůcky'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Rozlišit fantazii od tvrzení o skutečnosti; nepřebírat cizí fotky a nevyžadovat sdílení.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 10,
    },
    steps: [
      'Dítě si vybere téma z vlastního pozorování nebo fantazie',
      'Vytvoří dvě či tři stránky obrázkem a volitelným textem',
      'Zvolí název a zda knihu někomu ukáže',
    ],
    conversationPrompt: 'Chceš vytvořit skutečné pozorování, nebo vymyšlený svět?',
    primaryArea: 'creationRhythm',
    relatedAreas: [],
    topicIds: ['create.story-art'],
    activityFamilyId: 'family.primary-story',
    sources: [
      {
        label: 'NAEYC — Play',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.naeyc.org/resources/topics/play',
        supportsPrinciple:
          'hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 84,
        toInclusive: 95,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['home'],
      },
      {
        kind: 'materials_all_of',
        materials: ['papír a bezpečné kreslicí pomůcky'],
      },
    ],
    editorial: {
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'Tomáš Holý',
          note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
          atMs: 1794127800000,
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'Alena Světlá',
          note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
          atMs: 1794138600000,
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'Barbora Bílá',
          note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
          atMs: 1794149400000,
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'redakce LUMI',
          note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
          atMs: 1794156600000,
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
  {
    activityId: 'primary-pause-and-leave-a-note',
    revisionId: 'primary-pause-and-leave-a-note.r1',
    language: 'cs',
    title: 'Můžu přestat a vrátit se',
    ageMonths: {
      fromInclusive: 84,
      toInclusive: 95,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Nedokončení není dluh; aplikace ani dospělý nevyžadují návrat.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Při zvolené činnosti nabídněte dítěti možnost pauzy',
      'Pokud chce, označí, kde by příště navázalo',
      'Přijměte i rozhodnutí už nepokračovat',
    ],
    conversationPrompt: 'Chceš si nechat vzkaz pro příště, nebo to dnes uzavřít?',
    primaryArea: 'autonomy',
    relatedAreas: [],
    topicIds: ['auto.plan-choice'],
    activityFamilyId: 'family.primary-plan',
    sources: [
      {
        label: 'EEF — Metacognition and self-regulation',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/metacognition-and-self-Regulation',
        supportsPrinciple:
          'plánování, průběžná úprava a reflexe v konkrétní činnosti. Školní důkazy nepřenášet jako měřený účinek na batolata nebo na naši aplikaci.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 84,
        toInclusive: 95,
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
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'Tomáš Holý',
          note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
          atMs: 1794127800000,
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'Alena Světlá',
          note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
          atMs: 1794138600000,
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'Barbora Bílá',
          note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
          atMs: 1794149400000,
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'redakce LUMI',
          note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
          atMs: 1794156600000,
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
  },
] as const satisfies readonly ActivityRevision[];
