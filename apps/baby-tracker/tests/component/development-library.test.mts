import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ActivityRevision } from '../../src/content/model/types.ts';
import { LOCAL_LIBRARY_REVISIONS } from '../../src/content/localLibrary.ts';
import {
  activityAgeLabel, activityCountLabel, activityDurationLabel, selectLibraryActivities,
} from '../../src/features/development/developmentPresentation.ts';

const base = LOCAL_LIBRARY_REVISIONS[0]!;
const library: ActivityRevision[] = [
  { ...base, activityId: 'voice', title: 'Říkání a úsměvy', primaryArea: 'speech', materials: [] },
  { ...base, activityId: 'touch', title: 'Malý objev', primaryArea: 'senses', materials: ['Měkká látka'] },
  { ...base, activityId: 'song', title: 'Říkání s písničkou', primaryArea: 'speech', materials: [] },
];
const empty = { query: '', area: null, favoritesOnly: false } as const;

test('library search accepts Czech with or without accents and matches materials', () => {
  assert.deepEqual(selectLibraryActivities(library, { ...empty, query: '  RIKANI   USMEVY  ' }, new Set()).map((r) => r.activityId), ['voice']);
  assert.deepEqual(selectLibraryActivities(library, { ...empty, query: 'mekka latka' }, new Set()).map((r) => r.activityId), ['touch']);
  assert.equal(selectLibraryActivities(library, { ...empty, query: 'neexistující' }, new Set()).length, 0);
});

test('search, area and favorites intersect without reordering or changing library data', () => {
  const before = JSON.stringify(library);
  const favorites = new Set(['touch', 'song']);
  const results = selectLibraryActivities(library, { query: 'rikani', area: 'speech', favoritesOnly: true }, favorites);
  assert.deepEqual(results.map((r) => r.activityId), ['song']);
  assert.equal(results[0], library[2]);
  assert.deepEqual(selectLibraryActivities(library, empty, new Set()).map((r) => r.activityId), ['voice', 'touch', 'song']);
  assert.equal(JSON.stringify(library), before);
});

test('empty favorites never silently falls back to the full library', () => {
  assert.equal(selectLibraryActivities(library, { ...empty, favoritesOnly: true }, new Set()).length, 0);
  assert.equal(selectLibraryActivities(library, { ...empty, area: 'movement' }, new Set()).length, 0);
});

test('activity metadata retains exact duration and editorial age window', () => {
  assert.equal(activityDurationLabel({ ...base, duration: { kind: 'moment' } }), 'Chvilka');
  for (const minutes of [5, 10, 15] as const) {
    assert.equal(activityDurationLabel({ ...base, duration: { kind: 'minutes', minutes } }), `${minutes} min`);
  }
  assert.equal(activityAgeLabel({ ...base, ageMonths: { fromInclusive: 2, toInclusive: 8 } }), '2–8 měsíců');
  assert.deepEqual([0, 1, 2, 4, 5, 21].map(activityCountLabel), ['0 aktivit', '1 aktivita', '2 aktivity', '4 aktivity', '5 aktivit', '21 aktivit']);
});
