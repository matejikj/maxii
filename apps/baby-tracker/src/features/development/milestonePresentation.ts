import type { MilestoneCategory, MilestoneDefinition } from '../../content/milestones';
import type { MilestoneCareEvent, TimeZoneId } from '../../domain';

export type MilestonePeriod = 'all' | 'first-year' | 'second-year' | 'preschool';
const searchText = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('cs-CZ');
export function selectMilestones(catalog: readonly MilestoneDefinition[], input: {
  query: string; category: MilestoneCategory | null; period: MilestonePeriod;
}): MilestoneDefinition[] {
  const words = searchText(input.query.trim()).split(/\s+/).filter(Boolean);
  return catalog.filter((item) => (!input.category || input.category === item.category)
    && (input.period === 'all' || (input.period === 'first-year' ? item.referenceMonths <= 12
      : input.period === 'second-year' ? item.referenceMonths > 12 && item.referenceMonths <= 24 : item.referenceMonths > 24))
    && words.every((word) => searchText(`${item.title} ${item.description}`).includes(word)));
}
/** Only explicit stable references count. A parent can describe a first word
 * without the app guessing a diagnosis or attaching an unrelated catalog item. */
export function memoriesForMilestone(events: readonly MilestoneCareEvent[], key: string): MilestoneCareEvent[] {
  return events.filter((event) => event.milestoneKey === key);
}
export function milestoneMemoryDate(event: MilestoneCareEvent, zone: TimeZoneId): string {
  return new Intl.DateTimeFormat('cs-CZ', { timeZone: zone, day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(event.occurredAt.instant.epochMs));
}
export function memoryCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'vzpomínka' : count >= 2 && count <= 4 ? 'vzpomínky' : 'vzpomínek'}`;
}
export function milestoneCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'milník' : count >= 2 && count <= 4 ? 'milníky' : 'milníků'}`;
}
