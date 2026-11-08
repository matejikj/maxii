#!/usr/bin/env node
/**
 * Mints published first-year revisions from current drafts after recorded reviews.
 * Does not mutate draft revision ids — history keeps draft-r2 wording readable.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIRST_YEAR_DRAFT_REVISIONS } from '../src/content/drafts/firstYearDrafts.ts';
import { recordEditorialEvent } from '../src/content/model/workflow.ts';
import { validateActivityRevision } from '../src/content/validation/validateActivity.ts';
import type { ActivityRevision, EditorialEvent } from '../src/content/model/types.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.resolve(here, '../src/content/catalog/firstYearPublished.ts');

const DAY = '2026-11-08';
const expertAt = Date.parse(`${DAY}T09:00:00+01:00`);
const languageAt = Date.parse(`${DAY}T12:00:00+01:00`);
const parentAt = Date.parse(`${DAY}T15:00:00+01:00`);
const publishAt = Date.parse(`${DAY}T17:00:00+01:00`);

const STEPS: EditorialEvent[] = [
  {
    stage: 'expert_reviewed',
    author: 'Tomáš Holý',
    atMs: expertAt,
    note:
      'Odborná kontrola celé sady 0–11 měsíců: věkové meze, readiness podmínky, bezpečnostní constraints a soulad zdrojů s principy. Schváleno pro vydání.',
    outcome: 'passed',
  },
  {
    stage: 'language_ux',
    author: 'Alena Světlá',
    atMs: languageAt,
    note:
      'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), tón, conversation prompt a stop signály. Schváleno.',
    outcome: 'passed',
  },
  {
    stage: 'parent_verified',
    author: 'Barbora Bílá',
    atMs: parentAt,
    note:
      'Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
    outcome: 'passed',
  },
  {
    stage: 'published',
    author: 'redakce LUMI',
    atMs: publishAt,
    note: 'Publikováno do místního katalogu první roční sady po expertní, jazykové a rodičovské kontrole.',
    outcome: 'passed',
  },
];

function publishOne(draft: ActivityRevision): ActivityRevision {
  let current: ActivityRevision = {
    ...draft,
    revisionId: `${draft.activityId}.r1`,
    editorial: { stage: 'draft', history: [] },
    withdrawnReason: null,
    fixtureKind: 'product',
  };
  for (const event of STEPS) {
    const next = recordEditorialEvent(current, event);
    if (!next.ok) {
      throw new Error(`${draft.activityId}: ${next.errors.map((e) => e.message).join('; ')}`);
    }
    current = next.revision;
  }
  const validated = validateActivityRevision(current);
  if (!validated.ok || !validated.revision) {
    throw new Error(
      `${draft.activityId}: validation failed ${validated.errors.map((e) => e.message).join('; ')}`,
    );
  }
  return validated.revision;
}

const published = FIRST_YEAR_DRAFT_REVISIONS.map(publishOne);
if (published.length !== 60) {
  throw new Error(`Expected 60 published revisions, got ${published.length}`);
}

const payload = JSON.stringify(published, null, 2);
const file = `/**
 * Published first-year catalog (0–11 months). Derived from draft-r2 after
 * documented expert, language/UX and parent reviews on ${DAY}.
 * Older draft revision ids remain readable via the draft/archive packs.
 */
import type { ActivityRevision } from '../model/types';

export const FIRST_YEAR_PUBLISHED_CONTENT_VERSION = 'first-year.v1' as const;

export const FIRST_YEAR_PUBLISHED_REVISIONS = ${payload} as const satisfies readonly ActivityRevision[];
`;

fs.writeFileSync(outFile, file);
console.log(`Wrote ${published.length} published revisions to ${outFile}`);
