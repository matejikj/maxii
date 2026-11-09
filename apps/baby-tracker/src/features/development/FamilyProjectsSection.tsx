import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { LumiButton, LumiCard, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import type { ChildId, ProjectTemplateRevision } from '../../domain';
import {
  createFamilyGuidedProjectFromTemplate,
  listFamilyGuidedProjectsForChild,
  listFamilyGuidedTemplates,
  markFamilyGuidedProjectStep,
  updateFamilyGuidedProjectStatus,
  type FamilyGuidedProjectView,
} from '../../application';
import { useCompositionRoot } from '../../app/providers';
import { usePersonalRuntime } from '../../app/session/BootstrapContext';
import { PRODUCT_COPY } from '../ui';

type FamilyProjectsSectionProps = {
  childId: ChildId;
};

/**
 * Caregiver-led shared projects on the parent Development tab. Child-private
 * workspace stays inactive; this path never pretends to be a private child diary.
 */
export function FamilyProjectsSection({ childId }: FamilyProjectsSectionProps) {
  const { ui } = useLumiTheme();
  const { services } = useCompositionRoot();
  const runtime = usePersonalRuntime();
  const [projects, setProjects] = useState<FamilyGuidedProjectView[]>([]);
  const [templates, setTemplates] = useState<ProjectTemplateRevision[]>([]);
  const [picking, setPicking] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!runtime?.unitOfWork) return;
    const rows = await listFamilyGuidedProjectsForChild(runtime.unitOfWork, { childId });
    setProjects(rows);
    setTemplates(listFamilyGuidedTemplates());
  }, [childId, runtime?.unitOfWork]);

  useEffect(() => {
    void reload().catch(() => setError('Společné projekty se teď nepodařilo načíst.'));
  }, [reload]);

  const selected = projects.find((row) => row.project.projectId === selectedId) ?? null;

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

  if (picking) {
    return (
      <LumiCard testID="family-projects-picker">
        <LumiText variant="h2">{PRODUCT_COPY.development.familyProjects}</LumiText>
        <LumiText tone="muted">{PRODUCT_COPY.development.familyProjectsHint}</LumiText>
        <View style={{ gap: ui.space.sm }}>
          {templates.map((template) => (
            <Pressable
              key={template.revisionId}
              accessibilityRole="button"
              onPress={() => void startFromTemplate(template)}
              style={{ minHeight: 48, justifyContent: 'center', gap: 2 }}
              testID={`family-template-${template.templateId}`}
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
          onPress={() => setPicking(false)}
          disabled={busy}
        />
        {error ? <LumiText tone="muted">{error}</LumiText> : null}
      </LumiCard>
    );
  }

  if (selected) {
    const pending = selected.project.steps.find((step) => step.status === 'pending');
    return (
      <LumiCard testID="family-project-detail">
        <LumiText variant="h2">{selected.project.title}</LumiText>
        <LumiText tone="muted">{selected.scopeLabel}</LumiText>
        <LumiText>{selected.project.intent}</LumiText>
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
    <LumiCard testID="family-projects-section">
      <LumiText variant="h2">{PRODUCT_COPY.development.familyProjects}</LumiText>
      <LumiText tone="muted">{PRODUCT_COPY.development.familyProjectsHint}</LumiText>
      {projects.length === 0 ? (
        <LumiText tone="muted">{PRODUCT_COPY.empty.noFamilyProjects}</LumiText>
      ) : (
        projects.map((row) => (
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
      {error ? <LumiText tone="muted">{error}</LumiText> : null}
    </LumiCard>
  );
}
