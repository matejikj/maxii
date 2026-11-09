import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { LumiButton, LumiCard, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import {
  CHILD_SHELL_FIRST_ENTRY,
  createChildShellBlankProject,
  listChildShellProjectShelves,
  listChildShellTodayCards,
  type ChildShellProjectCard,
  type ChildShellSession,
} from '../../application';
import { useBootstrap } from '../../app/session/BootstrapContext';
import type { ActorId, ChildId } from '../../domain';

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
}: {
  title: string;
  cards: readonly ChildShellProjectCard[];
  empty: string;
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
  const [shelves, setShelves] = useState<{
    active: ChildShellProjectCard[];
    paused: ChildShellProjectCard[];
    closed: ChildShellProjectCard[];
  }>({ active: [], paused: [], closed: [] });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!bootstrap.runtime) return;
    const next = await listChildShellProjectShelves({
      unitOfWork: bootstrap.runtime.unitOfWork,
      ownerAppUserId: props.session.principal.appUserId,
      childPrivateModeActive: props.childPrivateModeActive,
    });
    setShelves(next);
  }, [bootstrap.runtime, props.childPrivateModeActive, props.session.principal.appUserId]);

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
            ownerAppUserId: props.session.principal.appUserId as ActorId,
            title: 'Můj nápad',
            intent: 'Chci zkusit něco vlastního.',
            now: { epochMs: Date.now() },
            childPrivateModeActive: props.childPrivateModeActive,
          })
            .then(() => reload())
            .catch((err) => {
              setError(err instanceof Error ? err.message : 'Uložení selhalo');
            })
            .finally(() => setBusy(false));
        }}
      />
      <ProjectCardList title="Aktivní" cards={shelves.active} empty="Žádný aktivní projekt." />
      <ProjectCardList title="Odložené" cards={shelves.paused} empty="Nic odloženého." />
      <ProjectCardList title="Uzavřené" cards={shelves.closed} empty="Zatím nic uzavřeného." />
      {error ? <LumiText tone="danger">{error}</LumiText> : null}
    </ScrollView>
  );
}

export function ChildShellPortfolioScreen(props: ShellProps) {
  const { colors } = useLumiTheme();
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
    </ScrollView>
  );
}

export function ChildShellDiscoverScreen(props: ShellProps) {
  const { colors } = useLumiTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.pad}
      testID="child-shell-discover"
    >
      <ShellHeader alias={props.session.principal.displayAlias} onOpenProfile={props.onOpenProfile} />
      <LumiCard>
        <LumiText variant="h3">Objevování</LumiText>
        <LumiText tone="muted">
          Vydané šablony a náměty podle dostupné sady. Rodičovský návrh je oddělený a můžeš ho
          odložit.
        </LumiText>
      </LumiCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  cardRow: { marginTop: 8, gap: 2 },
});
