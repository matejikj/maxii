import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { LumiButton, LumiCard, LumiInput, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import { asEntityId, type ChildId, type PortfolioItem, type ProjectTemplateRevision } from '../../domain';
import {
  addPortfolioSelection,
  createFamilyGuidedBlankIdea,
  createFamilyGuidedProjectFromTemplate,
  describeFamilyGuidedCohort8to11Availability,
  listFamilyGuidedProjectShelves,
  listFamilyGuidedTemplates,
  listFamilyGuidedTemplatesForCohort8to11,
  listParentSuggestionsForAuthor,
  listPortfolioSelections,
  listTodayFamilyGuidedProjects,
  markFamilyGuidedProjectStep,
  proposeParentSuggestion,
  saveFamilyGuidedProjectReflection,
  startSuggestionAsFamilyGuided,
  updateFamilyGuidedProjectStatus,
  withdrawAuthoredSuggestion,
  type AuthorSuggestionView,
  type FamilyGuidedProjectView,
  type FamilyGuidedShelfView,
} from '../../application';
import { useCompositionRoot } from '../../app/providers';
import { usePersonalRuntime } from '../../app/session/BootstrapContext';
import { PRODUCT_COPY } from '../ui';

type FamilyProjectsSectionProps = {
  childId: ChildId;
};

type ShelfKey = 'active' | 'paused' | 'closed';

/**
 * Caregiver-led shared projects on the parent Development tab. Child-private
 * workspace stays inactive; this path never pretends to be a private child diary.
 */
export function FamilyProjectsSection({ childId }: FamilyProjectsSectionProps) {
  const { ui } = useLumiTheme();
  const { services } = useCompositionRoot();
  const runtime = usePersonalRuntime();
  const [shelves, setShelves] = useState<FamilyGuidedShelfView>({
    active: [],
    paused: [],
    closed: [],
  });
  const [today, setToday] = useState<FamilyGuidedProjectView[]>([]);
  const [templates8to11, setTemplates8to11] = useState<ProjectTemplateRevision[]>([]);
  const [allTemplates, setAllTemplates] = useState<ProjectTemplateRevision[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [suggestions, setSuggestions] = useState<AuthorSuggestionView[]>([]);
  const [shelf, setShelf] = useState<ShelfKey>('active');
  const [picking, setPicking] = useState(false);
  const [blanking, setBlanking] = useState(false);
  const [blankTitle, setBlankTitle] = useState('');
  const [blankIntent, setBlankIntent] = useState('');
  const [proposing, setProposing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reflectionDraft, setReflectionDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cohortAvailability = useMemo(() => describeFamilyGuidedCohort8to11Availability(), []);

  const reload = useCallback(async () => {
    if (!runtime?.unitOfWork) return;
    setShelves(await listFamilyGuidedProjectShelves(runtime.unitOfWork, { childId }));
    setToday(await listTodayFamilyGuidedProjects(runtime.unitOfWork, { childId }));
    setTemplates8to11(listFamilyGuidedTemplatesForCohort8to11());
    setAllTemplates(listFamilyGuidedTemplates());
    setPortfolio(await listPortfolioSelections(runtime.unitOfWork, childId));
    setSuggestions(
      await listParentSuggestionsForAuthor({
        unitOfWork: runtime.unitOfWork,
        childId,
      }),
    );
  }, [childId, runtime?.unitOfWork]);

  useEffect(() => {
    void reload().catch(() => setError('Společné projekty se teď nepodařilo načíst.'));
  }, [reload]);

  const shelfRows = shelves[shelf];
  const selected =
    [...shelves.active, ...shelves.paused, ...shelves.closed].find(
      (row) => row.project.projectId === selectedId,
    ) ?? null;

  useEffect(() => {
    setReflectionDraft(selected?.project.reflection ?? '');
  }, [selected?.project.projectId, selected?.project.reflection]);

  async function startFromTemplate(template: ProjectTemplateRevision) {
    if (!runtime?.unitOfWork) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createFamilyGuidedProjectFromTemplate({
        unitOfWork: runtime.unitOfWork,
        ids: services.ids,
        now: services.clock.now(),
        childId,
        templateRevisionId: template.revisionId,
      });
      setPicking(false);
      setSelectedId(created.project.projectId);
      await reload();
    } catch {
      setError('Projekt se nepodařilo založit. Zkuste to znovu.');
    } finally {
      setBusy(false);
    }
  }

  async function startBlankIdea() {
    if (!runtime?.unitOfWork) return;
    const title = blankTitle.trim();
    if (!title) {
      setError('Název vlastního nápadu je potřeba.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createFamilyGuidedBlankIdea({
        unitOfWork: runtime.unitOfWork,
        ids: services.ids,
        now: services.clock.now(),
        childId,
        title,
        intent: blankIntent.trim() || undefined,
      });
      setBlanking(false);
      setBlankTitle('');
      setBlankIntent('');
      setSelectedId(created.project.projectId);
      await reload();
    } catch {
      setError('Vlastní nápad se nepodařilo založit.');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(next: 'active' | 'paused' | 'closed') {
    if (!runtime?.unitOfWork || !selected) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await updateFamilyGuidedProjectStatus({
        unitOfWork: runtime.unitOfWork,
        ids: services.ids,
        now: services.clock.now(),
        projectId: selected.project.projectId,
        nextStatus: next,
      });
      setSelectedId(updated.project.projectId);
      await reload();
    } catch {
      setError('Stav projektu se nepodařilo uložit.');
    } finally {
      setBusy(false);
    }
  }

  async function markCurrentStepTried() {
    if (!runtime?.unitOfWork || !selected) return;
    const pending = selected.project.steps.find((step) => step.status === 'pending');
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await markFamilyGuidedProjectStep({
        unitOfWork: runtime.unitOfWork,
        ids: services.ids,
        now: services.clock.now(),
        projectId: selected.project.projectId,
        stepId: pending.stepId,
        status: 'tried',
      });
      setSelectedId(updated.project.projectId);
      await reload();
    } catch {
      setError('Krok se nepodařilo označit.');
    } finally {
      setBusy(false);
    }
  }

  async function saveReflection(value: string | null) {
    if (!runtime?.unitOfWork || !selected) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await saveFamilyGuidedProjectReflection({
        unitOfWork: runtime.unitOfWork,
        ids: services.ids,
        now: services.clock.now(),
        projectId: selected.project.projectId,
        reflection: value,
      });
      setSelectedId(updated.project.projectId);
      await reload();
    } catch {
      setError('Reflexi se nepodařilo uložit.');
    } finally {
      setBusy(false);
    }
  }

  async function addCurrentToPortfolio() {
    if (!runtime?.unitOfWork || !selected) return;
    setBusy(true);
    setError(null);
    try {
      await addPortfolioSelection({
        unitOfWork: runtime.unitOfWork,
        ids: services.ids,
        now: services.clock.now(),
        projectId: selected.project.projectId,
        title: selected.project.title,
        description: selected.project.intent,
      });
      await reload();
    } catch {
      setError('Výtvor se nepodařilo uložit do portfolia.');
    } finally {
      setBusy(false);
    }
  }

  async function proposeFromTemplate(template: ProjectTemplateRevision) {
    if (!runtime?.unitOfWork) return;
    setBusy(true);
    setError(null);
    try {
      await proposeParentSuggestion({
        unitOfWork: runtime.unitOfWork,
        ids: services.ids,
        now: services.clock.now(),
        childId,
        title: template.title,
        note: template.intent,
        templateRevisionId: template.revisionId,
      });
      setProposing(false);
      await reload();
    } catch {
      setError('Návrh se nepodařilo připravit.');
    } finally {
      setBusy(false);
    }
  }

  async function startTogether(suggestionId: string) {
    if (!runtime?.unitOfWork) return;
    setBusy(true);
    setError(null);
    try {
      const result = await startSuggestionAsFamilyGuided({
        unitOfWork: runtime.unitOfWork,
        ids: services.ids,
        now: services.clock.now(),
        suggestionId: asEntityId(suggestionId),
      });
      setSelectedId(result.projectId);
      await reload();
    } catch {
      setError('Společný start se nepodařil.');
    } finally {
      setBusy(false);
    }
  }

  async function withdrawSuggestion(suggestionId: string) {
    if (!runtime?.unitOfWork) return;
    setBusy(true);
    setError(null);
    try {
      await withdrawAuthoredSuggestion({
        unitOfWork: runtime.unitOfWork,
        now: services.clock.now(),
        suggestionId: asEntityId(suggestionId),
      });
      await reload();
    } catch {
      setError('Návrh se nepodařilo stáhnout.');
    } finally {
      setBusy(false);
    }
  }

  function deliveryLabel(delivery: AuthorSuggestionView['delivery']): string {
    switch (delivery) {
      case 'pending':
        return PRODUCT_COPY.development.suggestionPending;
      case 'withdrawn':
        return PRODUCT_COPY.development.suggestionWithdrawn;
      case 'delivered':
        return PRODUCT_COPY.development.suggestionDelivered;
      case 'started_together':
        return PRODUCT_COPY.development.suggestionStartedTogether;
    }
  }

  if (proposing) {
    return (
      <LumiCard testID="parent-suggestions-picker">
        <LumiText variant="h2">{PRODUCT_COPY.development.parentSuggestions}</LumiText>
        <LumiText tone="muted">{PRODUCT_COPY.development.parentSuggestionsHint}</LumiText>
        <View style={{ gap: ui.space.sm }}>
          {allTemplates.map((template) => (
            <Pressable
              key={template.revisionId}
              accessibilityRole="button"
              onPress={() => void proposeFromTemplate(template)}
              style={{ minHeight: 48, justifyContent: 'center', gap: 2 }}
              testID={`suggest-template-${template.templateId}`}
            >
              <LumiText>{template.title}</LumiText>
              <LumiText tone="muted">
                {template.cohort} · {template.theme}
              </LumiText>
            </Pressable>
          ))}
        </View>
        <LumiButton
          title="Zpět"
          variant="secondary"
          onPress={() => setProposing(false)}
          disabled={busy}
        />
        {error ? <LumiText tone="muted">{error}</LumiText> : null}
      </LumiCard>
    );
  }

  if (blanking) {
    return (
      <LumiCard testID="family-blank-idea">
        <LumiText variant="h2">{PRODUCT_COPY.development.startOwnIdea}</LumiText>
        <LumiText tone="muted">{PRODUCT_COPY.development.familyProjectsHint}</LumiText>
        <LumiInput
          label="Název"
          value={blankTitle}
          onChangeText={setBlankTitle}
        />
        <LumiInput
          label="Záměr (volitelné)"
          value={blankIntent}
          onChangeText={setBlankIntent}
          multiline
        />
        <LumiButton title="Založit" onPress={() => void startBlankIdea()} disabled={busy} />
        <LumiButton
          title="Zpět"
          variant="secondary"
          onPress={() => setBlanking(false)}
          disabled={busy}
        />
        {error ? <LumiText tone="muted">{error}</LumiText> : null}
      </LumiCard>
    );
  }

  if (picking) {
    return (
      <LumiCard testID="family-projects-picker">
        <LumiText variant="h2">{PRODUCT_COPY.development.cohort8to11Templates}</LumiText>
        <LumiText tone="muted">{cohortAvailability.detail}</LumiText>
        <View style={{ gap: ui.space.sm }}>
          {templates8to11.map((template) => (
            <Pressable
              key={template.revisionId}
              accessibilityRole="button"
              onPress={() => void startFromTemplate(template)}
              style={{ minHeight: 48, justifyContent: 'center', gap: 2 }}
              testID={`family-template-${template.templateId}`}
            >
              <LumiText>{template.title}</LumiText>
              <LumiText tone="muted">{template.theme}</LumiText>
            </Pressable>
          ))}
        </View>
        <LumiButton
          title={PRODUCT_COPY.development.startOwnIdea}
          variant="secondary"
          onPress={() => {
            setPicking(false);
            setBlanking(true);
          }}
          disabled={busy}
        />
        <LumiButton
          title="Zpět"
          variant="secondary"
          onPress={() => setPicking(false)}
          disabled={busy}
        />
        {error ? <LumiText tone="muted">{error}</LumiText> : null}
      </LumiCard>
    );
  }

  if (selected) {
    const pending = selected.project.steps.find((step) => step.status === 'pending');
    const selectedPortfolio = portfolio.filter(
      (item) => item.projectId === selected.project.projectId,
    );
    return (
      <LumiCard testID="family-project-detail">
        <LumiText variant="h2">{selected.project.title}</LumiText>
        <LumiText tone="muted">{selected.scopeLabel}</LumiText>
        {selected.project.intent ? <LumiText>{selected.project.intent}</LumiText> : null}
        {pending ? (
          <View style={{ gap: ui.space.xs }}>
            <LumiText variant="h2">Aktuální krok</LumiText>
            <LumiText>{pending.text}</LumiText>
            <LumiButton
              title={PRODUCT_COPY.development.markStepTried}
              onPress={() => void markCurrentStepTried()}
              disabled={busy}
            />
          </View>
        ) : (
          <LumiText tone="muted">Všechny kroky jsou vyzkoušené nebo přeskočené.</LumiText>
        )}
        <View style={{ gap: ui.space.xs }}>
          <LumiText tone="muted">{PRODUCT_COPY.development.reflectionHint}</LumiText>
          <LumiInput
            label="Reflexe"
            value={reflectionDraft}
            onChangeText={setReflectionDraft}
            multiline
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <LumiButton
              title={PRODUCT_COPY.development.saveReflection}
              variant="secondary"
              onPress={() => void saveReflection(reflectionDraft.trim() || null)}
              disabled={busy}
            />
            <LumiButton
              title={PRODUCT_COPY.development.skipReflection}
              variant="secondary"
              onPress={() => void saveReflection(null)}
              disabled={busy}
            />
          </View>
        </View>
        <View style={{ gap: ui.space.xs }}>
          <LumiText tone="muted">{PRODUCT_COPY.development.portfolioPrivateNote}</LumiText>
          {selectedPortfolio.length === 0 ? (
            <LumiText tone="muted">{PRODUCT_COPY.development.portfolioEmpty}</LumiText>
          ) : (
            selectedPortfolio.map((item) => (
              <LumiText key={item.portfolioItemId}>{item.title}</LumiText>
            ))
          )}
          <LumiButton
            title={PRODUCT_COPY.development.addToPortfolio}
            variant="secondary"
            onPress={() => void addCurrentToPortfolio()}
            disabled={busy}
          />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {selected.project.status === 'paused' || selected.project.status === 'closed' ? (
            <LumiButton
              title={PRODUCT_COPY.development.resumeFamilyProject}
              variant="secondary"
              onPress={() => void setStatus('active')}
              disabled={busy}
            />
          ) : (
            <LumiButton
              title={PRODUCT_COPY.development.pauseFamilyProject}
              variant="secondary"
              onPress={() => void setStatus('paused')}
              disabled={busy}
            />
          )}
          {selected.project.status !== 'closed' ? (
            <LumiButton
              title={PRODUCT_COPY.development.closeFamilyProject}
              variant="secondary"
              onPress={() => void setStatus('closed')}
              disabled={busy}
            />
          ) : null}
          <LumiButton title="Zpět na seznam" variant="secondary" onPress={() => setSelectedId(null)} />
        </View>
        {error ? <LumiText tone="muted">{error}</LumiText> : null}
      </LumiCard>
    );
  }

  return (
    <View style={{ gap: ui.space.md }}>
      <LumiCard testID="family-projects-today">
        <LumiText variant="h2">{PRODUCT_COPY.development.familyProjectsToday}</LumiText>
        <LumiText tone="muted">{PRODUCT_COPY.development.familyProjectsTodayHint}</LumiText>
        {today.length === 0 ? (
          <LumiText tone="muted">{PRODUCT_COPY.empty.noFamilyProjects}</LumiText>
        ) : (
          today.map((row) => (
            <Pressable
              key={row.project.projectId}
              accessibilityRole="button"
              onPress={() => setSelectedId(row.project.projectId)}
              style={{ minHeight: 48, justifyContent: 'center', gap: 2 }}
              testID={`family-today-${row.project.projectId}`}
            >
              <LumiText>{row.project.title}</LumiText>
              <LumiText tone="muted">
                {row.nextStepText ?? 'Pokračovat vlastním tempem'}
              </LumiText>
            </Pressable>
          ))
        )}
      </LumiCard>

      <LumiCard testID="family-projects-section">
        <LumiText variant="h2">{PRODUCT_COPY.development.familyProjects}</LumiText>
        <LumiText tone="muted">{PRODUCT_COPY.development.familyProjectsHint}</LumiText>
        <LumiText tone="muted">{PRODUCT_COPY.development.cohort8to11Offline}</LumiText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(
            [
              ['active', PRODUCT_COPY.development.familyShelfActive],
              ['paused', PRODUCT_COPY.development.familyShelfPaused],
              ['closed', PRODUCT_COPY.development.familyShelfClosed],
            ] as const
          ).map(([key, label]) => (
            <LumiButton
              key={key}
              title={`${label} (${shelves[key].length})`}
              variant={shelf === key ? 'primary' : 'ghost'}
              onPress={() => setShelf(key)}
            />
          ))}
        </View>
        {shelfRows.length === 0 ? (
          <LumiText tone="muted">{PRODUCT_COPY.empty.noFamilyProjects}</LumiText>
        ) : (
          shelfRows.map((row) => (
            <Pressable
              key={row.project.projectId}
              accessibilityRole="button"
              onPress={() => setSelectedId(row.project.projectId)}
              style={{ minHeight: 48, justifyContent: 'center', gap: 2 }}
              testID={`family-project-${row.project.projectId}`}
            >
              <LumiText>{row.project.title}</LumiText>
              <LumiText tone="muted">
                {row.scopeLabel} · {row.project.status}
              </LumiText>
            </Pressable>
          ))
        )}
        <LumiButton
          title={PRODUCT_COPY.development.startFamilyProject}
          onPress={() => setPicking(true)}
          disabled={busy || !runtime?.unitOfWork}
        />
        <LumiButton
          title={PRODUCT_COPY.development.startOwnIdea}
          variant="secondary"
          onPress={() => setBlanking(true)}
          disabled={busy || !runtime?.unitOfWork}
        />
        {error ? <LumiText tone="muted">{error}</LumiText> : null}
      </LumiCard>

      <LumiCard testID="parent-suggestions-section">
        <LumiText variant="h2">{PRODUCT_COPY.development.parentSuggestions}</LumiText>
        <LumiText tone="muted">{PRODUCT_COPY.development.parentSuggestionsHint}</LumiText>
        {suggestions.length === 0 ? (
          <LumiText tone="muted">{PRODUCT_COPY.development.noParentSuggestions}</LumiText>
        ) : (
          suggestions.map((row) => (
            <View
              key={row.suggestionId}
              style={{ gap: 4, minHeight: 48 }}
              testID={`suggestion-${row.suggestionId}`}
            >
              <LumiText>{row.title}</LumiText>
              <LumiText tone="muted">{deliveryLabel(row.delivery)}</LumiText>
              {row.delivery === 'pending' ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <LumiButton
                    title={PRODUCT_COPY.development.startSuggestionTogether}
                    onPress={() => void startTogether(row.suggestionId)}
                    disabled={busy}
                  />
                  <LumiButton
                    title={PRODUCT_COPY.development.withdrawSuggestion}
                    variant="secondary"
                    onPress={() => void withdrawSuggestion(row.suggestionId)}
                    disabled={busy}
                  />
                </View>
              ) : null}
            </View>
          ))
        )}
        <LumiButton
          title={PRODUCT_COPY.development.proposeSuggestion}
          variant="secondary"
          onPress={() => setProposing(true)}
          disabled={busy || !runtime?.unitOfWork}
        />
      </LumiCard>
    </View>
  );
}
