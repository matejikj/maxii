/**
 * Generated preschool 2–5 year draft catalog (completed months 24–59).
 * Editorial stage is draft until publish records documented reviews.
 * Regenerate via: npm run content:generate-preschool-2-5 -w @maxii/baby-tracker
 */
import type { ActivityRevision } from '../model/types';

export const PRESCHOOL_2_5_DRAFT_CONTENT_VERSION = 'preschool-2-5-drafts.v1' as const;

export const PRESCHOOL_2_5_DRAFT_REVISIONS = [
  {
    activityId: 'preschool-two-toy-worlds',
    revisionId: 'preschool-two-toy-worlds.draft-r1',
    language: 'cs',
    title: 'Dvě hry vedle sebe',
    ageMonths: {
      fromInclusive: 24,
      toInclusive: 59,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['dva velké věkově vhodné předměty'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Nevyžadovat sdílení vlastního předmětu ani společné hraní přes nesouhlas.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Zeptejte se, co chce dítě s předmětem dělat',
      'Přidejte se s druhým předmětem bez přebírání vedení',
      'Nabídněte spojení her a přijměte i hraní vedle sebe',
    ],
    conversationPrompt: 'Můžu být se svou hrou vedle tebe?',
    primaryArea: 'relationship',
    relatedAreas: [],
    topicIds: ['rel.cooperation'],
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
        fromInclusive: 24,
        toInclusive: 59,
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
        materials: ['dva velké věkově vhodné předměty'],
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
    activityId: 'preschool-three-picture-story',
    revisionId: 'preschool-three-picture-story.draft-r1',
    language: 'cs',
    title: 'Příběh ze tří obrázků',
    ageMonths: {
      fromInclusive: 24,
      toInclusive: 59,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['tři velké bezpečné obrázky známých věcí'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Slova může nahradit gesto; žádné opravování jediné správné posloupnosti.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Rozložte obrázky a nechte dítě vybrat první',
      'Navazujte spolu krátkým vlastním příběhem',
      'Dovolte pořadí změnit nebo příběh nedokončit',
    ],
    conversationPrompt: 'Co by se mohlo stát potom?',
    primaryArea: 'speech',
    relatedAreas: [],
    topicIds: ['speech.storytelling'],
    activityFamilyId: 'family.preschool-story',
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
        fromInclusive: 24,
        toInclusive: 59,
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
        materials: ['tři velké bezpečné obrázky známých věcí'],
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
    activityId: 'preschool-two-chosen-moves',
    revisionId: 'preschool-two-chosen-moves.draft-r1',
    language: 'cs',
    title: 'Dva vlastní pohyby',
    ageMonths: {
      fromInclusive: 24,
      toInclusive: 59,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Lze pohybovat jen pažemi vsedě; žádné lezení na nábytek, nucené skoky nebo bolest.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Nabídněte dítěti zvolit dva pohodlné osvojené pohyby',
      'Pomalu je vedle sebe zopakujte',
      'Vyměňte vedení nebo skončete podle chuti',
    ],
    conversationPrompt: 'Jaký pohyb vybereš první?',
    primaryArea: 'movement',
    relatedAreas: [],
    topicIds: ['move.sequence'],
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
        fromInclusive: 24,
        toInclusive: 59,
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
    activityId: 'preschool-texture-mark-on-paper',
    revisionId: 'preschool-texture-mark-on-paper.draft-r1',
    language: 'cs',
    title: 'Stopa známého povrchu',
    ageMonths: {
      fromInclusive: 24,
      toInclusive: 59,
    },
    readinessNotes:
      'Pečující výslovně potvrdil bezpečné použití nepoškozené věkově vhodné kreslicí pomůcky pod přímým dohledem.',
    environments: ['home'],
    materials: ['papír, silná pastelka a velká pevná strukturovaná podložka bez hran'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Pečující výslovně potvrdil bezpečné použití nepoškozené věkově vhodné kreslicí pomůcky pod přímým dohledem.',
      'Pouze bezpečné kreslení; žádná ostrá nebo odlomitelná podložka.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Dospělý přidrží papír na bezpečné podložce',
      'Dítě může zkusit jemnou stopu pastelkou nebo sledovat dospělého',
      'Porovnejte papír s dotykem podložky',
    ],
    conversationPrompt: 'Na papíře se objevila stopa. Čeho sis všiml/a?',
    primaryArea: 'senses',
    relatedAreas: [],
    topicIds: ['sense.texture'],
    activityFamilyId: 'family.preschool-mark-making',
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
        fromInclusive: 24,
        toInclusive: 59,
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
        materials: ['papír, silná pastelka a velká pevná strukturovaná podložka bez hran'],
      },
      {
        kind: 'readiness_confirmed',
        key: 'safeMarkMaking',
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
    activityId: 'preschool-notice-one-change',
    revisionId: 'preschool-notice-one-change.draft-r1',
    language: 'cs',
    title: 'Jedna malá změna',
    ageMonths: {
      fromInclusive: 24,
      toInclusive: 59,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['dva velké bezpečné předměty'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Bez zakrývání očí, paměťové zkoušky nebo trestu za přehlédnutí.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Společně si předměty prohlédněte',
      'Přímo před dítětem jeden otočte nebo přesuňte',
      'Povídejte si o změně, které si všimlo',
    ],
    conversationPrompt: 'Co je teď jinak? Můžeme se podívat spolu.',
    primaryArea: 'attention',
    relatedAreas: [],
    topicIds: ['attn.short-focus'],
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
        fromInclusive: 24,
        toInclusive: 59,
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
        materials: ['dva velké bezpečné předměty'],
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
    activityId: 'preschool-one-place-for-each',
    revisionId: 'preschool-one-place-for-each.draft-r1',
    language: 'cs',
    title: 'Pro každého jedno místo',
    ageMonths: {
      fromInclusive: 24,
      toInclusive: 59,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['dva velcí plyšáci a dvě velké podložky'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Pouze velké pomůcky bez malých částí; počítání není podmínka.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Připravte místo pro každého plyšáka',
      'Nechte dítě podložky přiřadit podle vlastního nápadu',
      'Zkuste spolu přesunout jedno místo',
    ],
    conversationPrompt: 'Každý má kde být. Co se změní, když ho přesuneme?',
    primaryArea: 'spaceQuantity',
    relatedAreas: [],
    topicIds: ['space.match-count'],
    activityFamilyId: null,
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
        fromInclusive: 24,
        toInclusive: 59,
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
        materials: ['dva velcí plyšáci a dvě velké podložky'],
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
    activityId: 'preschool-two-colour-page',
    revisionId: 'preschool-two-colour-page.draft-r1',
    language: 'cs',
    title: 'Stránka dvěma barvami',
    ageMonths: {
      fromInclusive: 24,
      toInclusive: 59,
    },
    readinessNotes:
      'Pečující výslovně potvrdil bezpečné použití nepoškozené věkově vhodné kreslicí pomůcky pod přímým dohledem.',
    environments: ['home'],
    materials: ['velký papír a dvě bezpečné silné pastelky'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Pečující výslovně potvrdil bezpečné použití nepoškozené věkově vhodné kreslicí pomůcky pod přímým dohledem.',
      'Žádná předloha k přesnému kopírování; kreslení skončí při nebezpečném zacházení.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Nabídněte výběr jedné nebo obou barev',
      'Nechte dítě zvolit, jak bude čáry tvořit',
      'Přijměte název obrázku nebo jej nechte bez názvu',
    ],
    conversationPrompt: 'Jak se má tvůj obrázek jmenovat, jestli chceš?',
    primaryArea: 'creationRhythm',
    relatedAreas: [],
    topicIds: ['create.drawing'],
    activityFamilyId: 'family.preschool-mark-making',
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
        fromInclusive: 24,
        toInclusive: 59,
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
        materials: ['velký papír a dvě bezpečné silné pastelky'],
      },
      {
        kind: 'readiness_confirmed',
        key: 'safeMarkMaking',
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
    activityId: 'preschool-prepare-two-clothes',
    revisionId: 'preschool-prepare-two-clothes.draft-r1',
    language: 'cs',
    title: 'Připravíme dva kousky',
    ageMonths: {
      fromInclusive: 24,
      toInclusive: 59,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['dva bezpečné kusy vhodného oblečení'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Neprodlužovat nepohodlí a nevyžadovat samostatné zapínání.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Nabídněte dvě části běžného oblékání',
      'Dítě vybere, co připraví samo nebo spolu',
      'Zbytek dokončete s potřebnou pomocí',
    ],
    conversationPrompt: 'Čím chceš začít a kde mám pomoci?',
    primaryArea: 'autonomy',
    relatedAreas: [],
    topicIds: ['auto.routine'],
    activityFamilyId: 'family.preschool-routine',
    sources: [
      {
        label: 'UNICEF — Learning activities for babies and toddlers',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.unicef.org/parenting/child-care/21-learning-activities-babies-and-toddlers',
        supportsPrinciple:
          'příležitosti k učení v běžném společném dni. Naše seznamy nejsou reprodukcí tohoto článku ani převzetím všech jeho pomůcek.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 24,
        toInclusive: 59,
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
        materials: ['dva bezpečné kusy vhodného oblečení'],
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
    activityId: 'preschool-toy-misunderstanding',
    revisionId: 'preschool-toy-misunderstanding.draft-r1',
    language: 'cs',
    title: 'Plyšáci se nedomluvili',
    ageMonths: {
      fromInclusive: 36,
      toInclusive: 59,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['dva velcí bezpeční plyšáci'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Nepřenášet skrytě skutečný konflikt nebo vinu dítěte do příběhu.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Vymyslete drobné nedorozumění mezi plyšáky',
      'Nabídněte dítěti doplnit, co který mohl chtít',
      'Zahrajte více než jedno možné smíření',
    ],
    conversationPrompt: 'Co by mohl jeden druhému říct?',
    primaryArea: 'relationship',
    relatedAreas: [],
    topicIds: ['rel.perspective'],
    activityFamilyId: 'family.preschool-perspective',
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
        fromInclusive: 36,
        toInclusive: 59,
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
        materials: ['dva velcí bezpeční plyšáci'],
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
    activityId: 'preschool-story-from-own-choice',
    revisionId: 'preschool-story-from-own-choice.draft-r1',
    language: 'cs',
    title: 'Co bylo předtím a potom',
    ageMonths: {
      fromInclusive: 36,
      toInclusive: 59,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Neopravovat fantazii jako chybu; dítě nemusí mluvit ve větách.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Dítě vybere smyšlenou postavu nebo známý obrázek',
      'Společně vymyslete jednu situaci a pokračování',
      'Nechte dítě změnit závěr',
    ],
    conversationPrompt: 'A jak bys chtěl/a, aby to pokračovalo?',
    primaryArea: 'speech',
    relatedAreas: [],
    topicIds: ['speech.storytelling'],
    activityFamilyId: 'family.preschool-story',
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
        fromInclusive: 36,
        toInclusive: 59,
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
    activityId: 'preschool-floor-path-choice',
    revisionId: 'preschool-floor-path-choice.draft-r1',
    language: 'cs',
    title: 'Cesta, kterou si zvolím',
    ageMonths: {
      fromInclusive: 36,
      toInclusive: 59,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Žádné schody, překážky na přelézání, zavázané oči nebo závod; dohled dospělého.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Dítě ukáže krátkou trasu ve volném bezpečném prostoru',
      'Dospělý ověří, že se nikde neklouže a nejsou překážky',
      'Projděte ji vlastním osvojeným způsobem nebo ji ukažte rukou',
    ],
    conversationPrompt: 'Kudy bys chtěl/a jít nebo ukázat cestu?',
    primaryArea: 'movement',
    relatedAreas: [],
    topicIds: ['move.self-directed'],
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
        fromInclusive: 36,
        toInclusive: 59,
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
    activityId: 'preschool-shadow-not-sun',
    revisionId: 'preschool-shadow-not-sun.draft-r1',
    language: 'cs',
    title: 'Kde je stín',
    ageMonths: {
      fromInclusive: 36,
      toInclusive: 59,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['outdoor'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Nedívat se do slunce nebo svítidla, nepoužívat laser/lupu; při nepohodlí odejít.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Dospělý vybere klidné místo mimo dopravu',
      'Porovnejte stín při dvou malých pohybech ruky',
      'Pojmenujte, co se změnilo, bez povinného vysvětlení',
    ],
    conversationPrompt: 'Co udělá stín, když pohneme rukou?',
    primaryArea: 'senses',
    relatedAreas: [],
    topicIds: ['sense.light'],
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
        fromInclusive: 36,
        toInclusive: 59,
      },
      {
        kind: 'requires_birth_date',
      },
      {
        kind: 'environment_one_of',
        environments: ['outdoor'],
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
    activityId: 'preschool-one-sorting-rule',
    revisionId: 'preschool-one-sorting-rule.draft-r1',
    language: 'cs',
    title: 'Tři věci podle jednoho nápadu',
    ageMonths: {
      fromInclusive: 36,
      toInclusive: 59,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['tři až čtyři velké bezpečné různobarevné předměty'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Žádná skrytá správná kategorie nebo hodnocení rychlosti.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Dítě navrhne, co mohou mít některé věci společné',
      'Přesuňte je podle jeho zvoleného pravidla',
      'Dovolte pravidlo změnit a znovu věci uspořádat',
    ],
    conversationPrompt: 'Podle čeho je chceš dát k sobě?',
    primaryArea: 'attention',
    relatedAreas: [],
    topicIds: ['attn.sort-rule'],
    activityFamilyId: 'family.preschool-sorting',
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
        fromInclusive: 36,
        toInclusive: 59,
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
        materials: ['tři až čtyři velké bezpečné různobarevné předměty'],
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
    activityId: 'preschool-bridge-for-big-toy',
    revisionId: 'preschool-bridge-for-big-toy.draft-r1',
    language: 'cs',
    title: 'Most pro velkou hračku',
    ageMonths: {
      fromInclusive: 36,
      toInclusive: 59,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['velké věkově vhodné kostky a lehká velká hračka'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Pouze malá hračka, nikdy tělo dítěte; konstrukce není určena k lezení nebo zatížení člověkem.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Společně postavte dva nízké pilíře na podlaze',
      'Položte vhodnou velkou kostku jako most',
      'Zkuste pod ním posunout lehkou hračku',
    ],
    conversationPrompt: 'Vešla se pod most, nebo ho chceš změnit?',
    primaryArea: 'spaceQuantity',
    relatedAreas: [],
    topicIds: ['space.position'],
    activityFamilyId: 'family.preschool-building',
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
        fromInclusive: 36,
        toInclusive: 59,
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
        materials: ['velké věkově vhodné kostky a lehká velká hračka'],
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
    activityId: 'preschool-quiet-orchestra',
    revisionId: 'preschool-quiet-orchestra.draft-r1',
    language: 'cs',
    title: 'Tichý orchestr s pauzou',
    ageMonths: {
      fromInclusive: 36,
      toInclusive: 59,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Hlasitost bez nepohodlí; žádné údery do nádob u ucha nebo nucené vystupování.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Dítě vybere tichý zvuk dlaní nebo hlasu',
      'Dospělý odpoví podobným motivem',
      'Nabídněte společnou pauzu nebo nové vedení',
    ],
    conversationPrompt: 'Kdy necháme zaznít ticho?',
    primaryArea: 'creationRhythm',
    relatedAreas: [],
    topicIds: ['create.rhythm'],
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
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 36,
        toInclusive: 59,
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
    activityId: 'preschool-before-going-out',
    revisionId: 'preschool-before-going-out.draft-r1',
    language: 'cs',
    title: 'Co si připravíme k odchodu',
    ageMonths: {
      fromInclusive: 36,
      toInclusive: 59,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['dva běžné bezpečné kusy oblečení nebo výbavy'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Za bezpečí a vybavení odpovídá dospělý; dítě se netestuje a nechodí samo ven.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Dospělý vymezí dvě drobné vhodné části přípravy',
      'Dítě si vybere jednu a zkusí ji s dostupnou pomocí',
      'Dospělý ověří skutečně potřebnou výbavu',
    ],
    conversationPrompt: 'Co si chceš připravit ty?',
    primaryArea: 'autonomy',
    relatedAreas: [],
    topicIds: ['auto.routine'],
    activityFamilyId: 'family.preschool-routine',
    sources: [
      {
        label: 'UNICEF — Learning activities for babies and toddlers',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.unicef.org/parenting/child-care/21-learning-activities-babies-and-toddlers',
        supportsPrinciple:
          'příležitosti k učení v běžném společném dni. Naše seznamy nejsou reprodukcí tohoto článku ani převzetím všech jeho pomůcek.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 36,
        toInclusive: 59,
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
        materials: ['dva běžné bezpečné kusy oblečení nebo výbavy'],
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
    activityId: 'preschool-different-needs-story',
    revisionId: 'preschool-different-needs-story.draft-r1',
    language: 'cs',
    title: 'Každá postava chce něco jiného',
    ageMonths: {
      fromInclusive: 48,
      toInclusive: 59,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Nežádat přiznání vlastních citlivých zážitků a nehodnotit empatii skórem.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Vymyslete dvě postavy s různým přáním',
      'Dítě navrhne, jak se mohou domluvit',
      'Přijměte více možností včetně oddělených činností',
    ],
    conversationPrompt: 'Jak by se dalo zařídit, aby mohly říct, co chtějí?',
    primaryArea: 'relationship',
    relatedAreas: [],
    topicIds: ['rel.perspective'],
    activityFamilyId: 'family.preschool-perspective',
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
        fromInclusive: 48,
        toInclusive: 59,
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
    activityId: 'preschool-story-two-voices',
    revisionId: 'preschool-story-two-voices.draft-r1',
    language: 'cs',
    title: 'Tentýž příběh dvěma hlasy',
    ageMonths: {
      fromInclusive: 48,
      toInclusive: 59,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: [],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Žádné zesměšňování přízvuku; další jazyk není povinný a nevymýšlí se překlad.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Vyberte krátkou vlastní situaci',
      'Jednou ji vyprávějte jiným hlasem nebo rodinným jazykem, který skutečně používáte',
      'Dítě zvolí, jak bude vyprávění pokračovat',
    ],
    conversationPrompt: 'Co znělo jinak a co zůstalo stejné?',
    primaryArea: 'speech',
    relatedAreas: [],
    topicIds: ['speech.word-play'],
    activityFamilyId: 'family.preschool-story',
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
        fromInclusive: 48,
        toInclusive: 59,
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
    activityId: 'preschool-gentle-ball-aim',
    revisionId: 'preschool-gentle-ball-aim.draft-r1',
    language: 'cs',
    title: 'Kam pošleme míč',
    ageMonths: {
      fromInclusive: 48,
      toInclusive: 59,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['velký měkký míč a dostatek bezpečného místa'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Není závod ani test přesnosti; žádné hody do obličeje nebo běh za míčem k dopravě.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Zvolte blízké místo na podlaze bez lidí a rozbitných věcí',
      'Pomalu kutálejte míč k místu nebo k dospělému',
      'Měňte vzdálenost jen při zájmu dítěte',
    ],
    conversationPrompt: 'Kam ho chceš poslat tentokrát?',
    primaryArea: 'movement',
    relatedAreas: [],
    topicIds: ['move.coordination'],
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
        fromInclusive: 48,
        toInclusive: 59,
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
        materials: ['velký měkký míč a dostatek bezpečného místa'],
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
    activityId: 'preschool-weight-in-two-hands',
    revisionId: 'preschool-weight-in-two-hands.draft-r1',
    language: 'cs',
    title: 'Dvě věci v rukou',
    ageMonths: {
      fromInclusive: 48,
      toInclusive: 59,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['dva lehké velké bezpečné předměty bez ostrých hran'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Nezvedat těžké předměty, nebalancovat s nimi a netestovat sílu.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Dospělý ověří, že oba lze pohodlně držet',
      'Nabídněte dítěti porovnat vjem v ruce postupně nebo vedle sebe',
      'Přijměte vlastní slova pro rozdíl',
    ],
    conversationPrompt: 'Jak ti připadají v ruce?',
    primaryArea: 'senses',
    relatedAreas: [],
    topicIds: ['sense.compare'],
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
        fromInclusive: 48,
        toInclusive: 59,
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
        materials: ['dva lehké velké bezpečné předměty bez ostrých hran'],
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
    activityId: 'preschool-invent-grouping-rule',
    revisionId: 'preschool-invent-grouping-rule.draft-r1',
    language: 'cs',
    title: 'Vymyslíme vlastní pravidlo',
    ageMonths: {
      fromInclusive: 48,
      toInclusive: 59,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['několik velkých bezpečných tvarů nebo pevných obrázků'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Neoznačovat neobvyklé pravidlo za špatné; bez odhadování inteligence.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Dítě si vybere znak pro uspořádání věcí',
      'Vytvoří skupiny a ukáže dospělému svůj nápad',
      'Dospělý se zeptá na jinou možnou variantu',
    ],
    conversationPrompt: 'Jak bys je rozdělil/a jinak, kdybys chtěl/a?',
    primaryArea: 'attention',
    relatedAreas: [],
    topicIds: ['attn.sort-rule'],
    activityFamilyId: 'family.preschool-sorting',
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
        fromInclusive: 48,
        toInclusive: 59,
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
        materials: ['několik velkých bezpečných tvarů nebo pevných obrázků'],
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
    activityId: 'preschool-room-as-large-shapes',
    revisionId: 'preschool-room-as-large-shapes.draft-r1',
    language: 'cs',
    title: 'Pokoj z velkých tvarů',
    ageMonths: {
      fromInclusive: 48,
      toInclusive: 59,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['papír a bezpečná kreslicí pomůcka', 'dospělý může kreslit podle gest'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Není přesná mapa domova pro sdílení; neuvádět adresu a nepřesouvat skutečný těžký nábytek.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Vyberte jednu smyšlenou nebo známou místnost',
      'Nakreslete několik velkých tvarů pro věci v ní',
      'Dítě navrhne nové uspořádání',
    ],
    conversationPrompt: 'Co bys chtěl/a mít blíž a co dál?',
    primaryArea: 'spaceQuantity',
    relatedAreas: [],
    topicIds: ['space.position'],
    activityFamilyId: 'family.preschool-building',
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
        fromInclusive: 48,
        toInclusive: 59,
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
        materials: ['papír a bezpečná kreslicí pomůcka', 'dospělý může kreslit podle gest'],
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
    activityId: 'preschool-box-town',
    revisionId: 'preschool-box-town.draft-r1',
    language: 'cs',
    title: 'Město z krabiček',
    ageMonths: {
      fromInclusive: 48,
      toInclusive: 59,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['velké čisté lehké papírové krabičky bez sponek a drobných součástí'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Bez nožů, tavného lepidla, lezení do krabic nebo zakrývání hlavy.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Položte krabičky na stabilní podlahu',
      'Dítě vybere, co budou představovat',
      'Propojte je příběhem nebo změnou uspořádání',
    ],
    conversationPrompt: 'Kudy by se tvým městem chodilo?',
    primaryArea: 'creationRhythm',
    relatedAreas: [],
    topicIds: ['create.building'],
    activityFamilyId: 'family.preschool-building',
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
        fromInclusive: 48,
        toInclusive: 59,
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
        materials: ['velké čisté lehké papírové krabičky bez sponek a drobných součástí'],
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
    activityId: 'preschool-my-first-step-your-help',
    revisionId: 'preschool-my-first-step-your-help.draft-r1',
    language: 'cs',
    title: 'Můj krok a tvoje pomoc',
    ageMonths: {
      fromInclusive: 48,
      toInclusive: 59,
    },
    readinessNotes:
      'Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.',
    environments: ['home'],
    materials: ['pomůcky jedné zvolené bezpečné činnosti'],
    constraints: [
      'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
      'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
      'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
      'Nezadávat nebezpečný nebo časově nutný domácí úkol; pomoc není odměna.',
    ],
    duration: {
      kind: 'minutes',
      minutes: 5,
    },
    steps: [
      'Vyberte společnou drobnou činnost',
      'Dítě pojmenuje nebo ukáže část, kterou chce zkusit',
      'Dohodněte si pomoc a možnost kdykoli přestat',
    ],
    conversationPrompt: 'Co chceš udělat ty a co mám převzít já?',
    primaryArea: 'autonomy',
    relatedAreas: [],
    topicIds: ['auto.help-choice'],
    activityFamilyId: null,
    sources: [
      {
        label: 'UNICEF — Learning activities for babies and toddlers',
        checkedOn: '2026-11-08',
        kind: 'internal',
        url: 'https://www.unicef.org/parenting/child-care/21-learning-activities-babies-and-toddlers',
        supportsPrinciple:
          'příležitosti k učení v běžném společném dni. Naše seznamy nejsou reprodukcí tohoto článku ani převzetím všech jeho pomůcek.',
      },
    ],
    suitability: [
      {
        kind: 'age_months',
        fromInclusive: 48,
        toInclusive: 59,
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
        materials: ['pomůcky jedné zvolené bezpečné činnosti'],
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
