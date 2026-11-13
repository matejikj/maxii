import type { DevelopmentArea } from '../../domain';
import { findTopic } from '../model/topics';
import type {
  ActivityRevision,
  ActivitySteps,
  ContentDuration,
  ContentEnvironment,
  ContentSource,
  EditorialEvent,
  FieldValidationError,
  ReadinessKey,
  SuitabilityCondition,
} from '../model/types';
import { READINESS_KEYS } from '../model/types';

const AREAS: readonly DevelopmentArea[] = [
  'relationship',
  'speech',
  'movement',
  'senses',
  'attention',
  'spaceQuantity',
  'creationRhythm',
  'autonomy',
];

const ENVIRONMENTS: readonly ContentEnvironment[] = ['home', 'outdoor', 'travel', 'quiet'];

/**
 * Structural validation for editorial tooling. Errors point at concrete fields
 * so authors fix the right place instead of a generic “invalid content” blob.
 */
export function validateActivityRevision(raw: unknown): {
  ok: boolean;
  revision: ActivityRevision | null;
  errors: FieldValidationError[];
} {
  const errors: FieldValidationError[] = [];
  if (raw == null || typeof raw !== 'object') {
    return {
      ok: false,
      revision: null,
      errors: [{ path: '', code: 'not_object', message: 'Activity revision must be an object.' }],
    };
  }
  const value = raw as Record<string, unknown>;

  const activityId = requireString(value.activityId, 'activityId', errors);
  const revisionId = requireString(value.revisionId, 'revisionId', errors);
  if (value.language !== 'cs') {
    errors.push({
      path: 'language',
      code: 'language',
      message: 'Only Czech (cs) content is supported in v1.',
    });
  }
  const title = requireString(value.title, 'title', errors);
  if (title && title.length > 80) {
    errors.push({
      path: 'title',
      code: 'title_length',
      message: 'Title must be at most 80 characters.',
    });
  }

  const ageMonths = parseAge(value.ageMonths, errors);
  const environments = parseEnvironments(value.environments, errors);
  const materials = parseStringArray(value.materials, 'materials', errors);
  const constraints = parseStringArray(value.constraints, 'constraints', errors);
  const duration = parseDuration(value.duration, errors);
  const steps = parseSteps(value.steps, errors);
  const conversationPrompt =
    value.conversationPrompt == null
      ? null
      : requireString(value.conversationPrompt, 'conversationPrompt', errors);
  const primaryArea = parseArea(value.primaryArea, 'primaryArea', errors);
  const relatedAreas = parseAreaList(value.relatedAreas, 'relatedAreas', errors);
  const topicIds = parseStringArray(value.topicIds, 'topicIds', errors);
  for (let i = 0; i < topicIds.length; i += 1) {
    if (!findTopic(topicIds[i]!)) {
      errors.push({
        path: `topicIds[${i}]`,
        code: 'unknown_topic',
        message: `Unknown topic id "${topicIds[i]}".`,
      });
    }
  }
  let activityFamilyId: string | null | undefined;
  if (value.activityFamilyId === undefined) {
    activityFamilyId = undefined;
  } else if (value.activityFamilyId === null) {
    activityFamilyId = null;
  } else if (typeof value.activityFamilyId === 'string' && value.activityFamilyId.trim()) {
    activityFamilyId = value.activityFamilyId.trim();
  } else {
    errors.push({
      path: 'activityFamilyId',
      code: 'activity_family',
      message: 'activityFamilyId must be a non-empty string or null.',
    });
  }
  const sources = parseSources(value.sources, errors);
  const suitability = parseSuitability(value.suitability, errors);
  const editorial = parseEditorial(value.editorial, errors);
  const withdrawnReason =
    value.withdrawnReason == null
      ? null
      : requireString(value.withdrawnReason, 'withdrawnReason', errors);
  const fixtureKind =
    value.fixtureKind == null
      ? undefined
      : value.fixtureKind === 'development' || value.fixtureKind === 'product'
        ? value.fixtureKind
        : (errors.push({
            path: 'fixtureKind',
            code: 'fixture_kind',
            message: 'fixtureKind must be development or product.',
          }),
          undefined);

  // Reject any free-form executable payload fields if authors try to smuggle them.
  for (const banned of ['script', 'eval', 'generator', 'promptTemplate']) {
    if (banned in value) {
      errors.push({
        path: banned,
        code: 'no_executable_content',
        message: 'Content packages cannot carry executable or generative script fields.',
      });
    }
  }

  if (editorial?.stage === 'published') {
    if (sources.length === 0) {
      errors.push({
        path: 'sources',
        code: 'published_needs_source',
        message: 'Published revisions need at least one checked source.',
      });
    }
    const required = ['expert_reviewed', 'language_ux', 'parent_verified', 'published'] as const;
    for (const stage of required) {
      if (!editorial.history.some((event) => event.stage === stage && event.outcome === 'passed')) {
        errors.push({
          path: 'editorial.history',
          code: 'missing_review',
          message: `Published revision is missing a passed "${stage}" review event.`,
        });
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, revision: null, errors };
  }

  const revision: ActivityRevision = {
    activityId: activityId!,
    revisionId: revisionId!,
    language: 'cs',
    title: title!,
    ageMonths: ageMonths!,
    readinessNotes: value.readinessNotes == null ? null : String(value.readinessNotes),
    environments: environments!,
    materials,
    constraints,
    duration: duration!,
    steps: steps!,
    conversationPrompt,
    primaryArea: primaryArea!,
    relatedAreas,
    topicIds,
    ...(activityFamilyId !== undefined ? { activityFamilyId } : {}),
    sources,
    suitability,
    editorial: editorial!,
    withdrawnReason,
    ...(fixtureKind ? { fixtureKind } : {}),
  };
  return { ok: true, revision, errors: [] };
}

function requireString(
  value: unknown,
  path: string,
  errors: FieldValidationError[],
): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push({ path, code: 'required_string', message: `${path} is required.` });
    return null;
  }
  return value.trim();
}

function parseAge(
  value: unknown,
  errors: FieldValidationError[],
): { fromInclusive: number; toInclusive: number } | null {
  if (value == null || typeof value !== 'object') {
    errors.push({ path: 'ageMonths', code: 'age_shape', message: 'ageMonths must be an object.' });
    return null;
  }
  const record = value as Record<string, unknown>;
  const fromInclusive = Number(record.fromInclusive);
  const toInclusive = Number(record.toInclusive);
  if (!Number.isInteger(fromInclusive) || !Number.isInteger(toInclusive)) {
    errors.push({
      path: 'ageMonths',
      code: 'age_integer',
      message: 'Age bounds must be integers.',
    });
    return null;
  }
  if (fromInclusive < 0 || toInclusive < fromInclusive || toInclusive > 216) {
    errors.push({
      path: 'ageMonths',
      code: 'age_range',
      message: 'Age interval must satisfy 0 ≤ from ≤ to ≤ 216 months.',
    });
    return null;
  }
  return { fromInclusive, toInclusive };
}

function parseEnvironments(
  value: unknown,
  errors: FieldValidationError[],
): ContentEnvironment[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push({
      path: 'environments',
      code: 'environments',
      message: 'At least one approved environment is required.',
    });
    return null;
  }
  const out: ContentEnvironment[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    if (typeof item !== 'string' || !(ENVIRONMENTS as readonly string[]).includes(item)) {
      errors.push({
        path: `environments[${i}]`,
        code: 'environment',
        message: `Unknown environment "${String(item)}".`,
      });
      continue;
    }
    out.push(item as ContentEnvironment);
  }
  return out;
}

function parseStringArray(value: unknown, path: string, errors: FieldValidationError[]): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    errors.push({ path, code: 'array', message: `${path} must be an array.` });
    return [];
  }
  return value
    .map((item, index) => {
      if (typeof item !== 'string' || !item.trim()) {
        errors.push({
          path: `${path}[${index}]`,
          code: 'array_string',
          message: `${path} entries must be non-empty strings.`,
        });
        return '';
      }
      return item.trim();
    })
    .filter(Boolean);
}

function parseDuration(value: unknown, errors: FieldValidationError[]): ContentDuration | null {
  if (value == null || typeof value !== 'object') {
    errors.push({ path: 'duration', code: 'duration', message: 'duration is required.' });
    return null;
  }
  const record = value as Record<string, unknown>;
  if (record.kind === 'moment') return { kind: 'moment' };
  if (record.kind === 'minutes') {
    const minutes = Number(record.minutes);
    if (minutes === 5 || minutes === 10 || minutes === 15) {
      return { kind: 'minutes', minutes };
    }
    errors.push({
      path: 'duration.minutes',
      code: 'duration_minutes',
      message: 'Duration minutes must be 5, 10 or 15.',
    });
    return null;
  }
  errors.push({ path: 'duration.kind', code: 'duration_kind', message: 'Unknown duration kind.' });
  return null;
}

function parseSteps(value: unknown, errors: FieldValidationError[]) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) {
    errors.push({
      path: 'steps',
      code: 'steps_count',
      message: 'Activities need 1–3 short steps.',
    });
    return null;
  }
  const steps = value.map((item, index) => {
    if (typeof item !== 'string' || !item.trim()) {
      errors.push({
        path: `steps[${index}]`,
        code: 'step',
        message: 'Each step must be non-empty text.',
      });
      return '';
    }
    if (item.trim().length > 180) {
      errors.push({
        path: `steps[${index}]`,
        code: 'step_length',
        message: 'Each step must be at most 180 characters.',
      });
    }
    return item.trim();
  });
  if (steps.some((step) => !step)) return null;
  return steps as unknown as ActivitySteps;
}

function parseArea(
  value: unknown,
  path: string,
  errors: FieldValidationError[],
): DevelopmentArea | null {
  if (typeof value !== 'string' || !(AREAS as readonly string[]).includes(value)) {
    errors.push({ path, code: 'area', message: `Unknown development area "${String(value)}".` });
    return null;
  }
  return value as DevelopmentArea;
}

function parseAreaList(
  value: unknown,
  path: string,
  errors: FieldValidationError[],
): DevelopmentArea[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    errors.push({ path, code: 'array', message: `${path} must be an array.` });
    return [];
  }
  const out: DevelopmentArea[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const area = parseArea(value[i], `${path}[${i}]`, errors);
    if (area) out.push(area);
  }
  return out;
}

function parseSources(value: unknown, errors: FieldValidationError[]): ContentSource[] {
  if (!Array.isArray(value)) {
    errors.push({ path: 'sources', code: 'array', message: 'sources must be an array.' });
    return [];
  }
  return value.flatMap((item, index): ContentSource[] => {
    if (item == null || typeof item !== 'object') {
      errors.push({
        path: `sources[${index}]`,
        code: 'source_shape',
        message: 'Source entries must be objects.',
      });
      return [];
    }
    const record = item as Record<string, unknown>;
    const label = requireString(record.label, `sources[${index}].label`, errors);
    const checkedOn = requireString(record.checkedOn, `sources[${index}].checkedOn`, errors);
    if (checkedOn && !/^\d{4}-\d{2}-\d{2}$/.test(checkedOn)) {
      errors.push({
        path: `sources[${index}].checkedOn`,
        code: 'source_date',
        message: 'checkedOn must be YYYY-MM-DD.',
      });
    }
    if (record.kind !== 'expert' && record.kind !== 'parent' && record.kind !== 'internal') {
      errors.push({
        path: `sources[${index}].kind`,
        code: 'source_kind',
        message: 'Source kind must be expert, parent or internal.',
      });
      return [];
    }
    if (!label || !checkedOn) return [];
    const kind: ContentSource['kind'] = record.kind;
    const url =
      record.url == null
        ? null
        : typeof record.url === 'string'
          ? record.url
          : (errors.push({
              path: `sources[${index}].url`,
              code: 'source_url',
              message: 'url must be a string when present.',
            }),
            null);
    const supportsPrinciple =
      record.supportsPrinciple == null
        ? null
        : typeof record.supportsPrinciple === 'string'
          ? record.supportsPrinciple
          : (errors.push({
              path: `sources[${index}].supportsPrinciple`,
              code: 'source_supports',
              message: 'supportsPrinciple must be a string when present.',
            }),
            null);
    return [
      {
        label,
        checkedOn,
        kind,
        ...(url ? { url } : {}),
        ...(supportsPrinciple ? { supportsPrinciple } : {}),
      },
    ];
  });
}

function parseSuitability(value: unknown, errors: FieldValidationError[]): SuitabilityCondition[] {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push({
      path: 'suitability',
      code: 'suitability',
      message: 'At least one suitability condition is required.',
    });
    return [];
  }
  const out: SuitabilityCondition[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    if (item == null || typeof item !== 'object') {
      errors.push({
        path: `suitability[${i}]`,
        code: 'suitability_shape',
        message: 'Suitability entries must be objects.',
      });
      continue;
    }
    const record = item as Record<string, unknown>;
    switch (record.kind) {
      case 'age_months': {
        const fromInclusive = Number(record.fromInclusive);
        const toInclusive = Number(record.toInclusive);
        if (
          !Number.isInteger(fromInclusive) ||
          !Number.isInteger(toInclusive) ||
          fromInclusive < 0 ||
          toInclusive < fromInclusive
        ) {
          errors.push({
            path: `suitability[${i}]`,
            code: 'suitability_age',
            message: 'age_months needs a valid inclusive interval.',
          });
          break;
        }
        out.push({ kind: 'age_months', fromInclusive, toInclusive });
        break;
      }
      case 'environment_one_of': {
        const environments = parseEnvironments(record.environments, errors);
        if (environments) out.push({ kind: 'environment_one_of', environments });
        break;
      }
      case 'materials_none':
        out.push({ kind: 'materials_none' });
        break;
      case 'materials_all_of': {
        const materials = parseStringArray(record.materials, `suitability[${i}].materials`, errors);
        out.push({ kind: 'materials_all_of', materials });
        break;
      }
      case 'requires_birth_date':
        out.push({ kind: 'requires_birth_date' });
        break;
      case 'readiness_confirmed': {
        if (
          typeof record.key !== 'string' ||
          !(READINESS_KEYS as readonly string[]).includes(record.key)
        ) {
          errors.push({
            path: `suitability[${i}].key`,
            code: 'suitability_readiness',
            message: 'readiness_confirmed needs a known readiness key.',
          });
          break;
        }
        out.push({ kind: 'readiness_confirmed', key: record.key as ReadinessKey });
        break;
      }
      default:
        errors.push({
          path: `suitability[${i}].kind`,
          code: 'suitability_kind',
          message: `Unsupported suitability kind "${String(record.kind)}".`,
        });
    }
  }
  return out;
}

function parseEditorial(value: unknown, errors: FieldValidationError[]) {
  if (value == null || typeof value !== 'object') {
    errors.push({ path: 'editorial', code: 'editorial', message: 'editorial block is required.' });
    return null;
  }
  const record = value as Record<string, unknown>;
  const stage = record.stage;
  const allowed = [
    'draft',
    'expert_reviewed',
    'language_ux',
    'parent_verified',
    'published',
    'withdrawn',
  ];
  if (typeof stage !== 'string' || !allowed.includes(stage)) {
    errors.push({ path: 'editorial.stage', code: 'stage', message: 'Unknown editorial stage.' });
    return null;
  }
  if (!Array.isArray(record.history)) {
    errors.push({
      path: 'editorial.history',
      code: 'history',
      message: 'editorial.history must be an array.',
    });
    return null;
  }
  const history = record.history.flatMap((item, index): EditorialEvent[] => {
    if (item == null || typeof item !== 'object') {
      errors.push({
        path: `editorial.history[${index}]`,
        code: 'history_shape',
        message: 'History entries must be objects.',
      });
      return [];
    }
    const event = item as Record<string, unknown>;
    if (
      typeof event.stage !== 'string' ||
      typeof event.author !== 'string' ||
      typeof event.note !== 'string' ||
      typeof event.atMs !== 'number' ||
      (event.outcome !== 'passed' && event.outcome !== 'rejected' && event.outcome !== 'withdrawn')
    ) {
      errors.push({
        path: `editorial.history[${index}]`,
        code: 'history_fields',
        message: 'History entries need stage, author, note, atMs and outcome.',
      });
      return [];
    }
    const outcome: EditorialEvent['outcome'] = event.outcome;
    return [
      {
        stage: event.stage as EditorialEvent['stage'],
        author: event.author,
        note: event.note,
        atMs: event.atMs,
        outcome,
      },
    ];
  });
  return {
    stage: stage as ActivityRevision['editorial']['stage'],
    history,
  };
}
