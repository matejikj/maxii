/**
 * Independent uptime probe contract. A probe that only runs on the same VPS
 * cannot detect total host loss — readiness keeps liveReady false until a real
 * off-host channel is assigned and configured.
 */

export type OffHostProbeConfig = {
  readonly configured: boolean;
  readonly targetUrl: string | null;
  readonly mustNotRunOnlyOnSameVps: boolean;
};

export type OffHostProbeEvaluation = {
  readonly okForLiveGate: boolean;
  readonly blockers: readonly string[];
  readonly notes: readonly string[];
};

export function loadOffHostProbeConfig(env: NodeJS.ProcessEnv = process.env): OffHostProbeConfig {
  const targetUrl = env.LUMI_OFF_HOST_PROBE_URL?.trim() || null;
  return {
    configured: env.LUMI_OFF_HOST_PROBE_CONFIGURED === '1' && targetUrl != null,
    targetUrl,
    mustNotRunOnlyOnSameVps: true,
  };
}

export function evaluateOffHostProbeConfig(
  config: OffHostProbeConfig,
): OffHostProbeEvaluation {
  const blockers: string[] = [];
  const notes: string[] = [];
  if (!config.mustNotRunOnlyOnSameVps) {
    blockers.push('probe_must_not_share_failing_vps');
  }
  if (!config.configured) {
    blockers.push('off_host_uptime_probe_not_configured');
    notes.push('Set LUMI_OFF_HOST_PROBE_CONFIGURED=1 and LUMI_OFF_HOST_PROBE_URL outside the VPS.');
  } else if (!config.targetUrl || !/^https:\/\//i.test(config.targetUrl)) {
    blockers.push('off_host_probe_url_must_be_https');
  } else {
    notes.push('Probe URL present — still requires a provider that survives VPS loss.');
  }
  return {
    okForLiveGate: blockers.length === 0,
    blockers,
    notes,
  };
}

/** Optional live HEAD — never invents success when the probe is unset. */
export async function probeOffHostTarget(
  config: OffHostProbeConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<{ reachable: boolean; status: number | null; detail: string }> {
  if (!config.configured || !config.targetUrl) {
    return {
      reachable: false,
      status: null,
      detail: 'off-host probe not configured',
    };
  }
  try {
    const response = await fetchImpl(config.targetUrl, { method: 'HEAD' });
    return {
      reachable: response.ok,
      status: response.status,
      detail: response.ok
        ? `probe HTTP ${response.status}`
        : `probe HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      reachable: false,
      status: null,
      detail: error instanceof Error ? error.message : 'probe request failed',
    };
  }
}
