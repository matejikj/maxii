import type { TimelineCursor, UnitOfWorkFactory } from '../domain';
import { sanitizeLogFields } from '../infrastructure/telemetry/logger';

export type DiagnosticsSnapshot = {
  exportedAtMs: number;
  platform: string;
  appVersion: string;
  schemaCompatibility: number | null;
  careEventCount: number;
  draftCount: number;
  deletionCount: number;
  checkpointCount: number;
  characterMotionEnabled: boolean | null;
  guideSpecies: string | null;
  remindersEnabled: boolean | null;
  appLockEnabled: boolean | null;
  /** Technical codes only — never child names, notes, or DOB. */
  notes: string[];
};

/**
 * Caregiver-facing diagnostics for support. Uses the logger allowlist so a
 * pasted report cannot smuggle care payloads.
 */
export async function buildDiagnosticsSnapshot(input: {
  unitOfWork: UnitOfWorkFactory;
  checkpointCount: number;
  appLockEnabled: boolean;
  nowMs: number;
  appVersion?: string;
  /** Injected so Node contract tests never load react-native. */
  platform?: string;
}): Promise<DiagnosticsSnapshot> {
  const stats = await input.unitOfWork.run(async (uow) => {
    const profiles = await uow.profiles.list();
    let careEventCount = 0;
    for (const profile of profiles) {
      let before: TimelineCursor | null = null;
      for (;;) {
        const page = await uow.care.listPage(profile.childId, 200, before);
        careEventCount += page.events.length;
        if (!page.nextCursor) break;
        before = page.nextCursor;
      }
    }
    const drafts = await uow.drafts.listAll();
    const deletions = await uow.revisions.listDeletions();
    const motion = await uow.meta.get('pref_character_motion_v1');
    const guide = await uow.meta.get('pref_guide_species_v1');
    const remindersRaw = await uow.meta.get('pref_reminders_v1');
    let remindersEnabled: boolean | null = null;
    if (remindersRaw) {
      try {
        const parsed = JSON.parse(remindersRaw) as {
          dailyTogetherEnabled?: boolean;
          weeklyGlanceEnabled?: boolean;
        };
        remindersEnabled = Boolean(parsed.dailyTogetherEnabled || parsed.weeklyGlanceEnabled);
      } catch {
        remindersEnabled = null;
      }
    }
    return {
      careEventCount,
      draftCount: drafts.length,
      deletionCount: deletions.length,
      motion: motion == null ? null : motion === '1',
      guide,
      remindersEnabled,
      schemaCompatibility: 4 as number | null,
    };
  });

  const snapshot: DiagnosticsSnapshot = {
    exportedAtMs: input.nowMs,
    platform: input.platform ?? 'unknown',
    appVersion: input.appVersion ?? '0.1.0',
    schemaCompatibility: stats.schemaCompatibility,
    careEventCount: stats.careEventCount,
    draftCount: stats.draftCount,
    deletionCount: stats.deletionCount,
    checkpointCount: input.checkpointCount,
    characterMotionEnabled: stats.motion,
    guideSpecies: stats.guide,
    remindersEnabled: stats.remindersEnabled,
    appLockEnabled: input.appLockEnabled,
    notes: [
      'Contains technical counts and preference flags only.',
      'Location, microphone and contacts are not required for core care.',
    ],
  };

  // Prove redaction path: accidental sensitive keys would be stripped.
  const probe = sanitizeLogFields({
    code: 'diagnostics',
    ok: true,
    noteBody: 'SHOULD_NOT_APPEAR',
    birthDate: '2099-01-01',
  });
  if (probe.noteBody !== '[redacted]' || probe.birthDate !== '[redacted]') {
    snapshot.notes.push('redaction_probe_failed');
  }

  return snapshot;
}

export function serializeDiagnosticsSnapshot(snapshot: DiagnosticsSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}
