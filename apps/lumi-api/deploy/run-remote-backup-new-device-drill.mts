import { randomUUID } from 'node:crypto';
import { runRemoteBackupNewDeviceDrill } from '../src/backup/remoteBackupNewDeviceDrill.ts';

const report = await runRemoteBackupNewDeviceDrill({
  familyId: randomUUID(),
  foreignFamilyId: randomUUID(),
  diaryCanary: 'DIARY-BACKUP-CANARY-DRILL',
});

console.log(
  JSON.stringify(
    {
      format: report.format,
      allSoftwareChecksPassed: report.allSoftwareChecksPassed,
      liveHostRestoreClaimed: report.liveHostRestoreClaimed,
      measuredRpoRtoClaimed: report.measuredRpoRtoClaimed,
      findings: report.findings,
    },
    null,
    2,
  ),
);

if (report.liveHostRestoreClaimed || report.measuredRpoRtoClaimed) {
  console.error('remote-backup-new-device-drill: refused live-host measurement claim');
  process.exit(2);
}
if (!report.allSoftwareChecksPassed) {
  console.error('remote-backup-new-device-drill: checks FAILED');
  process.exit(1);
}
console.error(
  'remote-backup-new-device-drill: PASS (software only; live host RPO/RTO not claimed)',
);
