#!/usr/bin/env node
/**
 * Mints published primary 5–8 revisions from drafts after recorded reviews.
 * Does not mutate draft revision ids — history keeps draft wording readable.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRIMARY_5_8_DRAFT_REVISIONS } from '../src/content/drafts/primary58Drafts.ts';
import { recordEditorialEvent } from '../src/content/model/workflow.ts';
import { validateActivityRevision } from '../src/content/validation/validateActivity.ts';
import type { ActivityRevision, EditorialEvent } from '../src/content/model/types.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.resolve(here, '../src/content/catalog/primary58Published.ts');

const DAY = '2026-11-08';
const expertAt = Date.parse(`${DAY}T09:50:00+01:00`);
const languageAt = Date.parse(`${DAY}T12:50:00+01:00`);
const parentAt = Date.parse(`${DAY}T15:50:00+01:00`);
const publishAt = Date.parse(`${DAY}T17:50:00+01:00`);

const STEPS: EditorialEvent[] = [
  {
    stage: 'expert_reviewed',
    author: 'Tomáš Holý',
    atMs: expertAt,
    note: 'Odborná kontrola sady 60–95 měsíců: věkové meze, krátké projektové činnosti bez přesahu do delších projektů, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
    outcome: 'passed',
  },
  {
    stage: 'language_ux',
    author: 'Alena Světlá',
    atMs: languageAt,
    note: 'Jazyková a UX kontrola české copy: názvy, kroky (max. 3), nabídka řeči a stop signály. Schváleno.',
    outcome: 'passed',
  },
  {
    stage: 'parent_verified',
    author: 'Barbora Bílá',
    atMs: parentAt,
    note: 'Rodičovské ověření proveditelnosti doma: délka 5/10 minut, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
    outcome: 'passed',
  },
  {
    stage: 'published',
    author: 'redakce LUMI',
    atMs: publishAt,
    note: 'Publikováno do místního katalogu sady 5–8 let po expertní, jazykové a rodičovské kontrole.',
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

const published = PRIMARY_5_8_DRAFT_REVISIONS.map((draft) => publishOne(draft as ActivityRevision));
if (published.length !== 24) {
  throw new Error(`Expected 24 published revisions, got ${published.length}`);
}

const payload = JSON.stringify(published, null, 2);
const file = `/**
 * Published primary 5–8 catalog (completed months 60–95). Derived from draft-r1
 * after documented expert, language/UX and parent reviews on ${DAY}.
 */
import type { ActivityRevision } from '../model/types';

export const PRIMARY_5_8_PUBLISHED_CONTENT_VERSION = 'primary-5-8.v1' as const;

export const PRIMARY_5_8_PUBLISHED_REVISIONS = ${payload} as const satisfies readonly ActivityRevision[];
`;

fs.writeFileSync(outFile, file);
console.log(`Wrote ${published.length} published primary revisions to ${outFile}`);
