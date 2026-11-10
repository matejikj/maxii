import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { LumiButton, LumiCard, LumiInput, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import {
  CHILD_SHELL_FIRST_ENTRY,
  closeChildShellProject,
  confirmAndPublishChildShellShare,
  continueChildShellProject,
  createChildShellBlankProject,
  dismissChildShellParentSuggestion,
  listChildShellDiscoverTemplates,
  listChildShellParentSuggestionCards,
  listChildShellProjectShelves,
  listChildShellShareCards,
  listChildShellTodayCards,
  loadChildShellProjectDetail,
  pauseChildShellProject,
  prepareChildShellShareProposal,
  revokeChildShellShare,
  saveChildShellProjectReflection,
  startChildShellProjectFromTemplate,
  type ChildShellDiscoverTemplateCard,
  type ChildShellParentSuggestionCard,
  type ChildShellProjectCard,
  type ChildShellProjectDetailView,
  type ChildShellSession,
  type ChildShellShareCard,
} from '../../application';
import { useCompositionRoot } from '../../app/providers';
import { useBootstrap } from '../../app/session/BootstrapContext';
import {
  asActorId,
  asEntityId,
  type ActorId,
  type ChildId,
  type EntityId,
  type PendingShareProposal,
} from '../../domain';

type ShellProps = {
  readonly session: ChildShellSession;
  readonly onOpenProfile: () => void;
  /** Test/harness override — production always leaves mode inactive. */
  readonly childPrivateModeActive: boolean;
};

function ShellHeader({
  alias,
  onOpenProfile,
}: {
  alias: string;
  onOpenProfile: () => void;
}) {
  return (
    <View style={styles.header} testID="child-shell-header">
      <View style={{ flex: 1 }}>
        <LumiText variant="h2">{alias}</LumiText>
        <LumiText tone="muted">Jen pro mě</LumiText>
      </View>
      <LumiButton title="Profil" onPress={onOpenProfile} />
    </View>
  );
}

function ProjectCardList({
  title,
  cards,
  empty,
  onSelect,
}: {
  title: string;
  cards: readonly ChildShellProjectCard[];
  empty: string;
  onSelect?: (projectId: string) => void;
}) {
  return (
    <LumiCard>
      <LumiText variant="h3">{title}</LumiText>
      {cards.length === 0 ? (
        <LumiText tone="muted">{empty}</LumiText>
      ) : (
        cards.map((card) => (
          <View key={card.projectId} style={styles.cardRow}>
            <LumiText>{card.title}</LumiText>
            <LumiText tone="muted">
              {card.scopeLabel}
              {card.currentStepText ? ` · ${card.currentStepText}` : ''}
            </LumiText>
            {onSelect ? (
              <LumiButton title="Otevřít" onPress={() => onSelect(card.projectId)} />
            ) : null}
          </View>
        ))
      )}
    </LumiCard>
  );
}

export function ChildShellTodayScreen(props: ShellProps) {
  const { colors } = useLumiTheme();
  const bootstrap = useBootstrap();
  const [cards, setCards] = useState<ChildShellProjectCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!bootstrap.runtime) return;
    const next = await listChildShellTodayCards({
      unitOfWork: bootstrap.runtime.unitOfWork,
      ownerAppUserId: props.session.principal.appUserId,
      childPrivateModeActive: props.childPrivateModeActive,
    });
    setCards(next);
  }, [bootstrap.runtime, props.childPrivateModeActive, props.session.principal.appUserId]);

  useEffect(() => {
    void reload().catch((err) => {
      setError(err instanceof Error ? err.message : 'Načtení selhalo');
    });
  }, [reload]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.pad}
      testID="child-shell-today"
    >
      <ShellHeader alias={props.session.principal.displayAlias} onOpenProfile={props.onOpenProfile} />
      {!props.session.firstEntryCompleted ? (
        <LumiCard testID="child-shell-first-entry">
          <LumiText variant="h3">Vítej</LumiText>
          <LumiText>{CHILD_SHELL_FIRST_ENTRY.headline}</LumiText>
        </LumiCard>
      ) : null}
      <ProjectCardList
        title="Dnes"
        cards={cards}
        empty="Zatím žádný aktivní projekt. V Projektech můžeš začít vlastní nápad."
      />
      {error ? <LumiText tone="danger">{error}</LumiText> : null}
    </ScrollView>
  );
}

export function ChildShellProjectsScreen(props: ShellProps) {
  const { colors } = useLumiTheme();
  const bootstrap = useBootstrap();
  const { services } = useCompositionRoot();
  const [shelves, setShelves] = useState<{
    active: ChildShellProjectCard[];
    paused: ChildShellProjectCard[];
    closed: ChildShellProjectCard[];
  }>({ active: [], paused: [], closed: [] });
  const [detail, setDetail] = useState<ChildShellProjectDetailView | null>(null);
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [reflectionDraft, setReflectionDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ownerAppUserId = props.session.principal.appUserId as ActorId;

  const reload = useCallback(async () => {
    if (!bootstrap.runtime) return;
    const next = await listChildShellProjectShelves({
      unitOfWork: bootstrap.runtime.unitOfWork,
      ownerAppUserId: props.session.principal.appUserId,
      childPrivateModeActive: props.childPrivateModeActive,
    });
    setShelves(next);
  }, [bootstrap.runtime, props.childPrivateModeActive, props.session.principal.appUserId]);

  const openDetail = useCallback(
    async (projectId: string) => {
      if (!bootstrap.runtime) return;
      const next = await loadChildShellProjectDetail({
        unitOfWork: bootstrap.runtime.unitOfWork,
        projectId: asEntityId(projectId) as EntityId,
        ownerAppUserId,
        childPrivateModeActive: props.childPrivateModeActive,
      });
      setDetail(next);
      setReflectionDraft(next.reflection ?? '');
      setShowAllSteps(false);
    },
    [bootstrap.runtime, ownerAppUserId, props.childPrivateModeActive],
  );

  useEffect(() => {
    void reload().catch((err) => {
      setError(err instanceof Error ? err.message : 'Načtení selhalo');
    });
  }, [reload]);

  const childId =
    props.session.principal.linkedChildProfileId ??
    (bootstrap.profile?.childId as ChildId | undefined);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.pad}
      testID="child-shell-projects"
    >
      <ShellHeader alias={props.session.principal.displayAlias} onOpenProfile={props.onOpenProfile} />
      <LumiButton
        title="Vlastní nápad"
        disabled={busy || !childId || !props.childPrivateModeActive}
        onPress={() => {
          if (!bootstrap.runtime || !childId) return;
          setBusy(true);
          setError(null);
          void createChildShellBlankProject({
            unitOfWork: bootstrap.runtime.unitOfWork,
            childId,
            ownerAppUserId,
            title: 'Můj nápad',
            intent: 'Chci zkusit něco vlastního.',
            now: { epochMs: Date.now() },
            childPrivateModeActive: props.childPrivateModeActive,
          })
            .then(async (created) => {
              await reload();
              await openDetail(created.projectId);
            })
            .catch((err) => {
              setError(err instanceof Error ? err.message : 'Uložení selhalo');
            })
            .finally(() => setBusy(false));
        }}
      />
      {detail ? (
        <LumiCard testID="child-shell-project-detail">
          <LumiText variant="h3">{detail.title}</LumiText>
          <LumiText tone="muted">{detail.scopeLabel}</LumiText>
          <LumiText>{detail.intent}</LumiText>
          <LumiText variant="h3">Aktuální krok</LumiText>
          {detail.currentStep ? (
            <LumiText>{detail.currentStep.text}</LumiText>
          ) : (
            <LumiText tone="muted">Všechny kroky jsou hotové, nebo zatím žádné nejsou.</LumiText>
          )}
          {detail.hasMoreSteps ? (
            <LumiButton
              title={showAllSteps ? 'Skrýt další kroky' : 'Zobrazit další kroky'}
              onPress={() => setShowAllSteps((value) => !value)}
            />
          ) : null}
          {showAllSteps
            ? detail.steps.map((step) => (
                <View key={step.stepId} style={styles.cardRow}>
                  <LumiText>
                    {step.order + 1}. {step.text}
                  </LumiText>
                  <LumiText tone="muted">{step.status}</LumiText>
                </View>
              ))
            : null}
          <LumiButton
            title="Pokračovat"
            disabled={busy}
            onPress={() => {
              if (!bootstrap.runtime) return;
              setBusy(true);
              setError(null);
              void continueChildShellProject({
                unitOfWork: bootstrap.runtime.unitOfWork,
                ids: services.ids,
                now: { epochMs: Date.now() },
                projectId: asEntityId(detail.projectId) as EntityId,
                ownerAppUserId,
                childPrivateModeActive: props.childPrivateModeActive,
              })
                .then(async (next) => {
                  setDetail(next);
                  await reload();
                })
                .catch((err) => {
                  setError(err instanceof Error ? err.message : 'Pokračování selhalo');
                })
                .finally(() => setBusy(false));
            }}
          />
          <LumiButton
            title="Odložit"
            disabled={busy}
            onPress={() => {
              if (!bootstrap.runtime) return;
              setBusy(true);
              setError(null);
              void pauseChildShellProject({
                unitOfWork: bootstrap.runtime.unitOfWork,
                ids: services.ids,
                now: { epochMs: Date.now() },
                projectId: asEntityId(detail.projectId) as EntityId,
                ownerAppUserId,
                childPrivateModeActive: props.childPrivateModeActive,
              })
                .then(async (next) => {
                  setDetail(next);
                  await reload();
                })
                .catch((err) => {
                  setError(err instanceof Error ? err.message : 'Odložení selhalo');
                })
                .finally(() => setBusy(false));
            }}
          />
          <LumiButton
            title="Uzavřít"
            disabled={busy}
            onPress={() => {
              if (!bootstrap.runtime) return;
              setBusy(true);
              setError(null);
              void closeChildShellProject({
                unitOfWork: bootstrap.runtime.unitOfWork,
                ids: services.ids,
                now: { epochMs: Date.now() },
                projectId: asEntityId(detail.projectId) as EntityId,
                ownerAppUserId,
                childPrivateModeActive: props.childPrivateModeActive,
              })
                .then(async (next) => {
                  setDetail(next);
                  await reload();
                })
                .catch((err) => {
                  setError(err instanceof Error ? err.message : 'Uzavření selhalo');
                })
                .finally(() => setBusy(false));
            }}
          />
          <LumiText variant="h3">Malý zápis</LumiText>
          <LumiText tone="muted">Volitelné — Co jsem zkusil/a, Co bych změnil/a. Můžeš vynechat.</LumiText>
          <LumiInput
            label="Reflexe"
            accessibilityLabel="Reflexe"
            placeholder="Volitelná poznámka"
            value={reflectionDraft}
            onChangeText={setReflectionDraft}
          />
          <LumiButton
            title="Uložit zápis"
            disabled={busy}
            onPress={() => {
              if (!bootstrap.runtime) return;
              setBusy(true);
              setError(null);
              void saveChildShellProjectReflection({
                unitOfWork: bootstrap.runtime.unitOfWork,
                ids: services.ids,
                now: { epochMs: Date.now() },
                projectId: asEntityId(detail.projectId) as EntityId,
                ownerAppUserId,
                reflection: reflectionDraft,
                childPrivateModeActive: props.childPrivateModeActive,
              })
                .then((next) => {
                  setDetail(next);
                  setReflectionDraft(next.reflection ?? '');
                })
                .catch((err) => {
                  setError(err instanceof Error ? err.message : 'Uložení zápisu selhalo');
                })
                .finally(() => setBusy(false));
            }}
          />
          <LumiButton
            title="Zavřít detail"
            disabled={busy}
            onPress={() => setDetail(null)}
          />
        </LumiCard>
      ) : null}
      <ProjectCardList
        title="Aktivní"
        cards={shelves.active}
        empty="Žádný aktivní projekt."
        onSelect={(projectId) => {
          void openDetail(projectId).catch((err) => {
            setError(err instanceof Error ? err.message : 'Načtení detailu selhalo');
          });
        }}
      />
      <ProjectCardList
        title="Odložené"
        cards={shelves.paused}
        empty="Nic odloženého."
        onSelect={(projectId) => {
          void openDetail(projectId).catch((err) => {
            setError(err instanceof Error ? err.message : 'Načtení detailu selhalo');
          });
        }}
      />
      <ProjectCardList
        title="Uzavřené"
        cards={shelves.closed}
        empty="Zatím nic uzavřeného."
        onSelect={(projectId) => {
          void openDetail(projectId).catch((err) => {
            setError(err instanceof Error ? err.message : 'Načtení detailu selhalo');
          });
        }}
      />
      {error ? <LumiText tone="danger">{error}</LumiText> : null}
    </ScrollView>
  );
}

export function ChildShellPortfolioScreen(props: ShellProps) {
  const { colors } = useLumiTheme();
  const bootstrap = useBootstrap();
  const { services } = useCompositionRoot();
  const [shares, setShares] = useState<ChildShellShareCard[]>([]);
  const [pending, setPending] = useState<PendingShareProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recipientId, setRecipientId] = useState('parent_named');

  const reloadShares = useCallback(async () => {
    if (!bootstrap.runtime) return;
    const next = await listChildShellShareCards({
      unitOfWork: bootstrap.runtime.unitOfWork,
      ownerAppUserId: props.session.principal.appUserId as ActorId,
      childPrivateModeActive: props.childPrivateModeActive,
    });
    setShares(next);
  }, [bootstrap.runtime, props.childPrivateModeActive, props.session.principal.appUserId]);

  useEffect(() => {
    void reloadShares().catch((err) => {
      setError(err instanceof Error ? err.message : 'Načtení selhalo');
    });
  }, [reloadShares]);

  const ownerAppUserId = props.session.principal.appUserId as ActorId;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.pad}
      testID="child-shell-portfolio"
    >
      <ShellHeader alias={props.session.principal.displayAlias} onOpenProfile={props.onOpenProfile} />
      <LumiCard>
        <LumiText variant="h3">Portfolio</LumiText>
        <LumiText tone="muted">
          Sem patří jen výtvory, které sám vybereš. Není to žebříček ani automatická historie výkonu.
        </LumiText>
      </LumiCard>
      <LumiCard testID="child-shell-share-panel">
        <LumiText variant="h3">Ukázat někomu</LumiText>
        <LumiText tone="muted">
          Uvidí jen tuto ukázku. Další úpravy projektu zůstanou u tebe. Připojení samo nic
          neodešle — musíš potvrdit.
        </LumiText>
        <LumiButton
          title="Připravit ukázku"
          disabled={busy || !props.childPrivateModeActive || !bootstrap.runtime}
          onPress={() => {
            if (!bootstrap.runtime) return;
            setBusy(true);
            setError(null);
            void bootstrap.runtime.unitOfWork
              .run(async (uow) => {
                const mine = (await uow.projects.listAll()).find(
                  (project) =>
                    project.scope === 'childPrivate' &&
                    project.ownerAppUserId === ownerAppUserId,
                );
                if (!mine) {
                  throw new Error('Nejdřív založ vlastní projekt v záložce Projekty.');
                }
                return prepareChildShellShareProposal({
                  project: mine,
                  ownerAppUserId,
                  publishedTitle: mine.title,
                  publishedBody: mine.intent,
                  audienceAppUserIds: [asActorId(recipientId.trim() || 'parent_named')],
                  now: { epochMs: Date.now() },
                  childPrivateModeActive: props.childPrivateModeActive,
                });
              })
              .then((proposal) => {
                setPending(proposal);
                setRecipientId(proposal.audienceAppUserIds[0] ?? 'parent_named');
              })
              .catch((err) => {
                setError(err instanceof Error ? err.message : 'Příprava selhala');
              })
              .finally(() => setBusy(false));
          }}
        />
        {pending ? (
          <View style={styles.cardRow} testID="child-shell-share-preview">
            <LumiText>Náhled: {pending.publishedTitle}</LumiText>
            <LumiText tone="muted">{pending.publishedBody}</LumiText>
            <LumiText tone="muted">
              Příjemci: {pending.audienceAppUserIds.join(', ')} · čeká na potvrzení
            </LumiText>
            <LumiButton
              title="Potvrdit odeslání ukázky"
              disabled={busy}
              onPress={() => {
                if (!bootstrap.runtime || !pending) return;
                setBusy(true);
                setError(null);
                void confirmAndPublishChildShellShare({
                  unitOfWork: bootstrap.runtime.unitOfWork,
                  ids: services.ids,
                  now: { epochMs: Date.now() },
                  proposal: pending,
                  ownerAppUserId,
                  explicitConfirm: true,
                  networkBecameOnline: true,
                  childPrivateModeActive: props.childPrivateModeActive,
                })
                  .then(() => {
                    setPending(null);
                    return reloadShares();
                  })
                  .catch((err) => {
                    setError(err instanceof Error ? err.message : 'Odeslání selhalo');
                  })
                  .finally(() => setBusy(false));
              }}
            />
            <LumiButton
              title="Zrušit návrh"
              disabled={busy}
              onPress={() => setPending(null)}
            />
          </View>
        ) : null}
      </LumiCard>
      <LumiCard testID="child-shell-share-list">
        <LumiText variant="h3">Sdílené ukázky</LumiText>
        {shares.length === 0 ? (
          <LumiText tone="muted">Zatím žádná aktivní ukázka.</LumiText>
        ) : (
          shares.map((share) => (
            <View key={share.shareId} style={styles.cardRow}>
              <LumiText>{share.publishedTitle}</LumiText>
              <LumiText tone="muted">
                {share.statusLabel} · příjemců {share.audienceCount}
              </LumiText>
              {!share.revoked ? (
                <LumiButton
                  title="Odvolat"
                  disabled={busy}
                  onPress={() => {
                    if (!bootstrap.runtime) return;
                    setBusy(true);
                    setError(null);
                    void revokeChildShellShare({
                      unitOfWork: bootstrap.runtime.unitOfWork,
                      now: { epochMs: Date.now() },
                      shareId: asEntityId(share.shareId) as EntityId,
                      ownerAppUserId,
                      childPrivateModeActive: props.childPrivateModeActive,
                    })
                      .then(() => reloadShares())
                      .catch((err) => {
                        setError(err instanceof Error ? err.message : 'Odvolání selhalo');
                      })
                      .finally(() => setBusy(false));
                  }}
                />
              ) : null}
            </View>
          ))
        )}
      </LumiCard>
      {error ? <LumiText tone="danger">{error}</LumiText> : null}
    </ScrollView>
  );
}

export function ChildShellDiscoverScreen(props: ShellProps) {
  const { colors } = useLumiTheme();
  const bootstrap = useBootstrap();
  const { services } = useCompositionRoot();
  const [query, setQuery] = useState('');
  const [templates, setTemplates] = useState<ChildShellDiscoverTemplateCard[]>(() =>
    listChildShellDiscoverTemplates(''),
  );
  const [suggestions, setSuggestions] = useState<ChildShellParentSuggestionCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const childId =
    props.session.principal.linkedChildProfileId ??
    (bootstrap.profile?.childId as ChildId | undefined);
  const ownerAppUserId = props.session.principal.appUserId as ActorId;

  const reloadSuggestions = useCallback(async () => {
    if (!bootstrap.runtime || !childId) {
      setSuggestions([]);
      return;
    }
    const next = await listChildShellParentSuggestionCards({
      unitOfWork: bootstrap.runtime.unitOfWork,
      childId,
      childPrivateModeActive: props.childPrivateModeActive,
    });
    setSuggestions(next);
  }, [bootstrap.runtime, childId, props.childPrivateModeActive]);

  useEffect(() => {
    setTemplates(listChildShellDiscoverTemplates(query));
  }, [query]);

  useEffect(() => {
    void reloadSuggestions().catch((err) => {
      setError(err instanceof Error ? err.message : 'Načtení návrhů selhalo');
    });
  }, [reloadSuggestions]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.pad}
      testID="child-shell-discover"
    >
      <ShellHeader alias={props.session.principal.displayAlias} onOpenProfile={props.onOpenProfile} />
      <LumiCard testID="child-shell-discover-search">
        <LumiText variant="h3">Objevování</LumiText>
        <LumiText tone="muted">
          Vydané šablony a náměty podle dostupné sady. Lokální hledání běží bez sítě. Rodičovský
          návrh je oddělený a můžeš ho odložit.
        </LumiText>
        <LumiInput
          label="Hledat šablonu"
          accessibilityLabel="Hledat šablonu"
          placeholder="Název, téma nebo záměr"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </LumiCard>
      <LumiCard testID="child-shell-parent-suggestions">
        <LumiText variant="h3">Návrh od pečující osoby</LumiText>
        {!props.childPrivateModeActive ? (
          <LumiText tone="muted">
            Oddělené návrhy se zobrazí až po aktivaci vlastního dětského prostoru.
          </LumiText>
        ) : suggestions.length === 0 ? (
          <LumiText tone="muted">Žádný čekající návrh.</LumiText>
        ) : (
          suggestions.map((card) => (
            <View key={card.suggestionId} style={styles.cardRow}>
              <LumiText>{card.title}</LumiText>
              {card.note ? <LumiText tone="muted">{card.note}</LumiText> : null}
              <LumiButton
                title="Odložit"
                disabled={busy}
                onPress={() => {
                  if (!bootstrap.runtime) return;
                  setBusy(true);
                  setError(null);
                  void dismissChildShellParentSuggestion({
                    unitOfWork: bootstrap.runtime.unitOfWork,
                    suggestionId: asEntityId(card.suggestionId) as EntityId,
                    now: { epochMs: Date.now() },
                    childPrivateModeActive: props.childPrivateModeActive,
                  })
                    .then(() => reloadSuggestions())
                    .catch((err) => {
                      setError(err instanceof Error ? err.message : 'Odložení selhalo');
                    })
                    .finally(() => setBusy(false));
                }}
              />
            </View>
          ))
        )}
      </LumiCard>
      <LumiCard testID="child-shell-discover-templates">
        <LumiText variant="h3">Vydané šablony</LumiText>
        {templates.length === 0 ? (
          <LumiText tone="muted">Nic neodpovídá hledání.</LumiText>
        ) : (
          templates.map((card) => (
            <View key={card.revisionId} style={styles.cardRow}>
              <LumiText>{card.title}</LumiText>
              <LumiText tone="muted">
                {card.theme} · {card.cohort}
              </LumiText>
              <LumiText tone="muted">{card.originLabel}</LumiText>
              <LumiText tone="muted">{card.privacyNote}</LumiText>
              <LumiButton
                title="Začít z šablony"
                disabled={busy || !childId || !props.childPrivateModeActive}
                onPress={() => {
                  if (!bootstrap.runtime || !childId) return;
                  setBusy(true);
                  setError(null);
                  void startChildShellProjectFromTemplate({
                    unitOfWork: bootstrap.runtime.unitOfWork,
                    ids: services.ids,
                    now: { epochMs: Date.now() },
                    childId,
                    ownerAppUserId,
                    templateRevisionId: card.revisionId,
                    childPrivateModeActive: props.childPrivateModeActive,
                  })
                    .then(() => {
                      setError(null);
                    })
                    .catch((err) => {
                      setError(err instanceof Error ? err.message : 'Založení selhalo');
                    })
                    .finally(() => setBusy(false));
                }}
              />
            </View>
          ))
        )}
      </LumiCard>
      {error ? <LumiText tone="danger">{error}</LumiText> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  cardRow: { marginTop: 8, gap: 2 },
});
