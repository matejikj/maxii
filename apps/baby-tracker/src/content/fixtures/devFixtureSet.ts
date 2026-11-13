import type { ActivityRevision } from '../model/types';

/**
 * Tiny marked development set for engine/UI wiring. Must never be treated as
 * product-published content even if editorial fields look complete.
 */
export const DEV_FIXTURE_REVISIONS: ActivityRevision[] = [
  {
    activityId: 'dev.tummy-time',
    revisionId: 'dev.tummy-time.r1',
    language: 'cs',
    title: '[DEV] Krátký čas na bříšku',
    ageMonths: { fromInclusive: 1, toInclusive: 4 },
    readinessNotes: 'Development fixture only.',
    environments: ['home'],
    materials: [],
    constraints: ['Dítě je bdělé a v dobré náladě.'],
    duration: { kind: 'minutes', minutes: 5 },
    steps: ['Položte dítě na bříško na pevnou podložku.', 'Zůstaňte v dohledu a povídejte klidně.'],
    conversationPrompt: 'Vidíš mě? Jsem tady s tebou.',
    primaryArea: 'movement',
    relatedAreas: ['relationship'],
    topicIds: ['move.tummy'],
    sources: [{ label: 'internal-dev', checkedOn: '2026-01-01', kind: 'internal' }],
    suitability: [
      { kind: 'age_months', fromInclusive: 1, toInclusive: 4 },
      { kind: 'materials_none' },
      { kind: 'environment_one_of', environments: ['home'] },
    ],
    editorial: {
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'dev',
          atMs: 1,
          note: 'fixture',
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'dev',
          atMs: 2,
          note: 'fixture',
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'dev',
          atMs: 3,
          note: 'fixture',
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'dev',
          atMs: 4,
          note: 'fixture',
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'development',
  },
  {
    activityId: 'dev.soft-song',
    revisionId: 'dev.soft-song.r1',
    language: 'cs',
    title: '[DEV] Tichá říkanka',
    ageMonths: { fromInclusive: 0, toInclusive: 6 },
    readinessNotes: null,
    environments: ['home', 'quiet'],
    materials: [],
    constraints: [],
    duration: { kind: 'moment' },
    steps: ['Zpívejte nebo šeptějte krátkou říkanku.'],
    conversationPrompt: null,
    primaryArea: 'speech',
    relatedAreas: ['creationRhythm'],
    topicIds: ['speech.songs', 'create.rhythm'],
    sources: [{ label: 'internal-dev', checkedOn: '2026-01-01', kind: 'internal' }],
    suitability: [
      { kind: 'age_months', fromInclusive: 0, toInclusive: 6 },
      { kind: 'materials_none' },
    ],
    editorial: {
      stage: 'draft',
      history: [],
    },
    withdrawnReason: null,
    fixtureKind: 'development',
  },
];

/** Example product-shaped revisions used only in unit tests for catalog rules. */
export function sampleProductRevision(overrides: Partial<ActivityRevision> = {}): ActivityRevision {
  return {
    activityId: 'act.high-contrast-card',
    revisionId: 'act.high-contrast-card.r1',
    language: 'cs',
    title: 'Kontrastní kartička',
    ageMonths: { fromInclusive: 0, toInclusive: 3 },
    readinessNotes: null,
    environments: ['home'],
    materials: ['kartička'],
    constraints: [],
    duration: { kind: 'minutes', minutes: 5 },
    steps: ['Ukažte kontrastní tvar asi 30 cm od očí.', 'Pomalu jej posuňte do strany.'],
    conversationPrompt: 'Vidíš ten tvar?',
    primaryArea: 'senses',
    relatedAreas: ['attention'],
    topicIds: ['sense.high-contrast', 'attn.track'],
    sources: [{ label: 'expert-review-board', checkedOn: '2026-02-01', kind: 'expert' }],
    suitability: [
      { kind: 'age_months', fromInclusive: 0, toInclusive: 3 },
      { kind: 'requires_birth_date' },
      { kind: 'environment_one_of', environments: ['home'] },
    ],
    editorial: {
      stage: 'published',
      history: [
        {
          stage: 'expert_reviewed',
          author: 'odborník',
          atMs: 10,
          note: 'Vhodné pro novorozence.',
          outcome: 'passed',
        },
        {
          stage: 'language_ux',
          author: 'editor',
          atMs: 11,
          note: 'Zkráceny kroky.',
          outcome: 'passed',
        },
        {
          stage: 'parent_verified',
          author: 'rodič-panel',
          atMs: 12,
          note: 'Srozumitelné.',
          outcome: 'passed',
        },
        {
          stage: 'published',
          author: 'vydavatel',
          atMs: 13,
          note: 'Vydáno.',
          outcome: 'passed',
        },
      ],
    },
    withdrawnReason: null,
    fixtureKind: 'product',
    ...overrides,
  };
}
