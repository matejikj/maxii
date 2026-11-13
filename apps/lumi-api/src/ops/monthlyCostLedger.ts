/**
 * Working cost ledger for the ADR 0005 single-VPS profile. Numbers here are
 * planning defaults — live invoices still belong to the operator.
 */

export type MonthlyCostLedgerLine = {
  readonly id: string;
  readonly label: string;
  readonly amountEurMonthly: number;
  readonly afterPromo: boolean;
};

export type MonthlyCostLedger = {
  readonly schemaVersion: 1;
  readonly currency: 'EUR';
  readonly hostCandidate: 'Hetzner CX23';
  readonly lines: readonly MonthlyCostLedgerLine[];
  readonly notes: readonly string[];
};

export const DEFAULT_MONTHLY_COST_LEDGER: MonthlyCostLedger = {
  schemaVersion: 1,
  currency: 'EUR',
  hostCandidate: 'Hetzner CX23',
  lines: [
    {
      id: 'vps',
      label: 'Hetzner CX23 (after remaining software; not ordered yet)',
      amountEurMonthly: 5.99,
      afterPromo: true,
    },
    {
      id: 'r2_baseline',
      label: 'Cloudflare R2 EU baseline (estimate; measure after enablement)',
      amountEurMonthly: 0,
      afterPromo: true,
    },
    {
      id: 'email',
      label: 'Transactional email (estimate)',
      amountEurMonthly: 0,
      afterPromo: true,
    },
  ],
  notes: [
    'Do not quote introductory discounts as steady-state cost.',
    'Ordering CX23 waits until remaining implementation tasks finish.',
    'R2 and email lines stay zero until live usage is measured.',
  ],
};

export function summarizeMonthlyCostLedger(
  ledger: MonthlyCostLedger = DEFAULT_MONTHLY_COST_LEDGER,
): {
  readonly totalEurMonthly: number;
  readonly lineCount: number;
  readonly hostCandidate: string;
  readonly readyToOrderHost: false;
} {
  const totalEurMonthly = ledger.lines.reduce((sum, line) => sum + line.amountEurMonthly, 0);
  return {
    totalEurMonthly: Math.round(totalEurMonthly * 100) / 100,
    lineCount: ledger.lines.length,
    hostCandidate: ledger.hostCandidate,
    readyToOrderHost: false,
  };
}
