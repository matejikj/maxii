import { sanitizeLogFields } from '../infrastructure/telemetry/logger';
import type { LocalOperationMetricsSnapshot } from '../ops/localOperationMetrics';
import type { ReleaseEvidenceManifest } from '../ops/releaseEvidence';
import type { DiagnosticsSnapshot } from './diagnosticsExport';

export const SUPPORT_REPORT_FORMAT = 'lumi.support-report.v1' as const;

/**
 * Manually exportable support bundle. Never attaches a diary backup; caregivers
 * choose export separately when they want to share recoverable data.
 */
export type SupportReport = {
  format: typeof SUPPORT_REPORT_FORMAT;
  exportedAtMs: number;
  release: ReleaseEvidenceManifest;
  diagnostics: DiagnosticsSnapshot;
  localOperations: LocalOperationMetricsSnapshot;
  privacy: {
    includesDiaryBackup: false;
    includesNotesOrDob: false;
    note: string;
  };
};

export function buildSupportReport(input: {
  nowMs: number;
  release: ReleaseEvidenceManifest;
  diagnostics: DiagnosticsSnapshot;
  localOperations: LocalOperationMetricsSnapshot;
}): SupportReport {
  // Second redaction pass: reject accidental private keys if a caller merges junk.
  const probe = sanitizeLogFields({
    code: 'support_report',
    ok: true,
    noteBody: 'CANARY_NOTE',
    birthDate: '2099-01-01',
  });
  const redactionOk = probe.noteBody === '[redacted]' && probe.birthDate === '[redacted]';

  return {
    format: SUPPORT_REPORT_FORMAT,
    exportedAtMs: input.nowMs,
    release: input.release,
    diagnostics: input.diagnostics,
    localOperations: input.localOperations,
    privacy: {
      includesDiaryBackup: false,
      includesNotesOrDob: false,
      note: redactionOk
        ? 'Technical versions, counts and allowlisted operation codes only. Attach a backup only if you choose to export one separately.'
        : 'redaction_probe_failed',
    },
  };
}

export function serializeSupportReport(report: SupportReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
