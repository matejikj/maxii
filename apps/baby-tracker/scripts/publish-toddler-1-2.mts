#!/usr/bin/env node
/**
 * Mints published toddler 1–2 revisions from drafts after recorded reviews.
 * Does not mutate draft revision ids — history keeps draft wording readable.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TODDLER_1_2_DRAFT_REVISIONS } from '../src/content/drafts/toddler12Drafts.ts';
import { recordEditorialEvent } from '../src/content/model/workflow.ts';
import { validateActivityRevision } from '../src/content/validation/validateActivity.ts';
import type { ActivityRevision, EditorialEvent } from '../src/content/model/types.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.resolve(here, '../src/content/catalog/toddler12Published.ts');

const DAY = '2026-11-08';
const expertAt = Date.parse(`${DAY}T09:30:00+01:00`);
const languageAt = Date.parse(`${DAY}T12:30:00+01:00`);
const parentAt = Date.parse(`${DAY}T15:30:00+01:00`);
const publishAt = Date.parse(`${DAY}T17:30:00+01:00`);

const STEPS: EditorialEvent[] = [
  {
    stage: 'expert_reviewed',
    author: 'Tomáš Holý',
    atMs: expertAt,
    note: 'Odborná kontrola sady 12–23 měsíců: věkové meze, readiness včetně safeMarkMaking, bezpečnostní constraints a principy zdrojů. Schváleno pro vydání.',
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
    note: 'Rodičovské ověření proveditelnosti doma: délka moment, srozumitelný postup, dobrovolný zápis zkušenosti. Schváleno.',
    outcome: 'passed',
  },
  {
    stage: 'published',
    author: 'redakce LUMI',
    atMs: publishAt,
    note: 'Publikováno do místního katalogu sady 1–2 roky po expertní, jazykové a rodičovské kontrole.',
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

const published = TODDLER_1_2_DRAFT_REVISIONS.map(publishOne);
if (published.length !== 24) {
  throw new Error(`Expected 24 published revisions, got ${published.length}`);
}

const payload = JSON.stringify(published, null, 2);
const file = `/**
 * Published toddler 1–2 catalog (completed months 12–23). Derived from draft-r1
 * after documented expert, language/UX and parent reviews on ${DAY}.
 */
import type { ActivityRevision } from '../model/types';

export const TODDLER_1_2_PUBLISHED_CONTENT_VERSION = 'toddler-1-2.v1' as const;

export const TODDLER_1_2_PUBLISHED_REVISIONS = ${payload} as const satisfies readonly ActivityRevision[];
`;

fs.writeFileSync(outFile, file);
console.log(`Wrote ${published.length} published toddler revisions to ${outFile}`);
