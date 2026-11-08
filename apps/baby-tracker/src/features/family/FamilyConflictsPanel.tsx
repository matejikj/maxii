import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { LumiCard, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import {
  resolveRemoteServicesBoundary,
  shouldInitializeRemoteClients,
} from '../../app/remoteServicesBoundary';
import {
  buildDeleteVsEditPresentation,
  buildDualSleepPresentation,
  buildEditConflictPresentation,
  previewMergedSleepInterval,
  unresolvedSleepUnionMs,
  type DualSleepMeasurement,
} from '../../domain/family/conflictPresentation';
import {
  canCommitResolutionDraft,
  createResolutionDraft,
  refreshResolutionDraftAgainstHeads,
  type ResolutionDraft,
} from '../../domain/family/resolutionDraft';
import { ConflictReviewCard } from './ConflictReviewCard';

export type FamilyConflictFixture = {
  readonly edit?: {
    readonly leftAuthorLabel: string;
    readonly rightAuthorLabel: string;
    readonly leftOccurredLabel: string;
    readonly rightOccurredLabel: string;
    readonly fields: readonly {
      readonly fieldLabel: string;
      readonly leftValue: string;
      readonly rightValue: string;
    }[];
    readonly headRevisionIds: readonly string[];
  };
  readonly dualSleep?: {
    readonly left: DualSleepMeasurement;
    readonly right: DualSleepMeasurement;
    readonly headRevisionIds: readonly string[];
  };
  readonly deleteVsEdit?: {
    readonly deletedSummary: string;
    readonly editSummary: string;
    readonly restoreAvailableUntilLabel: string | null;
    readonly headRevisionIds: readonly string[];
  };
  /** Heads observed after the draft was created — used to mark stale proposals. */
  readonly liveHeadRevisionIds?: readonly string[];
  readonly lastSuccessfulSyncAtLabel?: string | null;
};

type Props = {
  /** Injected open conflicts for family mode; personal installs pass nothing. */
  readonly fixture?: FamilyConflictFixture | null;
  readonly onResolved?: (choiceId: string) => void;
};

/**
 * Optional inbox of family conflicts. Hidden in personal mode so a single
 * conflict never becomes a mandatory startup wall.
 */
export function FamilyConflictsPanel({ fixture = null, onResolved }: Props) {
  const boundary = useMemo(() => resolveRemoteServicesBoundary(), []);
  const enabled = shouldInitializeRemoteClients(boundary) && boundary.syncConfigured;
  const { ui } = useLumiTheme();
  const [draft, setDraft] = useState<ResolutionDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!enabled) {
    return null;
  }

  const hasOpen =
    fixture != null &&
    (fixture.edit != null || fixture.dualSleep != null || fixture.deleteVsEdit != null);

  const editPresentation = fixture?.edit
    ? buildEditConflictPresentation(fixture.edit)
    : null;
  const dualPresentation = fixture?.dualSleep
    ? buildDualSleepPresentation(fixture.dualSleep)
    : null;
  const deletePresentation = fixture?.deleteVsEdit
    ? buildDeleteVsEditPresentation(fixture.deleteVsEdit)
    : null;
  const mergePreview =
    fixture?.dualSleep != null
      ? previewMergedSleepInterval({
          left: fixture.dualSleep.left,
          right: fixture.dualSleep.right,
          nowMs: Date.now(),
        })
      : null;
  const unionLabel =
    fixture?.dualSleep != null &&
    fixture.dualSleep.left.endMs != null &&
    fixture.dualSleep.right.endMs != null
      ? unresolvedSleepUnionMs([
          {
            startMs: fixture.dualSleep.left.startMs,
            endMs: fixture.dualSleep.left.endMs,
          },
          {
            startMs: fixture.dualSleep.right.startMs,
            endMs: fixture.dualSleep.right.endMs,
          },
        ])
      : null;
  const draftHeads =
    fixture?.edit?.headRevisionIds ??
    fixture?.dualSleep?.headRevisionIds ??
    fixture?.deleteVsEdit?.headRevisionIds ??
    [];
  const liveHeads = fixture?.liveHeadRevisionIds ?? draftHeads;
  const staleHeads =
    draft != null &&
    refreshResolutionDraftAgainstHeads(draft, liveHeads).status === 'stale_heads';

  function choose(choiceId: string) {
    const next = createResolutionDraft({
      draftId: `draft-${choiceId}`,
      entityIds: fixture?.dualSleep
        ? [fixture.dualSleep.left.entityId, fixture.dualSleep.right.entityId]
        : ['entity'],
      basedOnHeadRevisionIds: draftHeads,
      choiceId,
      updatedAt: new Date().toISOString(),
    });
    const againstLatest = refreshResolutionDraftAgainstHeads(next, liveHeads);
    setDraft(againstLatest);
    if (!canCommitResolutionDraft(againstLatest)) {
      setMessage(
        'Návrh zůstává jako koncept. Mezitím přišla nová podkladová verze — zkontrolujte ji před potvrzením.',
      );
      return;
    }
    setMessage('Rozhodnutí je připravené k odeslání. Ostatní zápisy péče zůstávají volné.');
    onResolved?.(choiceId);
  }

  return (
    <View style={{ gap: ui.space.md }}>
      <LumiCard>
        <LumiText variant="h3">Ke kontrole v rodině</LumiText>
        <LumiText tone="muted">
          Jeden konflikt neblokuje plenku, krmení ani jiné zápisy. Poslední přenos:{' '}
          {fixture?.lastSuccessfulSyncAtLabel ?? 'zatím nepotvrzený'}
        </LumiText>
        {!hasOpen ? (
          <LumiText tone="muted">Teď není nic ke kontrole.</LumiText>
        ) : null}
      </LumiCard>
      {editPresentation ? (
        <ConflictReviewCard
          presentation={editPresentation}
          staleHeads={staleHeads}
          onChoose={choose}
        />
      ) : null}
      {dualPresentation ? (
        <ConflictReviewCard
          presentation={dualPresentation}
          mergePreviewLabel={
            mergePreview && !('ok' in mergePreview)
              ? `${Math.round(mergePreview.durationMs / 60000)} min`
              : null
          }
          staleHeads={staleHeads}
          onChoose={choose}
        />
      ) : null}
      {dualPresentation && unionLabel != null ? (
        <LumiText tone="muted">
          Překryv známých spánků se sčítá jen jednou (sjednocení):{' '}
          {Math.round(unionLabel / 60000)} min. Zdroje najdete u měření A a B výše.
        </LumiText>
      ) : null}
      {deletePresentation ? (
        <ConflictReviewCard
          presentation={deletePresentation}
          staleHeads={staleHeads}
          onChoose={choose}
        />
      ) : null}
      {message ? <LumiText>{message}</LumiText> : null}
    </View>
  );
}
