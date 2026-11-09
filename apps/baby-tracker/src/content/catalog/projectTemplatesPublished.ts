/**
 * Published project template catalog (12). Content approval recorded 2026-11-08
 * (Holý / Světlá / Bílá via owner). Templates are general offline content —
 * never personal child projects.
 */
import {
  asProjectTemplateId,
  asProjectTemplateRevisionId,
  type ProjectTemplateRevision,
} from '../../domain/projects/types';

export const PROJECT_TEMPLATES_CONTENT_VERSION = 'project-templates.v1' as const;

const SOURCE_EEF = {
  label: 'EEF — Metacognition and self-regulation',
  checkedOn: '2026-11-08',
  kind: 'internal' as const,
  url: 'https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/metacognition-and-self-regulation',
  supportsPrinciple:
    'plán–pokus–dobrovolná reflexe v konkrétní činnosti; není autorem schválení jednotlivých šablon',
};

function template(
  partial: Omit<ProjectTemplateRevision, 'language' | 'sources'> & {
    sources?: ProjectTemplateRevision['sources'];
  },
): ProjectTemplateRevision {
  return {
    language: 'cs',
    sources: partial.sources ?? [SOURCE_EEF],
    ...partial,
  };
}

export const PROJECT_TEMPLATES_PUBLISHED: readonly ProjectTemplateRevision[] = [
  template({
    templateId: asProjectTemplateId('paper-bridge-lab'),
    revisionId: asProjectTemplateRevisionId('paper-bridge-lab.r1'),
    title: 'Papírový most',
    cohort: '8-11',
    theme: 'Tvoření a ověřování nápadu',
    intent: 'Zkusit dvě podoby malého papírového modelu a popsat rozdíl.',
    materials: ['papír', 'dvě nízké stabilní podpěry', 'tužka'],
    offeredSessions: '2–3 dobrovolné chvíle po 10 minutách',
    steps: [
      'Vyberu, co na mostu chci porovnat; nakreslím první nápad.',
      'S dospělým připravím nízký stolní model, který není pro člověka.',
      'Zkusím druhý tvar papíru a zaznamenám jednu skutečně viditelnou změnu.',
    ],
    portfolioHint: 'Náčrt obou modelů nebo jedna věta; fotografie jen volitelně později.',
    optionalReflection: 'Co bych chtěl/a příště změnit a co zatím nevím?',
    privacyNote: 'Soukromá ukázka návrhu; sdílet lze jen vybraný výsledek.',
    constraints: [
      'Žádné stavění mostu pro tělo, těžká závaží, nože, tavné lepidlo.',
      'Nehodnotit nosnost podle jediného pokusu.',
    ],
  }),
  template({
    templateId: asProjectTemplateId('ordinary-things-atlas'),
    revisionId: asProjectTemplateRevisionId('ordinary-things-atlas.r1'),
    title: 'Atlas obyčejných věcí',
    cohort: '8-11',
    theme: 'Pozorování a popis',
    intent: 'Vybrat tři bezpečné známé předměty a odlišit pozorování od vlastního odhadu.',
    materials: ['papír', 'tužka', 'tři velké bezpečné předměty'],
    offeredSessions: '2 chvíle po 10 minutách',
    steps: [
      'Vyberu tři obyčejné předměty, které nepatří do soukromí někoho jiného.',
      'Každý nakreslím nebo popíšu jednou viditelnou vlastností.',
      'Doplním otázku, na kterou odpověď zatím nemám.',
    ],
    portfolioHint: 'Tři malé karty na papíře nebo tři textové záznamy v projektu.',
    optionalReflection: 'Co jsem opravdu viděl/a a co jsem si jen myslel/a?',
    privacyNote: 'Nevkládat osobní doklady, adresy, klíče nebo cizí citlivé věci.',
    constraints: [
      'Žádné rozebírání přístrojů, chemikálie ani hledání neznámých přírodnin.',
    ],
  }),
  template({
    templateId: asProjectTemplateId('four-scene-story'),
    revisionId: asProjectTemplateRevisionId('four-scene-story.r1'),
    title: 'Příběh ve čtyřech scénách',
    cohort: '8-11',
    theme: 'Jazyk a tvoření',
    intent: 'Vytvořit vlastní krátký příběh obrazem, textem nebo vyprávěním dospělému.',
    materials: ['papír', 'bezpečné kreslicí pomůcky'],
    offeredSessions: '2–4 chvíle po 10 minutách',
    steps: [
      'Vyberu vlastní postavu a situaci.',
      'Nakreslím nebo popíšu čtyři scény s jednou změnou.',
      'Vyberu konec a rozhodnu, zda chci někomu ukázat jednu scénu.',
    ],
    portfolioHint: 'Vlastní komiks; aplikace ukládá text/poznámku, nevyžaduje kreslicí editor.',
    optionalReflection: 'Která část mě bavila a kterou bych nechal/a jinak?',
    privacyNote: 'Příběh může zůstat celý soukromý; zveřejnění není podmínka dokončení.',
    constraints: [
      'Nevkládat cizí fotografie, celé převzaté knihy nebo citlivé příběhy spolužáků.',
    ],
  }),
  template({
    templateId: asProjectTemplateId('builder-instructions'),
    revisionId: asProjectTemplateRevisionId('builder-instructions.r1'),
    title: 'Návod pro stavitele',
    cohort: '8-11',
    theme: 'Postup a spolupráce',
    intent: 'Připravit návod k malé stavbě a upravit jej podle zkušenosti druhého.',
    materials: ['velké bezpečné kostky', 'papír'],
    offeredSessions: '2 chvíle po 10 minutách',
    steps: [
      'Zvolím malou stavbu a napíšu, nadiktuji do textu nebo nakreslím několik kroků.',
      'Dospělý zkusí postup a může se doptávat.',
      'Upravím jeden krok, který potřeboval upřesnit.',
    ],
    portfolioHint: 'Krátký návod a volitelná věta o změně.',
    optionalReflection: 'Co druhému pomohlo a co bych chtěl/a vysvětlit jinak?',
    privacyNote: 'Zpětná vazba při činnosti není automaticky komentář uložený rodině.',
    constraints: [
      'Žádné slepé následování nebezpečných pokynů; nejde o spouštění kódu.',
    ],
  }),
  template({
    templateId: asProjectTemplateId('one-variable-notebook'),
    revisionId: asProjectTemplateRevisionId('one-variable-notebook.r1'),
    title: 'Zápisník jednoho pokusu',
    cohort: '12-14',
    theme: 'Otázka, pozorování a nejistota',
    intent: 'Popsat jeden bezpečný papírový pokus a oddělit otázku, pozorování a interpretaci.',
    materials: ['papír', 'tužka', 'nízká pracovní plocha'],
    offeredSessions: '2–3 chvíle po 15 minutách',
    steps: [
      'Vyberu otázku o tvaru papírového modelu a jednu měněnou vlastnost.',
      'Porovnám dvě varianty za podobných bezpečných podmínek.',
      'Zapíšu pozorování a omezení, nikoli slib obecného výsledku.',
    ],
    portfolioHint: 'Malá tabulka nebo tři krátké odstavce.',
    optionalReflection: 'Co by bylo potřeba ověřit, než z toho udělám závěr?',
    privacyNote: 'Bez sběru osobních dat dalších lidí nebo domácího monitorování.',
    constraints: [
      'Pouze papírový model; žádná elektřina, chemie, oheň ani pokusy na lidech.',
    ],
  }),
  template({
    templateId: asProjectTemplateId('two-possible-solutions'),
    revisionId: asProjectTemplateRevisionId('two-possible-solutions.r1'),
    title: 'Dvě možná řešení',
    cohort: '12-14',
    theme: 'Argumentace a perspektiva',
    intent: 'Porovnat dva návrhy smyšleného bezpečného problému bez žebříčku správných názorů.',
    materials: ['papír nebo textový projekt'],
    offeredSessions: '2 chvíle po 10 minutách',
    steps: [
      'Vyberu smyšlený problém, například uspořádání herního koutku.',
      'Sepíšu dvě řešení, jeden důvod pro každé a jednu nejistotu.',
      'Zkusím nápad vysvětlit vybranému člověku, jen pokud chci.',
    ],
    portfolioHint: 'Dvě krátké varianty a vlastní volba nebo otevřená otázka.',
    optionalReflection: 'Co by mohlo změnit můj názor?',
    privacyNote: 'Není to povinné sdílení politických, zdravotních nebo rodinných postojů.',
    constraints: [
      'Nezadávat skutečný vztahový konflikt, šikanu či citlivé dilema jako experiment.',
    ],
  }),
  template({
    templateId: asProjectTemplateId('paper-prototype'),
    revisionId: asProjectTemplateRevisionId('paper-prototype.r1'),
    title: 'Papírový prototyp užitečné věci',
    cohort: '12-14',
    theme: 'Návrh a tvoření',
    intent: 'Vymyslet malou pomůcku na papíře, ukázat její použití a upravit jeden detail.',
    materials: ['papír', 'bezpečné kreslicí pomůcky'],
    offeredSessions: '3 chvíle po 15 minutách',
    steps: [
      'Vyberu drobnou potřebu bez sběru citlivých údajů.',
      'Nakreslím dvě nebo tři podoby a vysvětlím jejich použití.',
      'Na základě vlastní zkušenosti nebo vyžádané reakce upravím jednu část.',
    ],
    portfolioHint: 'Papírový prototyp s popisem, nikoli nová aplikace generovaná za běhu.',
    optionalReflection: 'Komu by to mohlo pomoci a co jsem zatím neověřil/a?',
    privacyNote: 'Fotografie prostředí a osoby se nepřidávají automaticky.',
    constraints: [
      'Bez výroby elektrického zařízení a oprav skutečných bezpečnostních pomůcek.',
    ],
  }),
  template({
    templateId: asProjectTemplateId('story-in-two-languages'),
    revisionId: asProjectTemplateRevisionId('story-in-two-languages.r1'),
    title: 'Příběh ve dvou jazycích',
    cohort: '12-14',
    theme: 'Jazyk a vyjadřování',
    intent: 'Vyjádřit vlastní krátkou situaci dvěma známými jazykovými způsoby a všimnout si rozdílu.',
    materials: ['papír nebo text', 'volitelně ověřený známý slovník'],
    offeredSessions: '2–3 chvíle po 10 minutách',
    steps: [
      'Vyberu vlastní krátkou situaci a dvě formy vyjádření, které skutečně používám.',
      'Vytvořím krátkou verzi v každé z nich s dostupnou pomocí.',
      'Poznamenám, co se mi překládalo jinak nebo co chci ověřit.',
    ],
    portfolioHint: 'Dvě krátké vlastní varianty; při jednom jazyce příběh pro dva čtenáře.',
    optionalReflection: 'Co jsem chtěl/a zachovat a kde si nejsem jistý/á?',
    privacyNote: 'Bez nahrávání hlasu, cloudového překladu nebo hodnocení přízvuku.',
    constraints: [
      'Nepřebírat cizí chráněný text ani nepředstírat správnost neověřeného překladu.',
    ],
  }),
  template({
    templateId: asProjectTemplateId('my-own-project-brief'),
    revisionId: asProjectTemplateRevisionId('my-own-project-brief.r1'),
    title: 'Projekt podle vlastního zadání',
    cohort: '15-17',
    theme: 'Vlastní zájem a plán',
    intent: 'Vymezit vlastní malý výsledek, první krok a potřebnou pomoc s právem směr změnit.',
    materials: ['text nebo papír'],
    offeredSessions: '3–5 volitelných chvil po 15 minutách',
    steps: [
      'Napíšu, co chci zkusit, proč a co do projektu nepatří.',
      'Vyberu první malý krok a člověka, kterého mohu požádat o podporu.',
      'Po pokusu zvolím pokračovat, změnit zadání, odložit nebo uzavřít.',
    ],
    portfolioHint: 'Vlastní brief a jedna vybraná ukázka pokusu.',
    optionalReflection: 'Je to stále můj zájem, nebo chci něco jiného?',
    privacyNote: 'Rodičovský návrh nevytvoří povinnost; průběh se automaticky nehlásí.',
    constraints: [
      'Obecný template neopravňuje rizikové nástroje, samostatné cestování či kontakt s cizí osobou.',
    ],
  }),
  template({
    templateId: asProjectTemplateId('small-research-question'),
    revisionId: asProjectTemplateRevisionId('small-research-question.r1'),
    title: 'Malá výzkumná otázka',
    cohort: '15-17',
    theme: 'Práce se zdrojem',
    intent: 'Formulovat otázku, zaznamenat původ informací a odlišit doložené tvrzení od otevřené otázky.',
    materials: ['text/papír', 'jedna dostupná důvěryhodná publikace nebo vlastní bezpečné pozorování'],
    offeredSessions: '3 chvíle po 15 minutách',
    steps: [
      'Vyberu neosobní otázku a zapíšu, co by byla použitelná odpověď.',
      'Uvedu dostupný zdroj, datum a co skutečně podporuje; bez sítě mohu připravit jen otázku.',
      'Zformuluji krátký závěr i omezení a označím neověřené části.',
    ],
    portfolioHint: 'Krátká rešeršní karta s odkazem/názvem, datem a nejistotou.',
    optionalReflection: 'Co můj podklad nedokládá?',
    privacyNote: 'Žádné automatické procházení deníku dítěte ani dotazníky spolužákům.',
    constraints: [
      'Nejde o zdravotní, právní nebo finanční poradenství; neověřené tvrzení zůstane neověřené.',
    ],
  }),
  template({
    templateId: asProjectTemplateId('explain-for-someone'),
    revisionId: asProjectTemplateRevisionId('explain-for-someone.r1'),
    title: 'Vysvětlení pro druhého',
    cohort: '15-17',
    theme: 'Prezentace a spolupráce',
    intent: 'Připravit vlastní srozumitelné vysvětlení známého tématu a upravit jej podle dobrovolné reakce.',
    materials: ['papír nebo textový projekt'],
    offeredSessions: '2–3 chvíle po 15 minutách',
    steps: [
      'Vyberu téma, kterému mohu poctivě věnovat krátké vysvětlení.',
      'Připravím tři hlavní body a příklad.',
      'Pokud chci, ukážu vybranou ukázku známému člověku a poznamenám jednu úpravu.',
    ],
    portfolioHint: 'Tři body, vlastní příklad a volitelná poznámka o reakci.',
    optionalReflection: 'Co bylo jasné a kde bych se příště doptal/a?',
    privacyNote: 'Bez veřejného uploadu, videonahrávky a automatického sdílení všech podkladů.',
    constraints: [
      'Žádná povinná prezentace před skupinou nebo oslovení neznámé osoby.',
    ],
  }),
  template({
    templateId: asProjectTemplateId('my-next-possibilities'),
    revisionId: asProjectTemplateRevisionId('my-next-possibilities.r1'),
    title: 'Mapa dalších možností',
    cohort: '15-17',
    theme: 'Volba dalšího směru',
    intent: 'Porovnat dvě nebo tři dítětem zvolené možnosti bez předpovědi kariéry nebo přijetí.',
    materials: ['text/papír'],
    offeredSessions: '2–4 chvíle po 15 minutách',
    steps: [
      'Zvolím, co mě zajímá, a dvě možnosti, které chci porovnat.',
      'U každé oddělím vlastní přání od ověřených podmínek, původu a data kontroly.',
      'Vyberu otázku nebo malý krok; mohu rozhodnutí odložit.',
    ],
    portfolioHint: 'Vlastní srovnání; neověřený odkaz není potvrzená nabídka ani termín.',
    optionalReflection: 'Co je pro mě důležité a čí představu chci nechat stranou?',
    privacyNote: 'Názory na školu a další směr jsou soukromé, dokud dítě samo nevybere ukázku.',
    constraints: [
      'Žádné automatické přihlášky, placení, scraping škol ani sliby výsledku.',
    ],
  }),
];

export function listProjectTemplatesByCohort(
  cohort: ProjectTemplateRevision['cohort'],
): ProjectTemplateRevision[] {
  return PROJECT_TEMPLATES_PUBLISHED.filter((row) => row.cohort === cohort);
}

export function findProjectTemplateRevision(
  revisionId: string,
): ProjectTemplateRevision | null {
  return PROJECT_TEMPLATES_PUBLISHED.find((row) => row.revisionId === revisionId) ?? null;
}

/** First caregiver-facing cohort pack — four offline templates for ages 8–11. */
export const PROJECT_COHORT_8_11_PACK = {
  packId: 'project-templates.8-11.v1',
  cohort: '8-11' as const,
  contentVersion: PROJECT_TEMPLATES_CONTENT_VERSION,
  revisionIds: listProjectTemplatesByCohort('8-11').map((row) => row.revisionId),
  offlineEmbedded: true,
} as const;

/** Second caregiver-facing cohort pack — four offline templates for ages 12–14. */
export const PROJECT_COHORT_12_14_PACK = {
  packId: 'project-templates.12-14.v1',
  cohort: '12-14' as const,
  contentVersion: PROJECT_TEMPLATES_CONTENT_VERSION,
  revisionIds: listProjectTemplatesByCohort('12-14').map((row) => row.revisionId),
  offlineEmbedded: true,
} as const;

export type ProjectCohortAvailability = {
  cohort: ProjectTemplateRevision['cohort'];
  offlineEmbedded: boolean;
  templateCount: number;
  revisionIds: readonly string[];
  detail: string;
};

/**
 * Truthful availability for caregiver discovery. Later cohorts stay listed as
 * published offline content without claiming a child account or age lock.
 */
export function describeProjectCohortAvailability(
  cohort: ProjectTemplateRevision['cohort'],
): ProjectCohortAvailability {
  const templates = listProjectTemplatesByCohort(cohort);
  if (cohort === '8-11') {
    return {
      cohort,
      offlineEmbedded: true,
      templateCount: templates.length,
      revisionIds: templates.map((row) => row.revisionId),
      detail:
        'Čtyři ověřené šablony 8–11 let jsou součástí instalace. Fungují bez účtu a bez sítě.',
    };
  }
  if (cohort === '12-14') {
    return {
      cohort,
      offlineEmbedded: true,
      templateCount: templates.length,
      revisionIds: templates.map((row) => row.revisionId),
      detail:
        'Čtyři ověřené šablony 12–14 let jsou v instalaci. Nabízejí více vlastní volby a porovnání variant — bez účtu a bez sítě.',
    };
  }
  return {
    cohort,
    offlineEmbedded: true,
    templateCount: templates.length,
    revisionIds: templates.map((row) => row.revisionId),
    detail:
      'Šablony jsou místně dostupné jako pečovatelský náhled. Soukromý dětský účet zatím není aktivní.',
  };
}

/** Local discovery search over published template titles and themes. */
export function searchPublishedProjectTemplates(query: string): ProjectTemplateRevision[] {
  const needle = query.trim().toLocaleLowerCase('cs');
  if (!needle) return [...PROJECT_TEMPLATES_PUBLISHED];
  return PROJECT_TEMPLATES_PUBLISHED.filter((row) => {
    const haystack = `${row.title} ${row.theme} ${row.intent} ${row.cohort}`.toLocaleLowerCase(
      'cs',
    );
    return haystack.includes(needle);
  });
}
