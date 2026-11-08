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
};

/**
 * Descriptive Czech copy for recorded care only — never diagnoses or claims of
 * complete intake/sleep for the child.
 */
export function presentCareOverview(
  overview: DailyCareOverview | WeeklyCareOverview,
): CareOverviewPresentation {
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
  };
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
