import type { ActivityRevision } from './model/types';
import { sampleProductRevision } from './fixtures/devFixtureSet';

/**
 * Small interim offline library for Development UI and the recommendation
 * engine until a fully reviewed 0–12 month pack ships. Every entry is a
 * product-shaped revision with editorial history so hard eligibility works.
 */
export const LOCAL_LIBRARY_REVISIONS: ActivityRevision[] = [
  sampleProductRevision(),
  sampleProductRevision({
    activityId: 'act.soft-rhyme',
    revisionId: 'act.soft-rhyme.r1',
    title: 'Tichá říkanka',
    primaryArea: 'speech',
    relatedAreas: ['creationRhythm'],
    topicIds: ['speech.songs'],
    materials: [],
    environments: ['home', 'quiet'],
    ageMonths: { fromInclusive: 0, toInclusive: 12 },
    duration: { kind: 'moment' },
    steps: ['Zpívejte nebo šeptějte krátkou říkanku.', 'Nechte prostor pro odpověď dítěte.'],
    conversationPrompt: 'Slyšíš tu melodii?',
    constraints: ['Dítě je bdělé a v klidu.'],
    suitability: [
      { kind: 'age_months', fromInclusive: 0, toInclusive: 12 },
      { kind: 'materials_none' },
      { kind: 'environment_one_of', environments: ['home', 'quiet'] },
    ],
  }),
  sampleProductRevision({
    activityId: 'act.gentle-reach',
    revisionId: 'act.gentle-reach.r1',
    title: 'Jemné sahání',
    primaryArea: 'movement',
    relatedAreas: ['attention'],
    topicIds: ['move.reach'],
    materials: [],
    environments: ['home'],
    ageMonths: { fromInclusive: 2, toInclusive: 8 },
    duration: { kind: 'minutes', minutes: 5 },
    steps: [
      'Položte bezpečný předmět na dosah.',
      'Počkejte, až dítě sáhne samo.',
      'Přestaňte, když dítě ztratí zájem.',
    ],
    conversationPrompt: 'Chceš to zkusit?',
    suitability: [
      { kind: 'age_months', fromInclusive: 2, toInclusive: 8 },
      { kind: 'materials_none' },
      { kind: 'requires_birth_date' },
    ],
  }),
  sampleProductRevision({
    activityId: 'act.shared-look',
    revisionId: 'act.shared-look.r1',
    title: 'Společný pohled',
    primaryArea: 'relationship',
    relatedAreas: ['attention'],
    topicIds: ['rel.eye-contact', 'attn.shared'],
    materials: [],
    environments: ['home', 'quiet'],
    ageMonths: { fromInclusive: 0, toInclusive: 6 },
    duration: { kind: 'moment' },
    steps: ['Skloněte se do zorného pole dítěte.', 'Úsměvem a klidným hlasem navážete kontakt.'],
    conversationPrompt: 'Vidím tě.',
    suitability: [
      { kind: 'age_months', fromInclusive: 0, toInclusive: 6 },
      { kind: 'materials_none' },
      { kind: 'requires_birth_date' },
    ],
  }),
  sampleProductRevision({
    activityId: 'act.texture-touch',
    revisionId: 'act.texture-touch.r1',
    title: 'Měkká textura',
    primaryArea: 'senses',
    relatedAreas: ['autonomy'],
    topicIds: ['sense.texture'],
    materials: ['látka'],
    environments: ['home'],
    ageMonths: { fromInclusive: 3, toInclusive: 12 },
    duration: { kind: 'minutes', minutes: 5 },
    steps: ['Nabídněte jednu bezpečnou látku.', 'Nechte dítě zkoumat tempem, které zvolí samo.'],
    conversationPrompt: 'Jaká je na dotek?',
    suitability: [
      { kind: 'age_months', fromInclusive: 3, toInclusive: 12 },
      { kind: 'materials_all_of', materials: ['látka'] },
      { kind: 'requires_birth_date' },
    ],
  }),
];

export const LOCAL_LIBRARY_CONTENT_VERSION = 'local-library.v1';
