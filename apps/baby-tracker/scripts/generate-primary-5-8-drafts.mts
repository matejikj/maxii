#!/usr/bin/env node
/**
 * Converts the versioned primary 5–8 editorial source into typed draft revisions.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DevelopmentArea } from '../src/domain/index.ts';
import type {
  ActivityRevision,
  ActivitySteps,
  ContentDuration,
  ContentEnvironment,
  ContentSource,
  ReadinessKey,
  SuitabilityCondition,
} from '../src/content/model/types.ts';
import { READINESS_KEYS } from '../src/content/model/types.ts';
import { findTopic } from '../src/content/model/topics.ts';
import { validateActivityRevision } from '../src/content/validation/validateActivity.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const draftMd = path.resolve(here, '../content/primary-5-8-activities.txt');
const outFile = path.resolve(here, '../src/content/drafts/primary58Drafts.ts');

const SHARED_CONSTRAINTS = [
  'Nabízejte aktivitu jen bdělému dítěti, které o kontakt stojí; při únavě, frustraci nebo pláči skončete a vraťte se k potřebné péči.',
  'Pomůcky musí odpovídat věku a bezpečnostním pokynům výrobce; bez drobných oddělitelných částí, šňůr kolem těla, baterií a magnetů.',
  'Dospělý zůstává dostupný a nabízí pomoc bez podmínění poslušností; nevynucujte řeč, oční kontakt ani dotek.',
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

const FAMILY_BY_ACTIVITY: Record<string, string> = {
  'primary-ordinary-object-story': 'family.primary-story',
  'primary-two-story-versions': 'family.primary-story',
  'primary-three-panel-comic': 'family.primary-story',
  'primary-small-book-own-topic': 'family.primary-story',
  'primary-two-step-plan': 'family.primary-plan',
  'primary-choose-next-small-session': 'family.primary-plan',
  'primary-pause-and-leave-a-note': 'family.primary-plan',
  'primary-measure-with-paper-strip': 'family.primary-quantity',
  'primary-same-amount-new-layout': 'family.primary-quantity',
  'primary-share-into-groups': 'family.primary-quantity',
  'primary-plan-with-two-choices': 'family.primary-cooperation',
  'primary-explain-with-role-swap': 'family.primary-cooperation',
  'primary-opinion-and-reason': 'family.primary-cooperation',
  'primary-own-move-sequence': 'family.primary-movement',
  'primary-together-ball-route': 'family.primary-movement',
  'primary-route-by-own-plan': 'family.primary-movement',
  'primary-plant-observation-page': 'family.primary-observe',
  'primary-see-and-infer': 'family.primary-observe',
  'primary-question-for-paper-bridge': 'family.primary-change',
  'primary-one-change-two-attempts': 'family.primary-change',
  'primary-create-and-change-pattern': 'family.primary-change',
};

const READINESS_COPY: Record<ReadinessKey, string> = {
  grasp: 'Dítě už samo stabilně drží vhodnou hračku.',
  release: 'Dítě už samo vědomě pouští drženou hračku.',
  rollAttempt: 'Dítě už samo zahajuje otočení na bok.',
  floorSit: 'Dítě už samo stabilně sedí na podlaze.',
  floorMove: 'Dítě už se samo pohybuje po bezpečné podlaze.',
  gesture: 'Dítě už samo používá ukazovací gesto.',
  safeMarkMaking:
    'Pečující výslovně potvrdil bezpečné použití nepoškozené věkově vhodné kreslicí pomůcky pod přímým dohledem.',
};

type SourceDef = { id: string; label: string; url: string; supportsPrinciple: string };

function parseSourcesAppendix(md: string): Map<string, SourceDef> {
  const map = new Map<string, SourceDef>();
  const re = /### (S\d+)\n\n\[([^\]]+)\]\(([^)]+)\):\s*([^\n]+)/g;
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
    fromInclusive < 60 ||
    toInclusive < fromInclusive ||
    toInclusive > 95
  ) {
    throw new Error(`Invalid primary age window: ${token}`);
  }
  return { fromInclusive, toInclusive };
}

function parseDuration(token: string): ContentDuration {
  const cleaned = token.replace(/`/g, '').trim();
  if (cleaned === 'moment') return { kind: 'moment' };
  const match = cleaned.match(/^(\d+)\s*minut/);
  if (!match) throw new Error(`Unsupported duration: ${token}`);
  const minutes = Number(match[1]);
  if (minutes !== 5 && minutes !== 10 && minutes !== 15) {
    throw new Error(`Unsupported minute duration: ${token}`);
  }
  return { kind: 'minutes', minutes };
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

function extractReadiness(text: string): ReadinessKey[] {
  const keys: ReadinessKey[] = [];
  for (const key of READINESS_KEYS) {
    if (new RegExp(`\`${key}\``).test(text)) keys.push(key);
  }
  return keys;
}

function extractMaterials(body: string, activityId: string): string[] {
  const declared = extractSection(body, 'Pomůcky').replace(/\.$/, '');
  if (!declared) throw new Error(`Missing materials for ${activityId}`);
  if (declared === 'žádné' || declared.startsWith('žádné;')) return [];
  return declared
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractSourceIds(body: string): string[] {
  const line = extractSection(body, 'Princip k redakčnímu posouzení');
  const ids = [...line.matchAll(/\[(S\d+)\]/g)].map((m) => m[1]!);
  if (ids.length === 0) throw new Error(`Missing source principles: ${line}`);
  return ids;
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
  const chunks = md.split(/^## (primary-[a-z0-9-]+) — (.+)$/m).slice(1);
  const revisions: ActivityRevision[] = [];
  for (let i = 0; i < chunks.length; i += 3) {
    const activityIdFromHeading = chunks[i]!;
    const title = chunks[i + 1]!.trim();
    const body = chunks[i + 2]!;
    if (activityIdFromHeading.startsWith('S') || title.startsWith('Source')) break;

    const metaLine = extractSection(body, 'Metadata');
    if (!metaLine) throw new Error(`Missing Metadata for ${activityIdFromHeading}`);
    const metaParts = metaLine.replace(/\.$/, '').split('·').map((part) => part.trim());
    const activityId = metaParts[0]!.replace(/`/g, '');
    if (activityId !== activityIdFromHeading) {
      throw new Error(`Heading/meta id mismatch: ${activityIdFromHeading} vs ${activityId}`);
    }
    const age = parseAge(metaParts[1]!);
    const areaTopic = metaParts[2]!.replace(/`/g, '').split('/').map((p) => p.trim());
    const primaryArea = areaTopic[0] as DevelopmentArea;
    const topicId = areaTopic[1]!;
    if (!AREA_SET.has(primaryArea)) throw new Error(`Unknown area ${primaryArea}`);
    if (!findTopic(topicId)) throw new Error(`Unknown topic ${topicId} for ${activityId}`);
    const environments = metaParts[3]!
      .replace(/`/g, '')
      .split(',')
      .map((p) => p.trim()) as ContentEnvironment[];
    const duration = parseDuration(metaParts[4]!);

    const readinessText = extractSection(body, 'Připravenost');
    const observe = extractSection(body, 'Pozorování a konec');
    const say = extractSection(body, 'Nabídka řeči').replace(/^[„"]|[“"]$/g, '');
    const readinessKeys = extractReadiness(readinessText);
    const materials = extractMaterials(body, activityId);
    const steps = extractSteps(body);
    const sourceIds = extractSourceIds(body);

    const suitability: SuitabilityCondition[] = [
      { kind: 'age_months', fromInclusive: age.fromInclusive, toInclusive: age.toInclusive },
      { kind: 'requires_birth_date' },
      { kind: 'environment_one_of', environments },
      ...(materials.length === 0
        ? ([{ kind: 'materials_none' }] as SuitabilityCondition[])
        : ([{ kind: 'materials_all_of', materials }] as SuitabilityCondition[])),
      ...readinessKeys.map(
        (key): SuitabilityCondition => ({ kind: 'readiness_confirmed', key }),
      ),
    ];

    revisions.push({
      activityId,
      revisionId: `${activityId}.draft-r1`,
      language: 'cs',
      title,
      ageMonths: age,
      readinessNotes:
        readinessKeys.length > 0
          ? readinessKeys.map((key) => READINESS_COPY[key]).join(' ')
          : readinessText || null,
      environments,
      materials,
      constraints: [
        ...SHARED_CONSTRAINTS,
        ...readinessKeys.map((key) => READINESS_COPY[key]),
        ...(observe ? [observe] : []),
      ],
      duration,
      steps,
      conversationPrompt: say || null,
      primaryArea,
      relatedAreas: [],
      topicIds: [topicId],
      activityFamilyId: FAMILY_BY_ACTIVITY[activityId] ?? null,
      sources: sourceIds.map((id) => toSource(id, sources)),
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
  if (revisions.length !== 24) {
    throw new Error(`Expected 24 primary drafts, got ${revisions.length}`);
  }
  let failed = 0;
  for (const revision of revisions) {
    const result = validateActivityRevision(revision);
    if (!result.ok) {
      failed += 1;
      console.error(revision.revisionId, result.errors);
    }
  }
  if (failed > 0) throw new Error(`${failed} primary drafts failed validation`);

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const payload = JSON.stringify(revisions, null, 2);
  const file = `/**
 * Generated primary 5–8 year draft catalog (completed months 60–95).
 * Editorial stage is draft until publish records documented reviews.
 * Regenerate via: npm run content:generate-primary-5-8 -w @maxii/baby-tracker
 */
import type { ActivityRevision } from '../model/types';

export const PRIMARY_5_8_DRAFT_CONTENT_VERSION = 'primary-5-8-drafts.v1' as const;

export const PRIMARY_5_8_DRAFT_REVISIONS = ${payload} as const satisfies readonly ActivityRevision[];
`;
  fs.writeFileSync(outFile, `${file}\n`);
  console.log(
    JSON.stringify(
      {
        drafts: revisions.length,
        readinessGated: revisions.filter((r) =>
          r.suitability.some((s) => s.kind === 'readiness_confirmed'),
        ).length,
        withFamily: revisions.filter((r) => r.activityFamilyId).length,
        tenMinute: revisions.filter(
          (r) => r.duration.kind === 'minutes' && r.duration.minutes === 10,
        ).length,
        outFile,
      },
      null,
      2,
    ),
  );
}

main();
