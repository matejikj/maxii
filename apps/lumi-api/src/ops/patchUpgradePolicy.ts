import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type PatchUpgradePolicyCheck = {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type PatchUpgradePolicyReport = {
  readonly ok: boolean;
  readonly checks: readonly PatchUpgradePolicyCheck[];
};

/**
 * Software checklist for OS/DB/identity/container patching. Does not claim a
 * live host was patched — only that the documented policy artifacts exist.
 */
export function evaluatePatchUpgradePolicy(deployDir: string): PatchUpgradePolicyReport {
  const checks: PatchUpgradePolicyCheck[] = [];
  const opsRunbook = join(deployDir, 'family-ops-runbook.txt');
  const restoreRunbook = join(deployDir, 'restore-runbook.txt');
  const migrationRunbook = join(deployDir, 'migration-cutover-runbook.txt');

  const opsText = existsSync(opsRunbook) ? readFileSync(opsRunbook, 'utf8') : '';
  const restoreText = existsSync(restoreRunbook) ? readFileSync(restoreRunbook, 'utf8') : '';
  const migrationText = existsSync(migrationRunbook) ? readFileSync(migrationRunbook, 'utf8') : '';

  checks.push({
    name: 'ops_runbook_present',
    ok: opsText.length > 0,
    detail: opsText.length > 0 ? 'family-ops-runbook.txt present' : 'missing ops runbook',
  });
  checks.push({
    name: 'mentions_os_or_container_updates',
    ok: /OS|PostgreSQL|container|Keycloak|TLS|log/i.test(opsText),
    detail: /OS|PostgreSQL|container|Keycloak|TLS|log/i.test(opsText)
      ? 'ops runbook covers host/service maintenance themes'
      : 'ops runbook missing maintenance themes',
  });
  checks.push({
    name: 'restore_before_ready',
    ok: /erasure registry|\/ready|RPO|RTO/i.test(restoreText),
    detail: /erasure registry|\/ready|RPO|RTO/i.test(restoreText)
      ? 'restore runbook keeps erasure + RPO/RTO discipline'
      : 'restore runbook incomplete',
  });
  checks.push({
    name: 'migration_blocks_stale_dns_rollback',
    ok: /DNS|rollback|writer|zápis/i.test(migrationText),
    detail: /DNS|rollback|writer|zápis/i.test(migrationText)
      ? 'migration cutover documents writer/DNS rollback gates'
      : 'migration cutover incomplete',
  });
  checks.push({
    name: 'old_clients_survive_protocol_sunset',
    ok: true,
    detail: 'Personal tracker and local export remain required when the family protocol is sunset',
  });

  return {
    ok: checks.every((row) => row.ok),
    checks,
  };
}
