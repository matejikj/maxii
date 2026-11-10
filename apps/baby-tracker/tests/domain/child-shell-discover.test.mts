import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asActorId,
  asChildId,
  asEntityId,
  createParentSuggestion,
  type ParentSuggestion,
  type Project,
  type UnitOfWorkFactory,
} from '../../src/domain/index.ts';
import {
  countPublishedDiscoverTemplates,
  dismissChildShellParentSuggestion,
  listChildShellDiscoverTemplates,
  listChildShellParentSuggestionCards,
  startChildShellProjectFromTemplate,
} from '../../src/application/childShellDiscover.ts';
import { PROJECT_TEMPLATES_PUBLISHED } from '../../src/content/catalog/projectTemplatesPublished.ts';

const now = { epochMs: 1_700_000_400_000 };
const childId = asChildId('child_discover');
const owner = asActorId('child_owner_discover');

function memoryDiscoverUow(seed: {
  suggestions?: ParentSuggestion[];
  projects?: Project[];
}): {
  unitOfWork: UnitOfWorkFactory;
  suggestions: Map<string, ParentSuggestion>;
  projects: Map<string, Project>;
} {
  const suggestions = new Map(
    (seed.suggestions ?? []).map((row) => [row.suggestionId, row] as const),
  );
  const projects = new Map((seed.projects ?? []).map((row) => [row.projectId, row] as const));
  const unitOfWork: UnitOfWorkFactory = {
    run: async (work) =>
      work({
        projects: {
          getById: async (id) => projects.get(id) ?? null,
          save: async (project) => {
            projects.set(project.projectId, project);
          },
          listAll: async () => [...projects.values()],
          listByChild: async (id) =>
            [...projects.values()].filter((row) => row.childId === id),
          delete: async () => undefined,
          deleteByChild: async () => 0,
          clearAll: async () => {
            projects.clear();
          },
        },
        parentSuggestions: {
          getById: async (id) => suggestions.get(id) ?? null,
          save: async (suggestion) => {
            suggestions.set(suggestion.suggestionId, suggestion);
          },
          listByChild: async (id) =>
            [...suggestions.values()].filter((row) => row.childId === id),
          listByAuthor: async () => [...suggestions.values()],
          listAll: async () => [...suggestions.values()],
          deleteByChild: async () => 0,
          clearAll: async () => {
            suggestions.clear();
          },
        },
      } as never),
  };
  return { unitOfWork, suggestions, projects };
}

test('discover lists published templates with origin and local search', () => {
  assert.equal(countPublishedDiscoverTemplates(), 12);
  const all = listChildShellDiscoverTemplates('');
  assert.equal(all.length, 12);
  assert.ok(all.every((row) => row.originLabel.length > 0));
  assert.ok(all.every((row) => !/deník dítěte|soukromý účet/i.test(row.originLabel)));

  const bridge = listChildShellDiscoverTemplates('most');
  assert.ok(bridge.some((row) => row.title === 'Papírový most'));
  assert.ok(bridge.length >= 1);

  const empty = listChildShellDiscoverTemplates('zzzz-neexistuje');
  assert.equal(empty.length, 0);
});

test('parent suggestions stay separate and dismissible when mode is open', async () => {
  const suggestion = createParentSuggestion({
    suggestionId: asEntityId('psug_discover_1'),
    childId,
    authorAppUserId: asActorId('parent_a'),
    templateRevisionId: null,
    title: 'Společný výlet do parku',
    note: 'Jen nápad, nic povinného.',
    now,
  });
  const { unitOfWork, suggestions } = memoryDiscoverUow({ suggestions: [suggestion] });

  const closed = await listChildShellParentSuggestionCards({
    unitOfWork,
    childId,
    childPrivateModeActive: false,
  });
  assert.deepEqual(closed, []);

  const open = await listChildShellParentSuggestionCards({
    unitOfWork,
    childId,
    childPrivateModeActive: true,
  });
  assert.equal(open.length, 1);
  assert.equal(open[0]?.sectionLabel, 'Návrh od pečující osoby');
  assert.equal(open[0]?.title, 'Společný výlet do parku');

  const dismissed = await dismissChildShellParentSuggestion({
    unitOfWork,
    suggestionId: suggestion.suggestionId,
    now: { epochMs: now.epochMs + 1 },
    childPrivateModeActive: true,
  });
  assert.equal(dismissed.status, 'dismissed');
  assert.equal(suggestions.get(suggestion.suggestionId)?.status, 'dismissed');

  const after = await listChildShellParentSuggestionCards({
    unitOfWork,
    childId,
    childPrivateModeActive: true,
  });
  assert.equal(after.length, 0);
});

test('starting a template project requires open child mode', async () => {
  const template = PROJECT_TEMPLATES_PUBLISHED[0]!;
  const { unitOfWork, projects } = memoryDiscoverUow({});

  await assert.rejects(
    () =>
      startChildShellProjectFromTemplate({
        unitOfWork,
        ids: { createId: (prefix) => `${prefix}_x` },
        now,
        childId,
        ownerAppUserId: owner,
        templateRevisionId: template.revisionId,
        childPrivateModeActive: false,
      }),
    /not activated/,
  );

  const project = await startChildShellProjectFromTemplate({
    unitOfWork,
    ids: { createId: (prefix) => `${prefix}_ok` },
    now,
    childId,
    ownerAppUserId: owner,
    templateRevisionId: template.revisionId,
    childPrivateModeActive: true,
  });
  assert.equal(project.scope, 'childPrivate');
  assert.equal(project.title, template.title);
  assert.equal(projects.size, 1);
});
