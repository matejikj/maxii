import type {
  BottleDaySummary,
  DailyCareOverview,
  DiaperDaySummary,
  FoodDaySummary,
  NursingDaySummary,
  RunningCareIndicator,
  SleepDaySummary,
  WeeklyCareOverview,
} from '../../domain';

export type CareOverviewPresentation = {
  periodTitle: string;
  zoneNote: string;
  sleep: string;
  nursing: string;
  bottles: string;
  food: string;
  diapers: string;
  growth: string;
  running: string[];
  metrics: CareOverviewMetric[];
};

export type CareOverviewMetric = {
  id: 'sleep' | 'nursing' | 'bottle' | 'food' | 'diaper' | 'growth';
  title: string;
  value: string;
  detail: string;
  /** Full descriptive copy is retained for assistive technology. */
  description: string;
  hasRecords: boolean;
};

/**
 * Descriptive Czech copy for recorded care only — never diagnoses or claims of
 * complete intake/sleep for the child.
 */
export function presentCareOverview(
  overview: DailyCareOverview | WeeklyCareOverview,
): CareOverviewPresentation {
  const sleep = overview.sleep.stats;
  const nursing = overview.nursing.stats;
  const bottle = overview.bottles.stats;
  const food = overview.food.stats;
  const diapers = overview.diapers.stats;
  const growth = overview.growth.series.points.length;
  return {
    periodTitle: overview.meta.periodLabel,
    zoneNote: `Souhrnné pásmo: ${overview.meta.summaryTimeZone}`,
    sleep: presentSleep(overview.sleep.stats, overview.running),
    nursing: presentNursing(overview.nursing.stats),
    bottles: presentBottles(overview.bottles.stats),
    food: presentFood(overview.food.stats),
    diapers: presentDiapers(overview.diapers.stats),
    growth: presentGrowth(overview.growth.series.points.length, overview.growth.series.singlePoint),
    running: overview.running.map(presentRunning),
    metrics: [
      {
        id: 'sleep', title: 'Spánek',
        value: durationValue(sleep.eventsWithKnownDuration, sleep.eventsMissingDuration, sleep.recordedIntervalMs),
        detail: durationDetail(sleep.eventsWithKnownDuration, sleep.eventsMissingDuration, 'Zapsané intervaly'),
        description: presentSleep(sleep, overview.running),
        hasRecords: sleep.eventsWithKnownDuration + sleep.eventsMissingDuration > 0,
      },
      {
        id: 'nursing', title: 'Kojení',
        value: durationValue(nursing.eventsWithKnownDuration, nursing.eventsMissingDuration, nursing.recordedActiveMs),
        detail: durationDetail(nursing.eventsWithKnownDuration, nursing.eventsMissingDuration, 'Aktivní kojení ze zápisů'),
        description: presentNursing(nursing),
        hasRecords: nursing.eventsWithKnownDuration + nursing.eventsMissingDuration > 0,
      },
      {
        id: 'bottle', title: 'Lahvička',
        value: bottle.feedingsWithAmount > 0 ? formatMl(bottle.recordedMl)
          : bottle.feedingsMissingAmount > 0 ? 'Bez množství' : '—',
        detail: bottle.feedingsMissingAmount > 0 ? `${bottle.feedingsMissingAmount}× bez množství`
          : bottle.feedingsWithAmount > 0 ? 'Zapsané množství' : 'Zatím bez záznamu',
        description: presentBottles(bottle),
        hasRecords: bottle.feedingsWithAmount + bottle.feedingsMissingAmount > 0,
      },
      {
        id: 'food', title: 'Jídlo',
        value: food.events > 0 ? `${food.events} ${plural(food.events, 'jídlo', 'jídla', 'jídel')}` : '—',
        detail: food.eventsMissingAmount > 0 ? `${food.eventsMissingAmount}× bez množství`
          : food.events > 0 ? 'Zaznamenáno v deníku' : 'Zatím bez záznamu',
        description: presentFood(food), hasRecords: food.events > 0,
      },
      {
        id: 'diaper', title: 'Plenky',
        value: diapers.diapers > 0 ? `${diapers.diapers} ${plural(diapers.diapers, 'plenka', 'plenky', 'plenek')}` : '—',
        detail: diapers.diapers > 0 ? `Mokré ${diapers.wet} · stolice ${diapers.dirty}` : 'Zatím bez záznamu',
        description: presentDiapers(diapers), hasRecords: diapers.diapers > 0,
      },
      {
        id: 'growth', title: 'Růst', value: growth > 0 ? `${growth} měření` : '—',
        detail: growth === 1 ? 'Jedno měření, ještě ne trend'
          : growth > 0 ? 'Vlastní měření v období' : 'Zatím bez záznamu',
        description: presentGrowth(growth, overview.growth.series.singlePoint), hasRecords: growth > 0,
      },
    ],
  };
}

function durationValue(known: number, missing: number, ms: number): string {
  return known > 0 ? formatDuration(ms) : missing > 0 ? 'Bez délky' : '—';
}

function durationDetail(known: number, missing: number, label: string): string {
  if (missing > 0) return `${known > 0 ? `${label} · ` : ''}${missing}× bez délky`;
  return known > 0 ? label : 'Zatím bez záznamu';
}

function presentSleep(stats: SleepDaySummary, running: readonly RunningCareIndicator[]): string {
  const parts = [
    `Zapsané intervaly spánku ${formatDuration(stats.recordedIntervalMs)}`,
  ];
  if (stats.eventsMissingDuration > 0) {
    parts.push(
      `další ${stats.eventsMissingDuration} ${plural(stats.eventsMissingDuration, 'záznam', 'záznamy', 'záznamů')} bez délky`,
    );
  }
  if (running.some((row) => row.kind === 'sleep')) {
    parts.push('probíhající spánek je zatím jen průběžný');
  }
  if (stats.eventsWithKnownDuration === 0 && stats.eventsMissingDuration === 0) {
    return 'Spánek zatím není zaznamenán.';
  }
  return `${parts.join('; ')}.`;
}

function presentNursing(stats: NursingDaySummary): string {
  if (stats.eventsWithKnownDuration === 0 && stats.eventsMissingDuration === 0) {
    return 'Kojení zatím není zaznamenáno.';
  }
  const parts = [`Zaznamenané aktivní kojení ${formatDuration(stats.recordedActiveMs)}`];
  if (stats.eventsMissingDuration > 0) {
    parts.push(
      `u ${stats.eventsMissingDuration} ${plural(stats.eventsMissingDuration, 'záznamu', 'záznamů', 'záznamů')} délka chybí`,
    );
  }
  return `${parts.join('; ')}.`;
}

function presentBottles(stats: BottleDaySummary): string {
  if (stats.feedingsWithAmount === 0 && stats.feedingsMissingAmount === 0) {
    return 'Lahvičky zatím nejsou zaznamenané.';
  }
  const parts = [`Zaznamenáno ${formatMl(stats.recordedMl)}`];
  if (stats.feedingsMissingAmount > 0) {
    parts.push(
      `u ${stats.feedingsMissingAmount} ${plural(stats.feedingsMissingAmount, 'krmení', 'krmení', 'krmení')} množství chybí`,
    );
  }
  return `${parts.join('; ')}.`;
}

function presentFood(stats: FoodDaySummary): string {
  if (stats.events === 0) return 'Jídlo zatím není zaznamenané.';
  const parts = [`Zaznamenáno ${stats.events} ${plural(stats.events, 'jídlo', 'jídla', 'jídel')}`];
  if (stats.eventsMissingAmount > 0) {
    parts.push(
      `u ${stats.eventsMissingAmount} ${plural(stats.eventsMissingAmount, 'záznamu', 'záznamů', 'záznamů')} množství chybí`,
    );
  }
  return `${parts.join('; ')}.`;
}

function presentDiapers(stats: DiaperDaySummary): string {
  if (stats.diapers === 0) return 'Plenky zatím nejsou zaznamenané.';
  return `Zaznamenáno ${stats.diapers} ${plural(stats.diapers, 'plenka', 'plenky', 'plenek')} (mokré ${stats.wet}, stolice ${stats.dirty}).`;
}

function presentGrowth(count: number, singlePoint: boolean): string {
  if (count === 0) return 'Růst zatím není zaznamenán.';
  if (singlePoint) {
    return 'Zaznamenáno jedno měření. To ještě není trend; chybějící hodnoty nedoplňujeme.';
  }
  return `Zaznamenáno ${count} ${plural(count, 'měření', 'měření', 'měření')} bez klinických norem.`;
}

function presentRunning(row: RunningCareIndicator): string {
  const label = row.kind === 'sleep' ? 'Spánek' : 'Kojení';
  return `${label} stále běží — zatím ${formatDuration(row.recordedSoFarMs)} v tomto období (průběžné).`;
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function formatMl(value: number): string {
  if (Number.isInteger(value)) return `${value} ml`;
  return `${value.toFixed(1)} ml`;
}

function plural(count: number, one: string, few: string, many: string): string {
  if (count === 1) return one;
  if (count >= 2 && count <= 4) return few;
  return many;
}
