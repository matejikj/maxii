import type { SyncTransferPresentation } from '../sync/presentation.ts';
import { describeRecordTransferLine } from '../sync/durabilityLabels.ts';

export type AuthorshipLine = {
  readonly originalAuthorLabel: string;
  readonly lastEditorLabel: string | null;
  readonly transferLine: string | null;
};

export type FieldDiff = {
  readonly fieldLabel: string;
  readonly leftValue: string;
  readonly rightValue: string;
  readonly changed: boolean;
};

export type EditConflictPresentation = {
  readonly kind: 'edit_conflict';
  readonly title: 'Souběžná úprava — zkontrolujte';
  readonly leftAuthorLabel: string;
  readonly rightAuthorLabel: string;
  readonly leftOccurredLabel: string;
  readonly rightOccurredLabel: string;
  readonly fields: readonly FieldDiff[];
  readonly choices: readonly [
    { readonly id: 'choose_left'; readonly label: 'Použít variantu A' },
    { readonly id: 'choose_right'; readonly label: 'Použít variantu B' },
    { readonly id: 'manual'; readonly label: 'Upravit ručně' },
  ];
  readonly preselectedChoiceId: null;
};

export type DualSleepMeasurement = {
  readonly entityId: string;
  readonly authorLabel: string;
  readonly deviceLabel: string;
  readonly status: 'active' | 'completed';
  readonly startLabel: string;
  readonly durationLabel: string;
  readonly precisionLabel: 'exact' | 'approximate';
  readonly startMs: number;
  readonly endMs: number | null;
};

export type DualSleepPresentation = {
  readonly kind: 'dual_sleep';
  readonly title: 'Dvě měření spánku — zkontrolujte';
  readonly left: DualSleepMeasurement;
  readonly right: DualSleepMeasurement;
  readonly choices: readonly [
    { readonly id: 'merge'; readonly label: 'Sloučit do jednoho intervalu' },
    { readonly id: 'keep_both'; readonly label: 'Ponechat obě opravená měření' },
    { readonly id: 'end_left'; readonly label: 'Ukončit / opravit měření A' },
    { readonly id: 'end_right'; readonly label: 'Ukončit / opravit měření B' },
  ];
  readonly preselectedChoiceId: null;
  readonly claimsChildWoke: false;
};

export type DeleteVsEditPresentation = {
  readonly kind: 'delete_vs_edit';
  readonly title: 'Smazání a souběžná úprava';
  readonly deletedSummary: string;
  readonly editSummary: string;
  readonly restoreAvailableUntilLabel: string | null;
  readonly openingVariantUndoesDelete: false;
  readonly choices: readonly [
    { readonly id: 'keep_deleted'; readonly label: 'Nechat smazané' },
    { readonly id: 'restore_then_edit'; readonly label: 'Obnovit a použít úpravu' },
  ];
  readonly preselectedChoiceId: null;
};

export type MergeSleepPreview = {
  readonly startMs: number;
  readonly endMs: number;
  readonly durationMs: number;
  readonly sourceEntityIds: readonly [string, string];
};

/**
 * Authorship and transfer lines for a detail view. Never claim other devices
 * already received the change just because this phone saved locally.
 */
export function buildAuthorshipLine(input: {
  readonly originalAuthorLabel: string | null;
  readonly lastEditorLabel: string | null;
  readonly transfer: SyncTransferPresentation | null;
  readonly lastSuccessfulSyncAtLabel: string | null;
}): AuthorshipLine {
  const original = input.originalAuthorLabel?.trim() || 'Toto zařízení';
  const lastEditor =
    input.lastEditorLabel && input.lastEditorLabel !== original
      ? input.lastEditorLabel
      : null;
  const transferLine = input.transfer
    ? describeRecordTransferLine({
        transfer: input.transfer,
        lastSuccessfulSyncAtLabel: input.lastSuccessfulSyncAtLabel,
      })
    : null;
  return {
    originalAuthorLabel: original,
    lastEditorLabel: lastEditor,
    transferLine,
  };
}

export function buildEditConflictPresentation(input: {
  readonly leftAuthorLabel: string;
  readonly rightAuthorLabel: string;
  readonly leftOccurredLabel: string;
  readonly rightOccurredLabel: string;
  readonly fields: readonly {
    readonly fieldLabel: string;
    readonly leftValue: string;
    readonly rightValue: string;
  }[];
}): EditConflictPresentation {
  return {
    kind: 'edit_conflict',
    title: 'Souběžná úprava — zkontrolujte',
    leftAuthorLabel: input.leftAuthorLabel,
    rightAuthorLabel: input.rightAuthorLabel,
    leftOccurredLabel: input.leftOccurredLabel,
    rightOccurredLabel: input.rightOccurredLabel,
    fields: input.fields.map((field) => ({
      ...field,
      changed: field.leftValue !== field.rightValue,
    })),
    choices: [
      { id: 'choose_left', label: 'Použít variantu A' },
      { id: 'choose_right', label: 'Použít variantu B' },
      { id: 'manual', label: 'Upravit ručně' },
    ],
    preselectedChoiceId: null,
  };
}

export function buildDualSleepPresentation(input: {
  readonly left: DualSleepMeasurement;
  readonly right: DualSleepMeasurement;
}): DualSleepPresentation {
  return {
    kind: 'dual_sleep',
    title: 'Dvě měření spánku — zkontrolujte',
    left: input.left,
    right: input.right,
    choices: [
      { id: 'merge', label: 'Sloučit do jednoho intervalu' },
      { id: 'keep_both', label: 'Ponechat obě opravená měření' },
      { id: 'end_left', label: 'Ukončit / opravit měření A' },
      { id: 'end_right', label: 'Ukončit / opravit měření B' },
    ],
    preselectedChoiceId: null,
    claimsChildWoke: false,
  };
}

export function previewMergedSleepInterval(input: {
  readonly left: Pick<DualSleepMeasurement, 'entityId' | 'startMs' | 'endMs'>;
  readonly right: Pick<DualSleepMeasurement, 'entityId' | 'startMs' | 'endMs'>;
  readonly nowMs: number;
}): MergeSleepPreview | { readonly ok: false; readonly reason: 'incomplete_interval' } {
  const leftEnd = input.left.endMs ?? input.nowMs;
  const rightEnd = input.right.endMs ?? input.nowMs;
  if (!Number.isFinite(leftEnd) || !Number.isFinite(rightEnd)) {
    return { ok: false, reason: 'incomplete_interval' };
  }
  const startMs = Math.min(input.left.startMs, input.right.startMs);
  const endMs = Math.max(leftEnd, rightEnd);
  return {
    startMs,
    endMs,
    durationMs: Math.max(0, endMs - startMs),
    sourceEntityIds: [input.left.entityId, input.right.entityId],
  };
}

/**
 * Unresolved concurrent known sleeps contribute their union once — never twice
 * for the overlapping portion.
 */
export function unresolvedSleepUnionMs(
  intervals: readonly { readonly startMs: number; readonly endMs: number }[],
): number {
  if (intervals.length === 0) return 0;
  const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs);
  let total = 0;
  let curStart = sorted[0]!.startMs;
  let curEnd = sorted[0]!.endMs;
  for (let i = 1; i < sorted.length; i += 1) {
    const next = sorted[i]!;
    if (next.startMs <= curEnd) {
      curEnd = Math.max(curEnd, next.endMs);
      continue;
    }
    total += Math.max(0, curEnd - curStart);
    curStart = next.startMs;
    curEnd = next.endMs;
  }
  total += Math.max(0, curEnd - curStart);
  return total;
}

export function buildDeleteVsEditPresentation(input: {
  readonly deletedSummary: string;
  readonly editSummary: string;
  readonly restoreAvailableUntilLabel: string | null;
}): DeleteVsEditPresentation {
  return {
    kind: 'delete_vs_edit',
    title: 'Smazání a souběžná úprava',
    deletedSummary: input.deletedSummary,
    editSummary: input.editSummary,
    restoreAvailableUntilLabel: input.restoreAvailableUntilLabel,
    openingVariantUndoesDelete: false,
    choices: [
      { id: 'keep_deleted', label: 'Nechat smazané' },
      { id: 'restore_then_edit', label: 'Obnovit a použít úpravu' },
    ],
    preselectedChoiceId: null,
  };
}
