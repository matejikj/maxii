/**
 * Published toddler 1–2 catalog (completed months 12–23). Derived from draft-r1
 * after documented expert, language/UX and parent reviews on 2026-11-08.
 */
import type { ActivityRevision } from '../model/types';

export const TODDLER_1_2_PUBLISHED_CONTENT_VERSION = 'toddler-1-2.v1' as const;

export const TODDLER_1_2_PUBLISHED_REVISIONS = [
  {
    "activityId": "toddler-shared-hello-choice",
    "revisionId": "toddler-shared-hello-choice.r1",
    "language": "cs",
    "title": "Pozdrav podle nás",
    "ageMonths": {
      "fromInclusive": 12,
      "toInclusive": 23
    },
    "readinessNotes": "Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.",
    "environments": [
      "home"
    ],
    "materials": [],
    "constraints": [
      "Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.",
      "Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.",
      "Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.",
      "Nežádejte dotek, oční kontakt ani opakování; odvrácení znamená konec."
    ],
    "duration": {
      "kind": "moment"
    },
    "steps": [
      "Nabídněte pozdrav hlasem nebo mávnutím",
      "Počkejte, zda dítě nabídne svůj způsob odpovědi",
      "Odpovězte jeho způsobem a pokračujte v běžném dni"
    ],
    "conversationPrompt": "Jak se dnes pozdravíme?",
    "primaryArea": "relationship",
    "relatedAreas": [],
    "topicIds": [
      "rel.turn-taking"
    ],
    "activityFamilyId": null,
    "sources": [
      {
        "label": "NAEYC — Play",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.naeyc.org/resources/topics/play",
        "supportsPrinciple": "hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky."
      },
      {
        "label": "Harvard Center on the Developing Child — Serve and Return",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://developingchild.harvard.edu/key-concept/serve-and-return/",
        "supportsPrinciple": "citlivá odpověď dospělého na iniciativu dítěte. Nevyžaduje, aby dítě odpovídalo jedním předepsaným způsobem."
      }
    ],
    "suitability": [
      {
        "kind": "age_months",
        "fromInclusive": 12,
        "toInclusive": 23
      },
      {
        "kind": "requires_birth_date"
      },
      {
        "kind": "environment_one_of",
        "environments": [
          "home"
        ]
      },
      {
        "kind": "materials_none"
      }
    ],
    "editorial": {
      "stage": "published",
      "history": [
        {
          "stage": "expert_reviewed",
          "author": "Tomáš Holý",
          "note": "Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.",
          "atMs": 1794126600000,
          "outcome": "passed"
        },
        {
          "stage": "language_ux",
          "author": "Alena Světlá",
          "note": "Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.",
          "atMs": 1794137400000,
          "outcome": "passed"
        },
        {
          "stage": "parent_verified",
          "author": "Barbora Bílá",
          "note": "Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.",
          "atMs": 1794148200000,
          "outcome": "passed"
        },
        {
          "stage": "published",
          "author": "redakce LUMI",
          "note": "Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.",
          "atMs": 1794155400000,
          "outcome": "passed"
        }
      ]
    },
    "withdrawnReason": null,
    "fixtureKind": "product"
  },
  {
    "activityId": "toddler-two-pages-together",
    "revisionId": "toddler-two-pages-together.r1",
    "language": "cs",
    "title": "Dvě stránky spolu",
    "ageMonths": {
      "fromInclusive": 12,
      "toInclusive": 23
    },
    "readinessNotes": "Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.",
    "environments": [
      "home"
    ],
    "materials": [
      "věkově vhodné pevné leporelo"
    ],
    "constraints": [
      "Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.",
      "Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.",
      "Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.",
      "Nezkoušejte správná slova ani nebraňte otočení stránky."
    ],
    "duration": {
      "kind": "moment"
    },
    "steps": [
      "Nechte dítě vybrat obrázek na otevřené stránce",
      "Pojmenujte, co ho zaujalo, jednou krátkou větou",
      "Počkejte na gesto nebo zvuk a odpovězte"
    ],
    "conversationPrompt": "Vidím pejska. Čeho sis všiml/a ty?",
    "primaryArea": "speech",
    "relatedAreas": [],
    "topicIds": [
      "speech.naming"
    ],
    "activityFamilyId": "family.toddler-shared-story",
    "sources": [
      {
        "label": "Harvard Center on the Developing Child — Serve and Return",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://developingchild.harvard.edu/key-concept/serve-and-return/",
        "supportsPrinciple": "citlivá odpověď dospělého na iniciativu dítěte. Nevyžaduje, aby dítě odpovídalo jedním předepsaným způsobem."
      },
      {
        "label": "NAEYC — Everyday Steps to Reading and Writing",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.naeyc.org/our-work/families/everyday-steps-reading-and-writing",
        "supportsPrinciple": "význam čtení, vyprávění a smysluplného používání jazyka doma. Nejde o povinný termín samostatného čtení."
      }
    ],
    "suitability": [
      {
        "kind": "age_months",
        "fromInclusive": 12,
        "toInclusive": 23
      },
      {
        "kind": "requires_birth_date"
      },
      {
        "kind": "environment_one_of",
        "environments": [
          "home"
        ]
      },
      {
        "kind": "materials_all_of",
        "materials": [
          "věkově vhodné pevné leporelo"
        ]
      }
    ],
    "editorial": {
      "stage": "published",
      "history": [
        {
          "stage": "expert_reviewed",
          "author": "Tomáš Holý",
          "note": "Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.",
          "atMs": 1794126600000,
          "outcome": "passed"
        },
        {
          "stage": "language_ux",
          "author": "Alena Světlá",
          "note": "Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.",
          "atMs": 1794137400000,
          "outcome": "passed"
        },
        {
          "stage": "parent_verified",
          "author": "Barbora Bílá",
          "note": "Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.",
          "atMs": 1794148200000,
          "outcome": "passed"
        },
        {
          "stage": "published",
          "author": "redakce LUMI",
          "note": "Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.",
          "atMs": 1794155400000,
          "outcome": "passed"
        }
      ]
    },
    "withdrawnReason": null,
    "fixtureKind": "product"
  },
  {
    "activityId": "toddler-soft-ball-return",
    "revisionId": "toddler-soft-ball-return.r1",
    "language": "cs",
    "title": "Míč k tobě a zpět",
    "ageMonths": {
      "fromInclusive": 12,
      "toInclusive": 23
    },
    "readinessNotes": "Dítě už samo stabilně sedí na podlaze.",
    "environments": [
      "home"
    ],
    "materials": [
      "velký měkký míč určený pro tento věk"
    ],
    "constraints": [
      "Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.",
      "Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.",
      "Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.",
      "Dítě už samo stabilně sedí na podlaze.",
      "Pouze při vlastním stabilním sedu; míč neházejte na tělo ani obličej."
    ],
    "duration": {
      "kind": "moment"
    },
    "steps": [
      "Posaďte se na bezpečnou podlahu v malé vzdálenosti",
      "Pomalu pošlete míč po zemi k dítěti",
      "Nechte je zvolit dotek, odsun nebo jen pozorování"
    ],
    "conversationPrompt": "Míč jede k tobě. Co s ním uděláš?",
    "primaryArea": "movement",
    "relatedAreas": [],
    "topicIds": [
      "move.coordination"
    ],
    "activityFamilyId": "family.toddler-ball-play",
    "sources": [
      {
        "label": "NAEYC — Play",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.naeyc.org/resources/topics/play",
        "supportsPrinciple": "hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky."
      },
      {
        "label": "Royal Children's Hospital — Toy safety",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.rch.org.au/kidsinfo/fact_sheets/Toy_safety/",
        "supportsPrinciple": "bezpečnost a věkové určení pomůcek. Slouží jako podklad pro kontrolu rizik; nenahrazuje posouzení každého materiálu a situace."
      }
    ],
    "suitability": [
      {
        "kind": "age_months",
        "fromInclusive": 12,
        "toInclusive": 23
      },
      {
        "kind": "requires_birth_date"
      },
      {
        "kind": "environment_one_of",
        "environments": [
          "home"
        ]
      },
      {
        "kind": "materials_all_of",
        "materials": [
          "velký měkký míč určený pro tento věk"
        ]
      },
      {
        "kind": "readiness_confirmed",
        "key": "floorSit"
      }
    ],
    "editorial": {
      "stage": "published",
      "history": [
        {
          "stage": "expert_reviewed",
          "author": "Tomáš Holý",
          "note": "Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.",
          "atMs": 1794126600000,
          "outcome": "passed"
        },
        {
          "stage": "language_ux",
          "author": "Alena Světlá",
          "note": "Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.",
          "atMs": 1794137400000,
          "outcome": "passed"
        },
        {
          "stage": "parent_verified",
          "author": "Barbora Bílá",
          "note": "Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.",
          "atMs": 1794148200000,
          "outcome": "passed"
        },
        {
          "stage": "published",
          "author": "redakce LUMI",
          "note": "Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.",
          "atMs": 1794155400000,
          "outcome": "passed"
        }
      ]
    },
    "withdrawnReason": null,
    "fixtureKind": "product"
  },
  {
    "activityId": "toddler-two-large-textures",
    "revisionId": "toddler-two-large-textures.r1",
    "language": "cs",
    "title": "Dva velké povrchy",
    "ageMonths": {
      "fromInclusive": 12,
      "toInclusive": 23
    },
    "readinessNotes": "Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.",
    "environments": [
      "home"
    ],
    "materials": [
      "dva velké nepoškozené kusy látky bez třásní a volných částí"
    ],
    "constraints": [
      "Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.",
      "Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.",
      "Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.",
      "Nevkládat látku do úst ani kolem krku; při odmítání doteku přestat."
    ],
    "duration": {
      "kind": "moment"
    },
    "steps": [
      "Položte látky před dítě na bezpečný podklad",
      "Nabídněte dotek rukou bez zakrývání obličeje",
      "Popište rozdíl, kterého si dítě všimlo"
    ],
    "conversationPrompt": "Tahle je hladká. Chceš sáhnout i na druhou?",
    "primaryArea": "senses",
    "relatedAreas": [],
    "topicIds": [
      "sense.texture"
    ],
    "activityFamilyId": null,
    "sources": [
      {
        "label": "NAEYC — Play",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.naeyc.org/resources/topics/play",
        "supportsPrinciple": "hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky."
      },
      {
        "label": "Royal Children's Hospital — Toy safety",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.rch.org.au/kidsinfo/fact_sheets/Toy_safety/",
        "supportsPrinciple": "bezpečnost a věkové určení pomůcek. Slouží jako podklad pro kontrolu rizik; nenahrazuje posouzení každého materiálu a situace."
      }
    ],
    "suitability": [
      {
        "kind": "age_months",
        "fromInclusive": 12,
        "toInclusive": 23
      },
      {
        "kind": "requires_birth_date"
      },
      {
        "kind": "environment_one_of",
        "environments": [
          "home"
        ]
      },
      {
        "kind": "materials_all_of",
        "materials": [
          "dva velké nepoškozené kusy látky bez třásní a volných částí"
        ]
      }
    ],
    "editorial": {
      "stage": "published",
      "history": [
        {
          "stage": "expert_reviewed",
          "author": "Tomáš Holý",
          "note": "Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.",
          "atMs": 1794126600000,
          "outcome": "passed"
        },
        {
          "stage": "language_ux",
          "author": "Alena Světlá",
          "note": "Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.",
          "atMs": 1794137400000,
          "outcome": "passed"
        },
        {
          "stage": "parent_verified",
          "author": "Barbora Bílá",
          "note": "Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.",
          "atMs": 1794148200000,
          "outcome": "passed"
        },
        {
          "stage": "published",
          "author": "redakce LUMI",
          "note": "Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.",
          "atMs": 1794155400000,
          "outcome": "passed"
        }
      ]
    },
    "withdrawnReason": null,
    "fixtureKind": "product"
  },
  {
    "activityId": "toddler-follow-your-interest",
    "revisionId": "toddler-follow-your-interest.r1",
    "language": "cs",
    "title": "Podíváme se na to spolu",
    "ageMonths": {
      "fromInclusive": 12,
      "toInclusive": 23
    },
    "readinessNotes": "Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.",
    "environments": [
      "home"
    ],
    "materials": [],
    "constraints": [
      "Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.",
      "Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.",
      "Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.",
      "Nevynucujte ukazování nebo pohled; neodvádějte pozornost od potřebné péče."
    ],
    "duration": {
      "kind": "moment"
    },
    "steps": [
      "Všimněte si, čemu dítě právě věnuje pozornost",
      "Připojte krátký komentář bez přerušení jeho činnosti",
      "Počkejte, kam svou pozornost přesune dál"
    ],
    "conversationPrompt": "Tohle tě zaujalo. Jsem tu s tebou.",
    "primaryArea": "attention",
    "relatedAreas": [],
    "topicIds": [
      "attn.shared"
    ],
    "activityFamilyId": null,
    "sources": [
      {
        "label": "NAEYC — Play",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.naeyc.org/resources/topics/play",
        "supportsPrinciple": "hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky."
      },
      {
        "label": "Harvard Center on the Developing Child — Serve and Return",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://developingchild.harvard.edu/key-concept/serve-and-return/",
        "supportsPrinciple": "citlivá odpověď dospělého na iniciativu dítěte. Nevyžaduje, aby dítě odpovídalo jedním předepsaným způsobem."
      }
    ],
    "suitability": [
      {
        "kind": "age_months",
        "fromInclusive": 12,
        "toInclusive": 23
      },
      {
        "kind": "requires_birth_date"
      },
      {
        "kind": "environment_one_of",
        "environments": [
          "home"
        ]
      },
      {
        "kind": "materials_none"
      }
    ],
    "editorial": {
      "stage": "published",
      "history": [
        {
          "stage": "expert_reviewed",
          "author": "Tomáš Holý",
          "note": "Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.",
          "atMs": 1794126600000,
          "outcome": "passed"
        },
        {
          "stage": "language_ux",
          "author": "Alena Světlá",
          "note": "Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.",
          "atMs": 1794137400000,
          "outcome": "passed"
        },
        {
          "stage": "parent_verified",
          "author": "Barbora Bílá",
          "note": "Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.",
          "atMs": 1794148200000,
          "outcome": "passed"
        },
        {
          "stage": "published",
          "author": "redakce LUMI",
          "note": "Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.",
          "atMs": 1794155400000,
          "outcome": "passed"
        }
      ]
    },
    "withdrawnReason": null,
    "fixtureKind": "product"
  },
  {
    "activityId": "toddler-cup-in-and-out",
    "revisionId": "toddler-cup-in-and-out.r1",
    "language": "cs",
    "title": "Dovnitř a zase ven",
    "ageMonths": {
      "fromInclusive": 12,
      "toInclusive": 23
    },
    "readinessNotes": "Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.",
    "environments": [
      "home"
    ],
    "materials": [
      "dva velké lehké vkládací kelímky určené pro daný věk"
    ],
    "constraints": [
      "Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.",
      "Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.",
      "Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.",
      "Pouze celistvé pomůcky bez malých dílů; žádné nucené narovnávání ruky."
    ],
    "duration": {
      "kind": "moment"
    },
    "steps": [
      "Položte velký kelímek a menší, který se bezpečně vejde dovnitř",
      "Jednou ukažte vložení a vyjmutí",
      "Nechte dítě zkusit vlastní nápad"
    ],
    "conversationPrompt": "Teď je uvnitř. Kam ho dáš?",
    "primaryArea": "spaceQuantity",
    "relatedAreas": [],
    "topicIds": [
      "space.in-out"
    ],
    "activityFamilyId": null,
    "sources": [
      {
        "label": "NAEYC — Articles for Families on Math",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.naeyc.org/our-work/families/math",
        "supportsPrinciple": "množství, třídění, prostor a měření v běžném prostředí. Není důkazem, že náš věkový filtr vyhovuje konkrétnímu dítěti."
      }
    ],
    "suitability": [
      {
        "kind": "age_months",
        "fromInclusive": 12,
        "toInclusive": 23
      },
      {
        "kind": "requires_birth_date"
      },
      {
        "kind": "environment_one_of",
        "environments": [
          "home"
        ]
      },
      {
        "kind": "materials_all_of",
        "materials": [
          "dva velké lehké vkládací kelímky určené pro daný věk"
        ]
      }
    ],
    "editorial": {
      "stage": "published",
      "history": [
        {
          "stage": "expert_reviewed",
          "author": "Tomáš Holý",
          "note": "Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.",
          "atMs": 1794126600000,
          "outcome": "passed"
        },
        {
          "stage": "language_ux",
          "author": "Alena Světlá",
          "note": "Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.",
          "atMs": 1794137400000,
          "outcome": "passed"
        },
        {
          "stage": "parent_verified",
          "author": "Barbora Bílá",
          "note": "Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.",
          "atMs": 1794148200000,
          "outcome": "passed"
        },
        {
          "stage": "published",
          "author": "redakce LUMI",
          "note": "Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.",
          "atMs": 1794155400000,
          "outcome": "passed"
        }
      ]
    },
    "withdrawnReason": null,
    "fixtureKind": "product"
  },
  {
    "activityId": "toddler-palm-pause-rhythm",
    "revisionId": "toddler-palm-pause-rhythm.r1",
    "language": "cs",
    "title": "Dlaně a pauza",
    "ageMonths": {
      "fromInclusive": 12,
      "toInclusive": 23
    },
    "readinessNotes": "Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.",
    "environments": [
      "home"
    ],
    "materials": [],
    "constraints": [
      "Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.",
      "Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.",
      "Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.",
      "Bez hlasitých úderů a vedení rukou dítěte; při únavě skončit."
    ],
    "duration": {
      "kind": "moment"
    },
    "steps": [
      "Jemně poklepejte vlastními dlaněmi na stehna",
      "Na chvíli se zastavte",
      "Odpovězte na zvuk nebo pohyb dítěte"
    ],
    "conversationPrompt": "Ťuk, ťuk… a teď chvíli ticho.",
    "primaryArea": "creationRhythm",
    "relatedAreas": [],
    "topicIds": [
      "create.rhythm"
    ],
    "activityFamilyId": "family.toddler-rhythm",
    "sources": [
      {
        "label": "NAEYC — Play",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.naeyc.org/resources/topics/play",
        "supportsPrinciple": "hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky."
      }
    ],
    "suitability": [
      {
        "kind": "age_months",
        "fromInclusive": 12,
        "toInclusive": 23
      },
      {
        "kind": "requires_birth_date"
      },
      {
        "kind": "environment_one_of",
        "environments": [
          "home"
        ]
      },
      {
        "kind": "materials_none"
      }
    ],
    "editorial": {
      "stage": "published",
      "history": [
        {
          "stage": "expert_reviewed",
          "author": "Tomáš Holý",
          "note": "Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.",
          "atMs": 1794126600000,
          "outcome": "passed"
        },
        {
          "stage": "language_ux",
          "author": "Alena Světlá",
          "note": "Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.",
          "atMs": 1794137400000,
          "outcome": "passed"
        },
        {
          "stage": "parent_verified",
          "author": "Barbora Bílá",
          "note": "Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.",
          "atMs": 1794148200000,
          "outcome": "passed"
        },
        {
          "stage": "published",
          "author": "redakce LUMI",
          "note": "Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.",
          "atMs": 1794155400000,
          "outcome": "passed"
        }
      ]
    },
    "withdrawnReason": null,
    "fixtureKind": "product"
  },
  {
    "activityId": "toddler-choose-two-clothes",
    "revisionId": "toddler-choose-two-clothes.r1",
    "language": "cs",
    "title": "Vybereme jeden kousek",
    "ageMonths": {
      "fromInclusive": 12,
      "toInclusive": 23
    },
    "readinessNotes": "Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.",
    "environments": [
      "home"
    ],
    "materials": [
      "dva bezpečné kusy oblečení bez dostupných šňůrek a volných částí"
    ],
    "constraints": [
      "Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.",
      "Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.",
      "Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.",
      "Není-li volba zřejmá, pomozte; nečekejte na správnou odpověď."
    ],
    "duration": {
      "kind": "moment"
    },
    "steps": [
      "Ukažte dvě reálně použitelné možnosti",
      "Přijměte pohled, gesto nebo jiný signál volby",
      "Zvolenou věc použijte s obvyklou pomocí"
    ],
    "conversationPrompt": "Chceš dnes tenhle, nebo tenhle?",
    "primaryArea": "autonomy",
    "relatedAreas": [],
    "topicIds": [
      "auto.choice"
    ],
    "activityFamilyId": null,
    "sources": [
      {
        "label": "UNICEF — Learning activities for babies and toddlers",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.unicef.org/parenting/child-care/21-learning-activities-babies-and-toddlers",
        "supportsPrinciple": "příležitosti k učení v běžném společném dni. Naše seznamy nejsou reprodukcí tohoto článku ani převzetím všech jeho pomůcek."
      }
    ],
    "suitability": [
      {
        "kind": "age_months",
        "fromInclusive": 12,
        "toInclusive": 23
      },
      {
        "kind": "requires_birth_date"
      },
      {
        "kind": "environment_one_of",
        "environments": [
          "home"
        ]
      },
      {
        "kind": "materials_all_of",
        "materials": [
          "dva bezpečné kusy oblečení bez dostupných šňůrek a volných částí"
        ]
      }
    ],
    "editorial": {
      "stage": "published",
      "history": [
        {
          "stage": "expert_reviewed",
          "author": "Tomáš Holý",
          "note": "Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.",
          "atMs": 1794126600000,
          "outcome": "passed"
        },
        {
          "stage": "language_ux",
          "author": "Alena Světlá",
          "note": "Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.",
          "atMs": 1794137400000,
          "outcome": "passed"
        },
        {
          "stage": "parent_verified",
          "author": "Barbora Bílá",
          "note": "Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.",
          "atMs": 1794148200000,
          "outcome": "passed"
        },
        {
          "stage": "published",
          "author": "redakce LUMI",
          "note": "Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.",
          "atMs": 1794155400000,
          "outcome": "passed"
        }
      ]
    },
    "withdrawnReason": null,
    "fixtureKind": "product"
  },
  {
    "activityId": "toddler-shared-ball-turn",
    "revisionId": "toddler-shared-ball-turn.r1",
    "language": "cs",
    "title": "Teď ty, teď já",
    "ageMonths": {
      "fromInclusive": 16,
      "toInclusive": 23
    },
    "readinessNotes": "Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.",
    "environments": [
      "home"
    ],
    "materials": [
      "velký měkký míč vhodný pro věk"
    ],
    "constraints": [
      "Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.",
      "Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.",
      "Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.",
      "Nevyžadovat půjčení nebo čekání přes odpor; hra není zkouška poslušnosti."
    ],
    "duration": {
      "kind": "moment"
    },
    "steps": [
      "Nabídněte krátkou společnou hru po zemi",
      "Pojmenujte svůj a dětský tah bez časomíry",
      "Když si chce dítě míč nechat, nabídněte pauzu"
    ],
    "conversationPrompt": "Teď ho máš ty. Můžu se přidat?",
    "primaryArea": "relationship",
    "relatedAreas": [],
    "topicIds": [
      "rel.turn-taking"
    ],
    "activityFamilyId": "family.toddler-ball-play",
    "sources": [
      {
        "label": "NAEYC — Play",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.naeyc.org/resources/topics/play",
        "supportsPrinciple": "hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky."
      },
      {
        "label": "Harvard Center on the Developing Child — Serve and Return",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://developingchild.harvard.edu/key-concept/serve-and-return/",
        "supportsPrinciple": "citlivá odpověď dospělého na iniciativu dítěte. Nevyžaduje, aby dítě odpovídalo jedním předepsaným způsobem."
      }
    ],
    "suitability": [
      {
        "kind": "age_months",
        "fromInclusive": 16,
        "toInclusive": 23
      },
      {
        "kind": "requires_birth_date"
      },
      {
        "kind": "environment_one_of",
        "environments": [
          "home"
        ]
      },
      {
        "kind": "materials_all_of",
        "materials": [
          "velký měkký míč vhodný pro věk"
        ]
      }
    ],
    "editorial": {
      "stage": "published",
      "history": [
        {
          "stage": "expert_reviewed",
          "author": "Tomáš Holý",
          "note": "Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.",
          "atMs": 1794126600000,
          "outcome": "passed"
        },
        {
          "stage": "language_ux",
          "author": "Alena Světlá",
          "note": "Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.",
          "atMs": 1794137400000,
          "outcome": "passed"
        },
        {
          "stage": "parent_verified",
          "author": "Barbora Bílá",
          "note": "Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.",
          "atMs": 1794148200000,
          "outcome": "passed"
        },
        {
          "stage": "published",
          "author": "redakce LUMI",
          "note": "Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.",
          "atMs": 1794155400000,
          "outcome": "passed"
        }
      ]
    },
    "withdrawnReason": null,
    "fixtureKind": "product"
  },
  {
    "activityId": "toddler-words-for-two-things",
    "revisionId": "toddler-words-for-two-things.r1",
    "language": "cs",
    "title": "Dvě známé věci",
    "ageMonths": {
      "fromInclusive": 16,
      "toInclusive": 23
    },
    "readinessNotes": "Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.",
    "environments": [
      "home"
    ],
    "materials": [
      "dva velké bezpečné známé předměty"
    ],
    "constraints": [
      "Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.",
      "Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.",
      "Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.",
      "Nejde o test rozpoznávání; nepoužívat horký, skleněný nebo rozbitný předmět."
    ],
    "duration": {
      "kind": "moment"
    },
    "steps": [
      "Sledujte, po kterém předmětu dítě sáhne",
      "Popište jej a jeho běžné použití",
      "Rozviňte dětské gesto nebo zvuk vlastní krátkou větou"
    ],
    "conversationPrompt": "Máš hrnek. Hrnek bývá na pití.",
    "primaryArea": "speech",
    "relatedAreas": [],
    "topicIds": [
      "speech.naming"
    ],
    "activityFamilyId": null,
    "sources": [
      {
        "label": "Harvard Center on the Developing Child — Serve and Return",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://developingchild.harvard.edu/key-concept/serve-and-return/",
        "supportsPrinciple": "citlivá odpověď dospělého na iniciativu dítěte. Nevyžaduje, aby dítě odpovídalo jedním předepsaným způsobem."
      },
      {
        "label": "NAEYC — Everyday Steps to Reading and Writing",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.naeyc.org/our-work/families/everyday-steps-reading-and-writing",
        "supportsPrinciple": "význam čtení, vyprávění a smysluplného používání jazyka doma. Nejde o povinný termín samostatného čtení."
      }
    ],
    "suitability": [
      {
        "kind": "age_months",
        "fromInclusive": 16,
        "toInclusive": 23
      },
      {
        "kind": "requires_birth_date"
      },
      {
        "kind": "environment_one_of",
        "environments": [
          "home"
        ]
      },
      {
        "kind": "materials_all_of",
        "materials": [
          "dva velké bezpečné známé předměty"
        ]
      }
    ],
    "editorial": {
      "stage": "published",
      "history": [
        {
          "stage": "expert_reviewed",
          "author": "Tomáš Holý",
          "note": "Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.",
          "atMs": 1794126600000,
          "outcome": "passed"
        },
        {
          "stage": "language_ux",
          "author": "Alena Světlá",
          "note": "Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.",
          "atMs": 1794137400000,
          "outcome": "passed"
        },
        {
          "stage": "parent_verified",
          "author": "Barbora Bílá",
          "note": "Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.",
          "atMs": 1794148200000,
          "outcome": "passed"
        },
        {
          "stage": "published",
          "author": "redakce LUMI",
          "note": "Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.",
          "atMs": 1794155400000,
          "outcome": "passed"
        }
      ]
    },
    "withdrawnReason": null,
    "fixtureKind": "product"
  },
  {
    "activityId": "toddler-own-way-to-toy",
    "revisionId": "toddler-own-way-to-toy.r1",
    "language": "cs",
    "title": "Moje cesta za hračkou",
    "ageMonths": {
      "fromInclusive": 16,
      "toInclusive": 23
    },
    "readinessNotes": "Dítě už se samo pohybuje po bezpečné podlaze.",
    "environments": [
      "home"
    ],
    "materials": [
      "jedna velká věkově vhodná hračka a volný rovný prostor"
    ],
    "constraints": [
      "Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.",
      "Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.",
      "Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.",
      "Dítě už se samo pohybuje po bezpečné podlaze.",
      "Pohyb musí dítě zahajovat samo; nevyžadovat chůzi ani tahání za ruce."
    ],
    "duration": {
      "kind": "moment"
    },
    "steps": [
      "Připravte krátkou cestu bez překážek a schodů",
      "Nechte dítě zvolit už osvojený způsob pohybu",
      "Přesuňte hračku jen tehdy, chce-li dítě pokračovat"
    ],
    "conversationPrompt": "Můžeš si pro ni dojít svým způsobem.",
    "primaryArea": "movement",
    "relatedAreas": [],
    "topicIds": [
      "move.self-directed"
    ],
    "activityFamilyId": null,
    "sources": [
      {
        "label": "NAEYC — Play",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.naeyc.org/resources/topics/play",
        "supportsPrinciple": "hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky."
      },
      {
        "label": "Royal Children's Hospital — Toy safety",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.rch.org.au/kidsinfo/fact_sheets/Toy_safety/",
        "supportsPrinciple": "bezpečnost a věkové určení pomůcek. Slouží jako podklad pro kontrolu rizik; nenahrazuje posouzení každého materiálu a situace."
      }
    ],
    "suitability": [
      {
        "kind": "age_months",
        "fromInclusive": 16,
        "toInclusive": 23
      },
      {
        "kind": "requires_birth_date"
      },
      {
        "kind": "environment_one_of",
        "environments": [
          "home"
        ]
      },
      {
        "kind": "materials_all_of",
        "materials": [
          "jedna velká věkově vhodná hračka a volný rovný prostor"
        ]
      },
      {
        "kind": "readiness_confirmed",
        "key": "floorMove"
      }
    ],
    "editorial": {
      "stage": "published",
      "history": [
        {
          "stage": "expert_reviewed",
          "author": "Tomáš Holý",
          "note": "Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.",
          "atMs": 1794126600000,
          "outcome": "passed"
        },
        {
          "stage": "language_ux",
          "author": "Alena Světlá",
          "note": "Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.",
          "atMs": 1794137400000,
          "outcome": "passed"
        },
        {
          "stage": "parent_verified",
          "author": "Barbora Bílá",
          "note": "Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.",
          "atMs": 1794148200000,
          "outcome": "passed"
        },
        {
          "stage": "published",
          "author": "redakce LUMI",
          "note": "Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.",
          "atMs": 1794155400000,
          "outcome": "passed"
        }
      ]
    },
    "withdrawnReason": null,
    "fixtureKind": "product"
  },
  {
    "activityId": "toddler-quiet-sound-source",
    "revisionId": "toddler-quiet-sound-source.r1",
    "language": "cs",
    "title": "Odkud přišel tichý zvuk",
    "ageMonths": {
      "fromInclusive": 16,
      "toInclusive": 23
    },
    "readinessNotes": "Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.",
    "environments": [
      "quiet"
    ],
    "materials": [
      "velká látka bez volných částí",
      "případně jen ruce dospělého"
    ],
    "constraints": [
      "Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.",
      "Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.",
      "Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.",
      "Nezvukovat u ucha, nic neschovávat na obličej a nevyžadovat sluchovou odpověď."
    ],
    "duration": {
      "kind": "moment"
    },
    "steps": [
      "V zorném poli tiše promněte látku nebo vlastní dlaně",
      "Přestaňte a počkejte na reakci",
      "Zopakujte jen při zájmu dítěte"
    ],
    "conversationPrompt": "Ten zvuk dělají moje ruce.",
    "primaryArea": "senses",
    "relatedAreas": [],
    "topicIds": [
      "sense.sound"
    ],
    "activityFamilyId": null,
    "sources": [
      {
        "label": "NAEYC — Play",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.naeyc.org/resources/topics/play",
        "supportsPrinciple": "hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky."
      },
      {
        "label": "Royal Children's Hospital — Toy safety",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.rch.org.au/kidsinfo/fact_sheets/Toy_safety/",
        "supportsPrinciple": "bezpečnost a věkové určení pomůcek. Slouží jako podklad pro kontrolu rizik; nenahrazuje posouzení každého materiálu a situace."
      }
    ],
    "suitability": [
      {
        "kind": "age_months",
        "fromInclusive": 16,
        "toInclusive": 23
      },
      {
        "kind": "requires_birth_date"
      },
      {
        "kind": "environment_one_of",
        "environments": [
          "quiet"
        ]
      },
      {
        "kind": "materials_all_of",
        "materials": [
          "velká látka bez volných částí",
          "případně jen ruce dospělého"
        ]
      }
    ],
    "editorial": {
      "stage": "published",
      "history": [
        {
          "stage": "expert_reviewed",
          "author": "Tomáš Holý",
          "note": "Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.",
          "atMs": 1794126600000,
          "outcome": "passed"
        },
        {
          "stage": "language_ux",
          "author": "Alena Světlá",
          "note": "Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.",
          "atMs": 1794137400000,
          "outcome": "passed"
        },
        {
          "stage": "parent_verified",
          "author": "Barbora Bílá",
          "note": "Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.",
          "atMs": 1794148200000,
          "outcome": "passed"
        },
        {
          "stage": "published",
          "author": "redakce LUMI",
          "note": "Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.",
          "atMs": 1794155400000,
          "outcome": "passed"
        }
      ]
    },
    "withdrawnReason": null,
    "fixtureKind": "product"
  },
  {
    "activityId": "toddler-toy-under-cloth-edge",
    "revisionId": "toddler-toy-under-cloth-edge.r1",
    "language": "cs",
    "title": "Hračka u kraje látky",
    "ageMonths": {
      "fromInclusive": 16,
      "toInclusive": 23
    },
    "readinessNotes": "Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.",
    "environments": [
      "home"
    ],
    "materials": [
      "velká hračka a velká látka bez třásní"
    ],
    "constraints": [
      "Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.",
      "Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.",
      "Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.",
      "Látka nikdy nepřikrývá dítě; při nezájmu hračku zpřístupnit bez zkoušení."
    ],
    "duration": {
      "kind": "moment"
    },
    "steps": [
      "Položte hračku tak, aby její část zůstala vidět",
      "Přikryjte jen její okraj a společně si změny všimněte",
      "Dovolte dítěti odkrýt nebo jen sledovat"
    ],
    "conversationPrompt": "Kousek je vidět. Co chceš udělat?",
    "primaryArea": "attention",
    "relatedAreas": [],
    "topicIds": [
      "attn.short-focus"
    ],
    "activityFamilyId": null,
    "sources": [
      {
        "label": "NAEYC — Play",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.naeyc.org/resources/topics/play",
        "supportsPrinciple": "hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky."
      },
      {
        "label": "Harvard Center on the Developing Child — Serve and Return",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://developingchild.harvard.edu/key-concept/serve-and-return/",
        "supportsPrinciple": "citlivá odpověď dospělého na iniciativu dítěte. Nevyžaduje, aby dítě odpovídalo jedním předepsaným způsobem."
      }
    ],
    "suitability": [
      {
        "kind": "age_months",
        "fromInclusive": 16,
        "toInclusive": 23
      },
      {
        "kind": "requires_birth_date"
      },
      {
        "kind": "environment_one_of",
        "environments": [
          "home"
        ]
      },
      {
        "kind": "materials_all_of",
        "materials": [
          "velká hračka a velká látka bez třásní"
        ]
      }
    ],
    "editorial": {
      "stage": "published",
      "history": [
        {
          "stage": "expert_reviewed",
          "author": "Tomáš Holý",
          "note": "Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.",
          "atMs": 1794126600000,
          "outcome": "passed"
        },
        {
          "stage": "language_ux",
          "author": "Alena Světlá",
          "note": "Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.",
          "atMs": 1794137400000,
          "outcome": "passed"
        },
        {
          "stage": "parent_verified",
          "author": "Barbora Bílá",
          "note": "Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.",
          "atMs": 1794148200000,
          "outcome": "passed"
        },
        {
          "stage": "published",
          "author": "redakce LUMI",
          "note": "Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.",
          "atMs": 1794155400000,
          "outcome": "passed"
        }
      ]
    },
    "withdrawnReason": null,
    "fixtureKind": "product"
  },
  {
    "activityId": "toddler-empty-full-container",
    "revisionId": "toddler-empty-full-container.r1",
    "language": "cs",
    "title": "Prázdná a plná nádoba",
    "ageMonths": {
      "fromInclusive": 16,
      "toInclusive": 23
    },
    "readinessNotes": "Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.",
    "environments": [
      "home"
    ],
    "materials": [
      "dvě nízké lehké nádoby a několik velkých věkově vhodných kostek"
    ],
    "constraints": [
      "Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.",
      "Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.",
      "Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.",
      "Žádné sypké drobnosti, jídlo, voda nebo nádoba nasaditelná na hlavu."
    ],
    "duration": {
      "kind": "moment"
    },
    "steps": [
      "Ukažte prázdnou nádobu a druhou s kostkami",
      "Nabídněte přesouvání jednotlivých velkých kostek",
      "Popisujte, co se právě mění"
    ],
    "conversationPrompt": "Tady už něco je. Tady zatím nic.",
    "primaryArea": "spaceQuantity",
    "relatedAreas": [],
    "topicIds": [
      "space.more-less"
    ],
    "activityFamilyId": null,
    "sources": [
      {
        "label": "NAEYC — Articles for Families on Math",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.naeyc.org/our-work/families/math",
        "supportsPrinciple": "množství, třídění, prostor a měření v běžném prostředí. Není důkazem, že náš věkový filtr vyhovuje konkrétnímu dítěti."
      }
    ],
    "suitability": [
      {
        "kind": "age_months",
        "fromInclusive": 16,
        "toInclusive": 23
      },
      {
        "kind": "requires_birth_date"
      },
      {
        "kind": "environment_one_of",
        "environments": [
          "home"
        ]
      },
      {
        "kind": "materials_all_of",
        "materials": [
          "dvě nízké lehké nádoby a několik velkých věkově vhodných kostek"
        ]
      }
    ],
    "editorial": {
      "stage": "published",
      "history": [
        {
          "stage": "expert_reviewed",
          "author": "Tomáš Holý",
          "note": "Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.",
          "atMs": 1794126600000,
          "outcome": "passed"
        },
        {
          "stage": "language_ux",
          "author": "Alena Světlá",
          "note": "Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.",
          "atMs": 1794137400000,
          "outcome": "passed"
        },
        {
          "stage": "parent_verified",
          "author": "Barbora Bílá",
          "note": "Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.",
          "atMs": 1794148200000,
          "outcome": "passed"
        },
        {
          "stage": "published",
          "author": "redakce LUMI",
          "note": "Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.",
          "atMs": 1794155400000,
          "outcome": "passed"
        }
      ]
    },
    "withdrawnReason": null,
    "fixtureKind": "product"
  },
  {
    "activityId": "toddler-first-large-mark",
    "revisionId": "toddler-first-large-mark.r1",
    "language": "cs",
    "title": "Velká čára",
    "ageMonths": {
      "fromInclusive": 16,
      "toInclusive": 23
    },
    "readinessNotes": "Pečující výslovně potvrdil bezpečné použití nepoškozené věkově vhodné kreslicí pomůcky pod přímým dohledem.",
    "environments": [
      "home"
    ],
    "materials": [
      "velký papír a nepoškozená věkově vhodná silná pastelka bez oddělitelného víčka"
    ],
    "constraints": [
      "Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.",
      "Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.",
      "Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.",
      "Pečující výslovně potvrdil bezpečné použití nepoškozené věkově vhodné kreslicí pomůcky pod přímým dohledem.",
      "Pouze při potvrzeném bezpečném zacházení s kreslicí pomůckou a přímém dohledu; při vkládání do úst přestat."
    ],
    "duration": {
      "kind": "moment"
    },
    "steps": [
      "Připravte papír na stabilní pracovní plochu",
      "Nabídněte pastelku a přijměte libovolnou stopu",
      "Pojmenujte pohyb bez hodnocení výsledku"
    ],
    "conversationPrompt": "Tvoje ruka udělala stopu.",
    "primaryArea": "creationRhythm",
    "relatedAreas": [],
    "topicIds": [
      "create.drawing"
    ],
    "activityFamilyId": null,
    "sources": [
      {
        "label": "NAEYC — Play",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.naeyc.org/resources/topics/play",
        "supportsPrinciple": "hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky."
      }
    ],
    "suitability": [
      {
        "kind": "age_months",
        "fromInclusive": 16,
        "toInclusive": 23
      },
      {
        "kind": "requires_birth_date"
      },
      {
        "kind": "environment_one_of",
        "environments": [
          "home"
        ]
      },
      {
        "kind": "materials_all_of",
        "materials": [
          "velký papír a nepoškozená věkově vhodná silná pastelka bez oddělitelného víčka"
        ]
      },
      {
        "kind": "readiness_confirmed",
        "key": "safeMarkMaking"
      }
    ],
    "editorial": {
      "stage": "published",
      "history": [
        {
          "stage": "expert_reviewed",
          "author": "Tomáš Holý",
          "note": "Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.",
          "atMs": 1794126600000,
          "outcome": "passed"
        },
        {
          "stage": "language_ux",
          "author": "Alena Světlá",
          "note": "Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.",
          "atMs": 1794137400000,
          "outcome": "passed"
        },
        {
          "stage": "parent_verified",
          "author": "Barbora Bílá",
          "note": "Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.",
          "atMs": 1794148200000,
          "outcome": "passed"
        },
        {
          "stage": "published",
          "author": "redakce LUMI",
          "note": "Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.",
          "atMs": 1794155400000,
          "outcome": "passed"
        }
      ]
    },
    "withdrawnReason": null,
    "fixtureKind": "product"
  },
  {
    "activityId": "toddler-toy-home-basket",
    "revisionId": "toddler-toy-home-basket.r1",
    "language": "cs",
    "title": "Hračka má svoje místo",
    "ageMonths": {
      "fromInclusive": 16,
      "toInclusive": 23
    },
    "readinessNotes": "Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.",
    "environments": [
      "home"
    ],
    "materials": [
      "jedna hračka a nízký otevřený košík bez výpletu uvolňujícího části"
    ],
    "constraints": [
      "Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.",
      "Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.",
      "Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.",
      "Neuklízet dítěti hru za trest ani nepodmiňovat péči splněním úkolu."
    ],
    "duration": {
      "kind": "moment"
    },
    "steps": [
      "Ukažte jedno dostupné místo pro hračku",
      "Nabídněte společné odložení",
      "Pomozte nebo úkon dokončete, pokud dítě nechce"
    ],
    "conversationPrompt": "Tady může hračka odpočívat. Pomůžu ti.",
    "primaryArea": "autonomy",
    "relatedAreas": [],
    "topicIds": [
      "auto.routine"
    ],
    "activityFamilyId": null,
    "sources": [
      {
        "label": "UNICEF — Learning activities for babies and toddlers",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.unicef.org/parenting/child-care/21-learning-activities-babies-and-toddlers",
        "supportsPrinciple": "příležitosti k učení v běžném společném dni. Naše seznamy nejsou reprodukcí tohoto článku ani převzetím všech jeho pomůcek."
      }
    ],
    "suitability": [
      {
        "kind": "age_months",
        "fromInclusive": 16,
        "toInclusive": 23
      },
      {
        "kind": "requires_birth_date"
      },
      {
        "kind": "environment_one_of",
        "environments": [
          "home"
        ]
      },
      {
        "kind": "materials_all_of",
        "materials": [
          "jedna hračka a nízký otevřený košík bez výpletu uvolňujícího části"
        ]
      }
    ],
    "editorial": {
      "stage": "published",
      "history": [
        {
          "stage": "expert_reviewed",
          "author": "Tomáš Holý",
          "note": "Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.",
          "atMs": 1794126600000,
          "outcome": "passed"
        },
        {
          "stage": "language_ux",
          "author": "Alena Světlá",
          "note": "Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.",
          "atMs": 1794137400000,
          "outcome": "passed"
        },
        {
          "stage": "parent_verified",
          "author": "Barbora Bílá",
          "note": "Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.",
          "atMs": 1794148200000,
          "outcome": "passed"
        },
        {
          "stage": "published",
          "author": "redakce LUMI",
          "note": "Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.",
          "atMs": 1794155400000,
          "outcome": "passed"
        }
      ]
    },
    "withdrawnReason": null,
    "fixtureKind": "product"
  },
  {
    "activityId": "toddler-plush-needs-pause",
    "revisionId": "toddler-plush-needs-pause.r1",
    "language": "cs",
    "title": "Plyšák potřebuje pauzu",
    "ageMonths": {
      "fromInclusive": 20,
      "toInclusive": 23
    },
    "readinessNotes": "Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.",
    "environments": [
      "home"
    ],
    "materials": [
      "velký věkově vhodný plyšák bez drobných částí"
    ],
    "constraints": [
      "Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.",
      "Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.",
      "Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.",
      "Nedovozovat z odpovědi emoce či diagnózu dítěte; nevyžadovat objímání."
    ],
    "duration": {
      "kind": "moment"
    },
    "steps": [
      "Zahrajte krátký příběh, že plyšák chce být chvíli v klidu",
      "Nabídněte dítěti volbu, zda mu uděláte prostor",
      "Přijměte jiný dětský nápad"
    ],
    "conversationPrompt": "Možná chce pauzu. Co mu nabídneme?",
    "primaryArea": "relationship",
    "relatedAreas": [],
    "topicIds": [
      "rel.comfort"
    ],
    "activityFamilyId": null,
    "sources": [
      {
        "label": "NAEYC — Play",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.naeyc.org/resources/topics/play",
        "supportsPrinciple": "hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky."
      },
      {
        "label": "Harvard Center on the Developing Child — Serve and Return",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://developingchild.harvard.edu/key-concept/serve-and-return/",
        "supportsPrinciple": "citlivá odpověď dospělého na iniciativu dítěte. Nevyžaduje, aby dítě odpovídalo jedním předepsaným způsobem."
      }
    ],
    "suitability": [
      {
        "kind": "age_months",
        "fromInclusive": 20,
        "toInclusive": 23
      },
      {
        "kind": "requires_birth_date"
      },
      {
        "kind": "environment_one_of",
        "environments": [
          "home"
        ]
      },
      {
        "kind": "materials_all_of",
        "materials": [
          "velký věkově vhodný plyšák bez drobných částí"
        ]
      }
    ],
    "editorial": {
      "stage": "published",
      "history": [
        {
          "stage": "expert_reviewed",
          "author": "Tomáš Holý",
          "note": "Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.",
          "atMs": 1794126600000,
          "outcome": "passed"
        },
        {
          "stage": "language_ux",
          "author": "Alena Světlá",
          "note": "Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.",
          "atMs": 1794137400000,
          "outcome": "passed"
        },
        {
          "stage": "parent_verified",
          "author": "Barbora Bílá",
          "note": "Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.",
          "atMs": 1794148200000,
          "outcome": "passed"
        },
        {
          "stage": "published",
          "author": "redakce LUMI",
          "note": "Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.",
          "atMs": 1794155400000,
          "outcome": "passed"
        }
      ]
    },
    "withdrawnReason": null,
    "fixtureKind": "product"
  },
  {
    "activityId": "toddler-familiar-story-pause",
    "revisionId": "toddler-familiar-story-pause.r1",
    "language": "cs",
    "title": "Pauza ve známém příběhu",
    "ageMonths": {
      "fromInclusive": 20,
      "toInclusive": 23
    },
    "readinessNotes": "Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.",
    "environments": [
      "home"
    ],
    "materials": [
      "známé leporelo nebo vlastní krátká říkanka"
    ],
    "constraints": [
      "Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.",
      "Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.",
      "Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.",
      "Nečekat na povinné doplnění ani neopravovat výslovnost."
    ],
    "duration": {
      "kind": "moment"
    },
    "steps": [
      "Přečtěte či řekněte krátkou známou část",
      "Udělejte přirozenou pauzu",
      "Přijměte slovo, zvuk, gesto i ticho a dokončete příběh"
    ],
    "conversationPrompt": "A potom… můžeme pokračovat spolu.",
    "primaryArea": "speech",
    "relatedAreas": [],
    "topicIds": [
      "speech.listening"
    ],
    "activityFamilyId": "family.toddler-shared-story",
    "sources": [
      {
        "label": "Harvard Center on the Developing Child — Serve and Return",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://developingchild.harvard.edu/key-concept/serve-and-return/",
        "supportsPrinciple": "citlivá odpověď dospělého na iniciativu dítěte. Nevyžaduje, aby dítě odpovídalo jedním předepsaným způsobem."
      },
      {
        "label": "NAEYC — Everyday Steps to Reading and Writing",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.naeyc.org/our-work/families/everyday-steps-reading-and-writing",
        "supportsPrinciple": "význam čtení, vyprávění a smysluplného používání jazyka doma. Nejde o povinný termín samostatného čtení."
      }
    ],
    "suitability": [
      {
        "kind": "age_months",
        "fromInclusive": 20,
        "toInclusive": 23
      },
      {
        "kind": "requires_birth_date"
      },
      {
        "kind": "environment_one_of",
        "environments": [
          "home"
        ]
      },
      {
        "kind": "materials_all_of",
        "materials": [
          "známé leporelo nebo vlastní krátká říkanka"
        ]
      }
    ],
    "editorial": {
      "stage": "published",
      "history": [
        {
          "stage": "expert_reviewed",
          "author": "Tomáš Holý",
          "note": "Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.",
          "atMs": 1794126600000,
          "outcome": "passed"
        },
        {
          "stage": "language_ux",
          "author": "Alena Světlá",
          "note": "Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.",
          "atMs": 1794137400000,
          "outcome": "passed"
        },
        {
          "stage": "parent_verified",
          "author": "Barbora Bílá",
          "note": "Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.",
          "atMs": 1794148200000,
          "outcome": "passed"
        },
        {
          "stage": "published",
          "author": "redakce LUMI",
          "note": "Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.",
          "atMs": 1794155400000,
          "outcome": "passed"
        }
      ]
    },
    "withdrawnReason": null,
    "fixtureKind": "product"
  },
  {
    "activityId": "toddler-slow-motion-statues",
    "revisionId": "toddler-slow-motion-statues.r1",
    "language": "cs",
    "title": "Pomalý pohyb a zastavení",
    "ageMonths": {
      "fromInclusive": 20,
      "toInclusive": 23
    },
    "readinessNotes": "Dítě už se samo pohybuje po bezpečné podlaze.",
    "environments": [
      "home"
    ],
    "materials": [],
    "constraints": [
      "Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.",
      "Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.",
      "Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.",
      "Dítě už se samo pohybuje po bezpečné podlaze.",
      "Žádné rychlé povely, běh, zavírání očí nebo závod; respektovat rovnováhu a únavu."
    ],
    "duration": {
      "kind": "moment"
    },
    "steps": [
      "Pohybujte se pomalu osvojeným způsobem vedle dítěte",
      "Zastavte se a nabídněte, zda chce také pauzu",
      "Pokračujte podle jeho volby"
    ],
    "conversationPrompt": "Já teď stojím. Ty si vyber svůj pohyb.",
    "primaryArea": "movement",
    "relatedAreas": [],
    "topicIds": [
      "move.self-directed"
    ],
    "activityFamilyId": null,
    "sources": [
      {
        "label": "NAEYC — Play",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.naeyc.org/resources/topics/play",
        "supportsPrinciple": "hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky."
      },
      {
        "label": "Royal Children's Hospital — Toy safety",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.rch.org.au/kidsinfo/fact_sheets/Toy_safety/",
        "supportsPrinciple": "bezpečnost a věkové určení pomůcek. Slouží jako podklad pro kontrolu rizik; nenahrazuje posouzení každého materiálu a situace."
      }
    ],
    "suitability": [
      {
        "kind": "age_months",
        "fromInclusive": 20,
        "toInclusive": 23
      },
      {
        "kind": "requires_birth_date"
      },
      {
        "kind": "environment_one_of",
        "environments": [
          "home"
        ]
      },
      {
        "kind": "materials_none"
      },
      {
        "kind": "readiness_confirmed",
        "key": "floorMove"
      }
    ],
    "editorial": {
      "stage": "published",
      "history": [
        {
          "stage": "expert_reviewed",
          "author": "Tomáš Holý",
          "note": "Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.",
          "atMs": 1794126600000,
          "outcome": "passed"
        },
        {
          "stage": "language_ux",
          "author": "Alena Světlá",
          "note": "Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.",
          "atMs": 1794137400000,
          "outcome": "passed"
        },
        {
          "stage": "parent_verified",
          "author": "Barbora Bílá",
          "note": "Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.",
          "atMs": 1794148200000,
          "outcome": "passed"
        },
        {
          "stage": "published",
          "author": "redakce LUMI",
          "note": "Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.",
          "atMs": 1794155400000,
          "outcome": "passed"
        }
      ]
    },
    "withdrawnReason": null,
    "fixtureKind": "product"
  },
  {
    "activityId": "toddler-large-paper-surfaces",
    "revisionId": "toddler-large-paper-surfaces.r1",
    "language": "cs",
    "title": "Papír pokaždé jinak",
    "ageMonths": {
      "fromInclusive": 20,
      "toInclusive": 23
    },
    "readinessNotes": "Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.",
    "environments": [
      "home"
    ],
    "materials": [
      "velké nepoškozené listy hladkého a pevného zvlněného papíru bez sponek"
    ],
    "constraints": [
      "Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.",
      "Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.",
      "Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.",
      "Při trhání a vkládání do úst skončit a odstranit útržky; žádné sáčky."
    ],
    "duration": {
      "kind": "moment"
    },
    "steps": [
      "Položte oba povrchy vedle sebe",
      "Nabídněte přejetí rukou nebo sledování pohybu papíru",
      "Popište rozdíl, který dítě samo zaujme"
    ],
    "conversationPrompt": "Tenhle šustí jinak. Chceš pokračovat?",
    "primaryArea": "senses",
    "relatedAreas": [],
    "topicIds": [
      "sense.texture"
    ],
    "activityFamilyId": null,
    "sources": [
      {
        "label": "NAEYC — Play",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.naeyc.org/resources/topics/play",
        "supportsPrinciple": "hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky."
      },
      {
        "label": "Royal Children's Hospital — Toy safety",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.rch.org.au/kidsinfo/fact_sheets/Toy_safety/",
        "supportsPrinciple": "bezpečnost a věkové určení pomůcek. Slouží jako podklad pro kontrolu rizik; nenahrazuje posouzení každého materiálu a situace."
      }
    ],
    "suitability": [
      {
        "kind": "age_months",
        "fromInclusive": 20,
        "toInclusive": 23
      },
      {
        "kind": "requires_birth_date"
      },
      {
        "kind": "environment_one_of",
        "environments": [
          "home"
        ]
      },
      {
        "kind": "materials_all_of",
        "materials": [
          "velké nepoškozené listy hladkého a pevného zvlněného papíru bez sponek"
        ]
      }
    ],
    "editorial": {
      "stage": "published",
      "history": [
        {
          "stage": "expert_reviewed",
          "author": "Tomáš Holý",
          "note": "Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.",
          "atMs": 1794126600000,
          "outcome": "passed"
        },
        {
          "stage": "language_ux",
          "author": "Alena Světlá",
          "note": "Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.",
          "atMs": 1794137400000,
          "outcome": "passed"
        },
        {
          "stage": "parent_verified",
          "author": "Barbora Bílá",
          "note": "Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.",
          "atMs": 1794148200000,
          "outcome": "passed"
        },
        {
          "stage": "published",
          "author": "redakce LUMI",
          "note": "Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.",
          "atMs": 1794155400000,
          "outcome": "passed"
        }
      ]
    },
    "withdrawnReason": null,
    "fixtureKind": "product"
  },
  {
    "activityId": "toddler-find-same-big-picture",
    "revisionId": "toddler-find-same-big-picture.r1",
    "language": "cs",
    "title": "Dva stejné velké obrázky",
    "ageMonths": {
      "fromInclusive": 20,
      "toInclusive": 23
    },
    "readinessNotes": "Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.",
    "environments": [
      "home"
    ],
    "materials": [
      "dva páry velkých pevných bezpečných obrázků"
    ],
    "constraints": [
      "Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.",
      "Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.",
      "Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.",
      "Nehodnotit rychlost nebo chyby; při frustraci snížit výběr či skončit."
    ],
    "duration": {
      "kind": "moment"
    },
    "steps": [
      "Ukažte jeden obrázek a dvě možné dvojice",
      "Nabídněte společné hledání podobnosti",
      "Přijměte i vlastní spojení dítěte"
    ],
    "conversationPrompt": "Tyhle dva ti něco připomínají?",
    "primaryArea": "attention",
    "relatedAreas": [],
    "topicIds": [
      "attn.shared"
    ],
    "activityFamilyId": null,
    "sources": [
      {
        "label": "NAEYC — Play",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.naeyc.org/resources/topics/play",
        "supportsPrinciple": "hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky."
      },
      {
        "label": "Harvard Center on the Developing Child — Serve and Return",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://developingchild.harvard.edu/key-concept/serve-and-return/",
        "supportsPrinciple": "citlivá odpověď dospělého na iniciativu dítěte. Nevyžaduje, aby dítě odpovídalo jedním předepsaným způsobem."
      }
    ],
    "suitability": [
      {
        "kind": "age_months",
        "fromInclusive": 20,
        "toInclusive": 23
      },
      {
        "kind": "requires_birth_date"
      },
      {
        "kind": "environment_one_of",
        "environments": [
          "home"
        ]
      },
      {
        "kind": "materials_all_of",
        "materials": [
          "dva páry velkých pevných bezpečných obrázků"
        ]
      }
    ],
    "editorial": {
      "stage": "published",
      "history": [
        {
          "stage": "expert_reviewed",
          "author": "Tomáš Holý",
          "note": "Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.",
          "atMs": 1794126600000,
          "outcome": "passed"
        },
        {
          "stage": "language_ux",
          "author": "Alena Světlá",
          "note": "Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.",
          "atMs": 1794137400000,
          "outcome": "passed"
        },
        {
          "stage": "parent_verified",
          "author": "Barbora Bílá",
          "note": "Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.",
          "atMs": 1794148200000,
          "outcome": "passed"
        },
        {
          "stage": "published",
          "author": "redakce LUMI",
          "note": "Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.",
          "atMs": 1794155400000,
          "outcome": "passed"
        }
      ]
    },
    "withdrawnReason": null,
    "fixtureKind": "product"
  },
  {
    "activityId": "toddler-big-small-cloth",
    "revisionId": "toddler-big-small-cloth.r1",
    "language": "cs",
    "title": "Velký a menší kus",
    "ageMonths": {
      "fromInclusive": 20,
      "toInclusive": 23
    },
    "readinessNotes": "Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.",
    "environments": [
      "home"
    ],
    "materials": [
      "dva velké kusy oblečení bez šňůrek, oba bezpečně větší než drobná součást"
    ],
    "constraints": [
      "Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.",
      "Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.",
      "Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.",
      "Nic neomotávat kolem krku ani nenutit oblékání; pomůcky musí zůstat bezpečné."
    ],
    "duration": {
      "kind": "moment"
    },
    "steps": [
      "Položte oba kusy vedle sebe",
      "Nabídněte jejich přiložení nebo přesunutí",
      "Popište konkrétní rozdíl bez zkoušení názvů"
    ],
    "conversationPrompt": "Tenhle zabere víc místa.",
    "primaryArea": "spaceQuantity",
    "relatedAreas": [],
    "topicIds": [
      "space.compare-size"
    ],
    "activityFamilyId": null,
    "sources": [
      {
        "label": "NAEYC — Articles for Families on Math",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.naeyc.org/our-work/families/math",
        "supportsPrinciple": "množství, třídění, prostor a měření v běžném prostředí. Není důkazem, že náš věkový filtr vyhovuje konkrétnímu dítěti."
      }
    ],
    "suitability": [
      {
        "kind": "age_months",
        "fromInclusive": 20,
        "toInclusive": 23
      },
      {
        "kind": "requires_birth_date"
      },
      {
        "kind": "environment_one_of",
        "environments": [
          "home"
        ]
      },
      {
        "kind": "materials_all_of",
        "materials": [
          "dva velké kusy oblečení bez šňůrek, oba bezpečně větší než drobná součást"
        ]
      }
    ],
    "editorial": {
      "stage": "published",
      "history": [
        {
          "stage": "expert_reviewed",
          "author": "Tomáš Holý",
          "note": "Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.",
          "atMs": 1794126600000,
          "outcome": "passed"
        },
        {
          "stage": "language_ux",
          "author": "Alena Světlá",
          "note": "Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.",
          "atMs": 1794137400000,
          "outcome": "passed"
        },
        {
          "stage": "parent_verified",
          "author": "Barbora Bílá",
          "note": "Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.",
          "atMs": 1794148200000,
          "outcome": "passed"
        },
        {
          "stage": "published",
          "author": "redakce LUMI",
          "note": "Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.",
          "atMs": 1794155400000,
          "outcome": "passed"
        }
      ]
    },
    "withdrawnReason": null,
    "fixtureKind": "product"
  },
  {
    "activityId": "toddler-your-sound-my-answer",
    "revisionId": "toddler-your-sound-my-answer.r1",
    "language": "cs",
    "title": "Tvůj zvuk, moje odpověď",
    "ageMonths": {
      "fromInclusive": 20,
      "toInclusive": 23
    },
    "readinessNotes": "Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.",
    "environments": [
      "home"
    ],
    "materials": [],
    "constraints": [
      "Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.",
      "Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.",
      "Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.",
      "Bez hudebního testu a hlasitých úderů; nevynucovat opakování."
    ],
    "duration": {
      "kind": "moment"
    },
    "steps": [
      "Počkejte na vlastní zvuk nebo rytmický pohyb dítěte",
      "Krátce jej napodobte v klidné hlasitosti",
      "Nechte dítě změnit motiv nebo přestat"
    ],
    "conversationPrompt": "Slyším tvůj rytmus. Můžu odpovědět?",
    "primaryArea": "creationRhythm",
    "relatedAreas": [],
    "topicIds": [
      "create.rhythm"
    ],
    "activityFamilyId": "family.toddler-rhythm",
    "sources": [
      {
        "label": "NAEYC — Play",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.naeyc.org/resources/topics/play",
        "supportsPrinciple": "hra může propojit více oblastí učení v raném dětství. Podporuje rámec dobrovolné hry, nikoli záruku přínosu konkrétní naší položky."
      }
    ],
    "suitability": [
      {
        "kind": "age_months",
        "fromInclusive": 20,
        "toInclusive": 23
      },
      {
        "kind": "requires_birth_date"
      },
      {
        "kind": "environment_one_of",
        "environments": [
          "home"
        ]
      },
      {
        "kind": "materials_none"
      }
    ],
    "editorial": {
      "stage": "published",
      "history": [
        {
          "stage": "expert_reviewed",
          "author": "Tomáš Holý",
          "note": "Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.",
          "atMs": 1794126600000,
          "outcome": "passed"
        },
        {
          "stage": "language_ux",
          "author": "Alena Světlá",
          "note": "Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.",
          "atMs": 1794137400000,
          "outcome": "passed"
        },
        {
          "stage": "parent_verified",
          "author": "Barbora Bílá",
          "note": "Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.",
          "atMs": 1794148200000,
          "outcome": "passed"
        },
        {
          "stage": "published",
          "author": "redakce LUMI",
          "note": "Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.",
          "atMs": 1794155400000,
          "outcome": "passed"
        }
      ]
    },
    "withdrawnReason": null,
    "fixtureKind": "product"
  },
  {
    "activityId": "toddler-choose-help-signal",
    "revisionId": "toddler-choose-help-signal.r1",
    "language": "cs",
    "title": "Jak si řekneme o pomoc",
    "ageMonths": {
      "fromInclusive": 20,
      "toInclusive": 23
    },
    "readinessNotes": "Společné bezpečnostní podmínky a dobrovolný zájem; bez dalšího povinného dovednostního potvrzení.",
    "environments": [
      "home"
    ],
    "materials": [],
    "constraints": [
      "Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.",
      "Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.",
      "Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.",
      "Potřebnou pomoc nikdy neodpírat do vyslovení určitého slova."
    ],
    "duration": {
      "kind": "moment"
    },
    "steps": [
      "Při drobné obtíži nabídněte dostupnou pomoc",
      "Ukažte, že stačí gesto, pohled či slovo",
      "Pomozte bez zdržování a dovolte dítěti pokračovat"
    ],
    "conversationPrompt": "Jsem tady. Můžeš mi ukázat, s čím pomoci.",
    "primaryArea": "autonomy",
    "relatedAreas": [],
    "topicIds": [
      "auto.help-choice"
    ],
    "activityFamilyId": null,
    "sources": [
      {
        "label": "UNICEF — Learning activities for babies and toddlers",
        "checkedOn": "2026-11-08",
        "kind": "internal",
        "url": "https://www.unicef.org/parenting/child-care/21-learning-activities-babies-and-toddlers",
        "supportsPrinciple": "příležitosti k učení v běžném společném dni. Naše seznamy nejsou reprodukcí tohoto článku ani převzetím všech jeho pomůcek."
      }
    ],
    "suitability": [
      {
        "kind": "age_months",
        "fromInclusive": 20,
        "toInclusive": 23
      },
      {
        "kind": "requires_birth_date"
      },
      {
        "kind": "environment_one_of",
        "environments": [
          "home"
        ]
      },
      {
        "kind": "materials_none"
      }
    ],
    "editorial": {
      "stage": "published",
      "history": [
        {
          "stage": "expert_reviewed",
          "author": "Tomáš Holý",
          "note": "Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.",
          "atMs": 1794126600000,
          "outcome": "passed"
        },
        {
          "stage": "language_ux",
          "author": "Alena Světlá",
          "note": "Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.",
          "atMs": 1794137400000,
          "outcome": "passed"
        },
        {
          "stage": "parent_verified",
          "author": "Barbora Bílá",
          "note": "Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.",
          "atMs": 1794148200000,
          "outcome": "passed"
        },
        {
          "stage": "published",
          "author": "redakce LUMI",
          "note": "Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.",
          "atMs": 1794155400000,
          "outcome": "passed"
        }
      ]
    },
    "withdrawnReason": null,
    "fixtureKind": "product"
  }
] as const satisfies readonly ActivityRevision[];
