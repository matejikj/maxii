import type { DevelopmentArea } from '../../domain';
import type { ActivityTopic } from './types';

/**
 * Eight development areas shown to caregivers. Internal topic IDs are denser
 * editorial taxonomy — never a mandatory skill chain for the child.
 */
export const DEVELOPMENT_AREA_LABELS_CS: Record<DevelopmentArea, string> = {
  relationship: 'Vztah a emoce',
  speech: 'Řeč a komunikace',
  movement: 'Pohyb',
  senses: 'Smysly a objevování',
  attention: 'Pozornost',
  spaceQuantity: 'Prostor a množství',
  creationRhythm: 'Tvoření a rytmus',
  autonomy: 'Samostatnost',
};

/** Approximately thirty starter topics spanning the eight areas. */
export const STARTER_TOPICS: readonly ActivityTopic[] = [
  topic('rel.eye-contact', 'relationship', 'Oční kontakt', 'Krátké společné pohledy a úsměvy.'),
  topic('rel.comfort', 'relationship', 'Utěšení', 'Přítomnost a klid při nejistotě.'),
  topic('rel.turn-taking', 'relationship', 'Střídání', 'Jednoduché společné střídání bez soutěže.'),
  topic('rel.bonding-touch', 'relationship', 'Jemný dotek', 'Bezpečný kontakt rukou a hlazením.'),
  topic('speech.babble', 'speech', 'Žvatlání', 'Odpovídání na zvuky dítěte.'),
  topic('speech.naming', 'speech', 'Pojmenování', 'Jednoduchá jména věcí v okolí.'),
  topic('speech.songs', 'speech', 'Říkanky', 'Krátké říkanky a melodie.'),
  topic('speech.listening', 'speech', 'Naslouchání', 'Ticho a prostor pro odpověď dítěte.'),
  topic('move.tummy', 'movement', 'Na bříšku', 'Krátký čas na bříšku s oporou.'),
  topic('move.reach', 'movement', 'Sahání', 'Sahání po blízkém předmětu.'),
  topic('move.roll', 'movement', 'Přetáčení', 'Podpora přetáčení bez tlaku.'),
  topic('move.kick', 'movement', 'Kopání', 'Volný pohyb nohou.'),
  topic('sense.high-contrast', 'senses', 'Kontrast', 'Jednoduché kontrastní tvary.'),
  topic('sense.texture', 'senses', 'Textury', 'Bezpečné rozdílné povrchy.'),
  topic('sense.sound', 'senses', 'Zvuky', 'Tiché domácí zvuky a jejich zdroj.'),
  topic('sense.light', 'senses', 'Světlo a stín', 'Pozorování světla bez oslnění.'),
  topic('attn.track', 'attention', 'Sledování', 'Pomalé sledování předmětu očima.'),
  topic('attn.shared', 'attention', 'Sdílená pozornost', 'Společný pohled na jednu věc.'),
  topic(
    'attn.short-focus',
    'attention',
    'Krátké soustředění',
    'Krátký klidný moment bez přerušování.',
  ),
  topic(
    'space.near-far',
    'spaceQuantity',
    'Blízko a daleko',
    'Přibližování a oddalování předmětu.',
  ),
  topic('space.in-out', 'spaceQuantity', 'Dovnitř a ven', 'Jednoduché vkládání a vyjímání.'),
  topic('space.more-less', 'spaceQuantity', 'Víc a míň', 'Pozorování množství bez počítání.'),
  topic('create.rhythm', 'creationRhythm', 'Rytmus', 'Jemné tleskání nebo poklepání.'),
  topic(
    'create.voice-play',
    'creationRhythm',
    'Hra s hlasem',
    'Střídání tichých a hlasitějších zvuků.',
  ),
  topic('create.repeat', 'creationRhythm', 'Opakování', 'Stejný krátký motiv dokola.'),
  topic('auto.grasp', 'autonomy', 'Úchop', 'Držení bezpečného předmětu.'),
  topic('auto.release', 'autonomy', 'Pouštění', 'Vědomé pouštění předmětu.'),
  topic('auto.choice', 'autonomy', 'Volba', 'Výběr mezi dvěma bezpečnými možnostmi.'),
  topic(
    'auto.self-soothe',
    'autonomy',
    'Zklidnění',
    'Prostor, aby dítě našlo vlastní klid s oporou.',
  ),
  topic('auto.explore-safe', 'autonomy', 'Bezpečné zkoumání', 'Volný průzkum vymezeného prostoru.'),
  // Toddler / preschool expansion topics — additive; never rename historical ids.
  topic(
    'attn.change-test',
    'attention',
    'Jedna změna',
    'Porovnání vlastních bezpečných pokusů bez hodnocení výkonu.',
  ),
  topic(
    'attn.plan-reflect',
    'attention',
    'Plán a ohlédnutí',
    'Malý vlastní záměr, pokus a dobrovolná změna.',
  ),
  topic(
    'attn.sort-rule',
    'attention',
    'Vlastní pravidlo',
    'Uspořádání známých věcí podle zvoleného znaku.',
  ),
  topic(
    'auto.help-choice',
    'autonomy',
    'Volba pomoci',
    'Vlastní signál potřeby pomoci bez podmiňování.',
  ),
  topic(
    'auto.plan-choice',
    'autonomy',
    'Vlastní další krok',
    'Volba pokračování, změny nebo pauzy.',
  ),
  topic(
    'auto.routine',
    'autonomy',
    'Běžná příprava',
    'Malý dobrovolný podíl s dostupnou podporou dospělého.',
  ),
  topic(
    'create.building',
    'creationRhythm',
    'Stavění',
    'Vlastní malé modely a změna jejich podoby.',
  ),
  topic(
    'create.drawing',
    'creationRhythm',
    'Kresba a stopa',
    'Vlastní vizuální vyjádření bez normy výsledku.',
  ),
  topic(
    'create.story-art',
    'creationRhythm',
    'Obrazový příběh',
    'Vlastní komiks, kniha nebo obrázkové vyprávění.',
  ),
  topic(
    'move.coordination',
    'movement',
    'Společný pohyb',
    'Jemný osvojený pohyb s velkou vhodnou pomůckou.',
  ),
  topic(
    'move.self-directed',
    'movement',
    'Můj pohyb',
    'Vlastní pohodlný způsob pohybu a zastavení.',
  ),
  topic(
    'move.sequence',
    'movement',
    'Pohyb za pohybem',
    'Krátké vlastní pořadí bez výkonnostního měření.',
  ),
  topic(
    'rel.cooperation',
    'relationship',
    'Společný nápad',
    'Domluva a prostor pro rozdílné přání.',
  ),
  topic(
    'rel.perspective',
    'relationship',
    'Různé pohledy',
    'Možnost rozumět smyšlené situaci více způsoby.',
  ),
  topic(
    'sense.compare',
    'senses',
    'Porovnání vjemů',
    'Popis vlastních vjemů bez zkoušky správnosti.',
  ),
  topic(
    'sense.observe',
    'senses',
    'Pozoruji',
    'Rozdíl mezi viděnou vlastností a zatím neověřeným odhadem.',
  ),
  topic(
    'space.compare-size',
    'spaceQuantity',
    'Porovnání velikosti',
    'Konkrétní rozdíl při přiložení bezpečných věcí.',
  ),
  topic(
    'space.grouping',
    'spaceQuantity',
    'Skupiny a uspořádání',
    'Různé způsoby rozdělení téhož souboru věcí.',
  ),
  topic(
    'space.match-count',
    'spaceQuantity',
    'Jeden k jednomu',
    'Přiřazení míst nebo věcí bez povinného počítání.',
  ),
  topic(
    'space.measure',
    'spaceQuantity',
    'Vlastní měření',
    'Srovnání pomocí stejných bezpečných jednotek.',
  ),
  topic(
    'space.position',
    'spaceQuantity',
    'Poloha a stavba',
    'Vztahy pod/nad/vedle v nízkém modelu nebo náčrtu.',
  ),
  topic(
    'speech.instructions',
    'speech',
    'Vysvětlení postupu',
    'Vlastní srozumitelný návod s možností doptání.',
  ),
  topic(
    'speech.storytelling',
    'speech',
    'Vlastní vyprávění',
    'Společný příběh slovem, gestem nebo obrázkem.',
  ),
  topic(
    'speech.word-play',
    'speech',
    'Hra s vyjádřením',
    'Různé hlasy, slova nebo známé rodinné jazyky bez hodnocení přízvuku.',
  ),
] as const;

export function topicsByArea(area: DevelopmentArea): ActivityTopic[] {
  return STARTER_TOPICS.filter((topic) => topic.area === area);
}

export function findTopic(topicId: string): ActivityTopic | null {
  return STARTER_TOPICS.find((topic) => topic.topicId === topicId) ?? null;
}

function topic(
  topicId: string,
  area: DevelopmentArea,
  titleCs: string,
  descriptionCs: string,
): ActivityTopic {
  return { topicId, area, titleCs, descriptionCs };
}
