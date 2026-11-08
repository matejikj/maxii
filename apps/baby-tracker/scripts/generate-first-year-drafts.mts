#!/usr/bin/env node
/**
 * Converts the local editorial draft markdown into typed ActivityRevision
 * records. Output stays draft/unpublished — never invents expert approval.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DevelopmentArea } from '../src/domain/index.ts';
import type {
  ActivityRevision,
  ActivitySteps,
  ContentEnvironment,
  ContentSource,
  ReadinessKey,
  SuitabilityCondition,
} from '../src/content/model/types.ts';
import { READINESS_KEYS } from '../src/content/model/types.ts';
import { findTopic } from '../src/content/model/topics.ts';
import { validateActivityRevision } from '../src/content/validation/validateActivity.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const draftMd = path.resolve(
  here,
  '../../../docs/implementation/evidence/task-21/activity-drafts.md',
);
const outFile = path.resolve(here, '../src/content/drafts/firstYearDrafts.ts');

const SHARED_CONSTRAINTS = [
  'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě nebo pláči skončete a vraťte se k potřebné péči.',
  'Hra probíhá na bezpečném pevném podkladu bez pádu, šňůr, volných baterií, magnetů a drobných dílů.',
  'Netlačte dítě do neosvojené polohy a necvičte přes odpor; při zdravotních omezeních vhodnost posoudí ošetřující odborník.',
] as const;

const AREA_SET = new Set<DevelopmentArea>([
  'relationship',
  'speech',
  'movement',
  'senses',
  'attention',
  'spaceQuantity',
  'creationRhythm',
  'autonomy',
]);

type SourceDef = { id: string; label: string; url: string; supportsPrinciple: string };

function parseSourcesAppendix(md: string): Map<string, SourceDef> {
  const map = new Map<string, SourceDef>();
  const re =
    /### (S\d+)\n\n\[([^\]]+)\]\(([^)]+)\):\s*([^\n]+)/g;
  for (const match of md.matchAll(re)) {
    map.set(match[1]!, {
      id: match[1]!,
      label: match[2]!.trim(),
      url: match[3]!.trim(),
      supportsPrinciple: match[4]!.trim(),
    });
  }
  return map;
}

function parseAge(token: string): { fromInclusive: number; toInclusive: number } {
  const cleaned = token.replace('měsíců', '').replace(/\s/g, '');
  const [fromRaw, toRaw] = cleaned.split('–');
  const fromInclusive = Number(fromRaw);
  const toInclusive = Number(toRaw);
  if (
    !Number.isInteger(fromInclusive) ||
    !Number.isInteger(toInclusive) ||
    fromInclusive < 0 ||
    toInclusive < fromInclusive ||
    toInclusive > 11
  ) {
    throw new Error(`Invalid age window: ${token}`);
  }
  return { fromInclusive, toInclusive };
}

function parseEnvironments(token: string): ContentEnvironment[] {
  return token
    .split(',')
    .map((part) => part.trim().replace(/`/g, ''))
    .filter(Boolean) as ContentEnvironment[];
}

function extractSection(body: string, label: string): string {
  const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*([^\\n]+)`);
  const match = body.match(re);
  return match?.[1]?.trim() ?? '';
}

function extractSteps(body: string): ActivitySteps {
  const line = extractSection(body, 'Postup');
  const parts = [...line.matchAll(/\d+\.\s*([^0-9]+?)(?=\s*\d+\.|$)/g)].map((m) =>
    m[1]!.trim().replace(/\.$/, ''),
  );
  if (parts.length < 1 || parts.length > 3) {
    throw new Error(`Expected 1–3 steps, got ${parts.length}: ${line}`);
  }
  if (parts.length === 1) return [parts[0]!];
  if (parts.length === 2) return [parts[0]!, parts[1]!];
  return [parts[0]!, parts[1]!, parts[2]!];
}

function extractReadiness(conditions: string): ReadinessKey[] {
  const keys: ReadinessKey[] = [];
  for (const key of READINESS_KEYS) {
    if (new RegExp(`\`${key}\`|\\b${key}\\b`).test(conditions)) keys.push(key);
  }
  return keys;
}

function extractMaterials(conditions: string): string[] {
  const lower = conditions.toLowerCase();
  if (
    /bez pomůcek|bez dalších pomůcek|hlas dospělého, bez nahrávky a dalších pomůcek/.test(lower)
  ) {
    return [];
  }
  // Keep the caregiver-facing condition text shortened into a material label when needed.
  const withoutReadiness = conditions
    .replace(/`(?:grasp|release|rollAttempt|floorSit|floorMove|gesture)`/g, '')
    .replace(/Potvrzené[^;.]*/gi, '')
    .replace(/^[\s;,.]+/, '')
    .trim();
  if (!withoutReadiness || /bez pomůcek/i.test(withoutReadiness)) return [];
  return [withoutReadiness.replace(/\.$/, '')];
}

function toSource(id: string, defs: Map<string, SourceDef>): ContentSource {
  const def = defs.get(id);
  if (!def) throw new Error(`Unknown source ${id}`);
  return {
    label: def.label,
    checkedOn: '2026-11-08',
    kind: 'internal',
    url: def.url,
    supportsPrinciple: def.supportsPrinciple,
  };
}

function parseActivities(md: string, sources: Map<string, SourceDef>): ActivityRevision[] {
  const chunks = md.split(/^### (A\d+) — (.+)$/m).slice(1);
  const revisions: ActivityRevision[] = [];
  for (let i = 0; i < chunks.length; i += 3) {
    const orientId = chunks[i]!;
    const title = chunks[i + 1]!.trim();
    const body = chunks[i + 2]!;
    if (orientId.startsWith('S')) break;
    const metaLine = body
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith('`') && line.includes('·'));
    if (!metaLine) throw new Error(`Missing meta line for ${orientId}`);
    const metaParts = metaLine
      .replace(/\.$/, '')
      .split('·')
      .map((part) => part.trim());
    const activityId = metaParts[0]!.replace(/`/g, '');
    const age = parseAge(metaParts[1]!);
    const areaTopic = metaParts[2]!.replace(/`/g, '').split('/').map((p) => p.trim());
    const primaryArea = areaTopic[0] as DevelopmentArea;
    const topicId = areaTopic[1]!;
    if (!AREA_SET.has(primaryArea)) throw new Error(`Unknown area ${primaryArea}`);
    if (!findTopic(topicId)) throw new Error(`Unknown topic ${topicId} for ${activityId}`);
    const environments = parseEnvironments(metaParts[3]!);
    const durationToken = metaParts[4]!.replace(/`/g, '').trim();
    if (durationToken !== 'moment') {
      throw new Error(`Expected moment duration for ${activityId}, got ${durationToken}`);
    }

    const conditions = extractSection(body, 'Podmínky/pomůcky');
    const say = extractSection(body, 'Řekněte');
    const observe = extractSection(body, 'Pozorujte/konec');
    const sourceMatch = extractSection(body, 'Podklad').match(/\[(S\d+)\]/);
    if (!sourceMatch) throw new Error(`Missing source for ${activityId}`);
    const readinessKeys = extractReadiness(conditions);
    const materials = extractMaterials(conditions);
    const steps = extractSteps(body);

    const suitability: SuitabilityCondition[] = [
      {
        kind: 'age_months',
        fromInclusive: age.fromInclusive,
        toInclusive: age.toInclusive,
      },
      { kind: 'requires_birth_date' },
      { kind: 'environment_one_of', environments },
      ...(materials.length === 0
        ? ([{ kind: 'materials_none' }] as SuitabilityCondition[])
        : []),
      ...readinessKeys.map(
        (key): SuitabilityCondition => ({ kind: 'readiness_confirmed', key }),
      ),
    ];

    const constraints = [
      ...SHARED_CONSTRAINTS,
      ...(conditions ? [conditions] : []),
      ...(observe ? [observe] : []),
    ];

    revisions.push({
      activityId,
      revisionId: `${activityId}.draft-r1`,
      language: 'cs',
      title,
      ageMonths: age,
      readinessNotes:
        readinessKeys.length > 0
          ? `Vyžaduje potvrzenou připravenost: ${readinessKeys.join(', ')}.`
          : observe || null,
      environments,
      materials,
      constraints,
      duration: { kind: 'moment' },
      steps,
      conversationPrompt: say || null,
      primaryArea,
      relatedAreas: [],
      topicIds: [topicId],
      sources: [toSource(sourceMatch[1]!, sources)],
      suitability,
      editorial: { stage: 'draft', history: [] },
      withdrawnReason: null,
      fixtureKind: 'product',
    });
  }
  return revisions;
}

function main() {
  const md = fs.readFileSync(draftMd, 'utf8');
  const sources = parseSourcesAppendix(md);
  const revisions = parseActivities(md, sources);
  if (revisions.length !== 60) {
    throw new Error(`Expected 60 drafts, got ${revisions.length}`);
  }
  let failed = 0;
  for (const revision of revisions) {
    const result = validateActivityRevision(revision);
    if (!result.ok) {
      failed += 1;
      console.error(revision.revisionId, result.errors);
    }
  }
  if (failed > 0) throw new Error(`${failed} drafts failed validation`);

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const payload = JSON.stringify(revisions, null, 2);
  const file = `/**
 * Generated first-year draft catalog. Editorial stage is draft with empty
 * approval history — research visit is not expert_reviewed product approval.
 * Regenerate via: npm run content:generate-drafts -w @maxii/baby-tracker
 */
import type { ActivityRevision } from '../model/types';

export const FIRST_YEAR_DRAFT_CONTENT_VERSION = 'first-year-drafts.v1' as const;

export const FIRST_YEAR_DRAFT_REVISIONS = ${payload} as const satisfies readonly ActivityRevision[];
`;
  fs.writeFileSync(outFile, `${file}\n`);
  const readinessGated = revisions.filter((revision) =>
    revision.suitability.some((item) => item.kind === 'readiness_confirmed'),
  ).length;
  console.log(
    JSON.stringify(
      {
        ok: true,
        draftCount: revisions.length,
        readinessGated,
        outFile: path.relative(process.cwd(), outFile),
      },
      null,
      2,
    ),
  );
}

main();
