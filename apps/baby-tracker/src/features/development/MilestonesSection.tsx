import React, { useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { LumiButton, LumiCard, LumiChip, LumiIcon, LumiInput, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import type { ChildId, MilestoneCareEvent, RecordMilestoneCommand, TimeZoneId } from '../../domain';
import { MILESTONE_AGE_EXPLANATION, MILESTONE_CATALOG, MILESTONE_CATEGORIES, MILESTONE_SUPPORT_NOTE,
  type MilestoneCategory, type MilestoneDefinition } from '../../content/milestones';
import { useCompositionRoot } from '../../app/providers';
import { usePersonalRuntime } from '../../app/session/BootstrapContext';
import { CareActionSheet, DateTimeField } from '../ui';
import { buildRecordMilestoneCommand, mintMomentIds } from '../today/recordMomentIntent';
import { formatWallDateTime, parseWallDateTime } from '../today/recordDiaperIntent';
import { DevelopmentEmpty, DevelopmentHeading } from './DevelopmentVisuals';
import { MilestoneAtlasCard, MilestoneEmblem, MilestoneHero, MilestoneMemoryCard } from './MilestoneVisuals';
import { memoriesForMilestone, memoryCountLabel, milestoneCountLabel, milestoneMemoryDate, selectMilestones, type MilestonePeriod } from './milestonePresentation';
import { useMilestoneMemories } from './useMilestoneMemories';

type Editor = { item: MilestoneDefinition | null; event: MilestoneCareEvent | null };
const PERIODS: readonly { id: MilestonePeriod; label: string }[] = [
  { id: 'all', label: 'Všechna období' }, { id: 'first-year', label: 'První rok' },
  { id: 'second-year', label: '1–2 roky' }, { id: 'preschool', label: '2–5 let' },
];

export function MilestonesSection({ childId, zone, active, onOpenEvent }: {
  childId: ChildId; zone: TimeZoneId; active: boolean; onOpenEvent?: (eventId: string) => void;
}) {
  const { colors } = useLumiTheme();
  const { services } = useCompositionRoot();
  const runtime = usePersonalRuntime();
  const model = useMilestoneMemories(childId, active);
  const [shelf, setShelf] = useState<'atlas' | 'memories'>('atlas');
  const [category, setCategory] = useState<MilestoneCategory | null>(null);
  const [period, setPeriod] = useState<MilestonePeriod>('all');
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [limit, setLimit] = useState(12);
  const [selected, setSelected] = useState<MilestoneDefinition | null>(null);
  const [memory, setMemory] = useState<MilestoneCareEvent | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [body, setBody] = useState('');
  const [note, setNote] = useState('');
  const [wallTime, setWallTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const inFlight = useRef(false);
  const attempt = useRef<{ signature: string; command: RecordMilestoneCommand & { expectedRevisionId?: MilestoneCareEvent['revisionId'] } } | null>(null);
  const results = useMemo(() => selectMilestones(MILESTONE_CATALOG, { query, category, period }), [query, category, period]);
  const selectedMemories = selected ? memoriesForMilestone(model.events, selected.id) : [];
  const filterCount = Number(category !== null) + Number(period !== 'all');
  const byKey = useMemo(() => new Map(MILESTONE_CATALOG.map((item) => [item.id, item])), []);
  const sheetOpen = selected !== null || memory !== null || editor !== null;
  function closeSheet() {
    if (inFlight.current) return;
    setSelected(null); setMemory(null); setEditor(null); setError(null);
  }
  function openEditor(item: MilestoneDefinition | null, event: MilestoneCareEvent | null = null) {
    setEditor({ item, event }); setBody(event?.body ?? item?.title ?? ''); setNote(event?.note ?? '');
    setWallTime(formatWallDateTime(event?.occurredAt.instant.epochMs ?? services.clock.now().epochMs, zone));
    setError(null); attempt.current = null;
  }
  async function saveMemory() {
    if (!editor || inFlight.current) return;
    if (!body.trim()) { setError('Pojmenujte svůj malý velký okamžik.'); return; }
    const parsed = parseWallDateTime(wallTime, zone);
    if (!parsed.ok) { setError(parsed.message); return; }
    const nowMs = services.clock.now().epochMs;
    if (parsed.occurredAt.instant.epochMs > nowMs + 60_000) { setError('Vzpomínku můžete zapsat až poté, co se stala. Zkontrolujte datum a čas.'); return; }
    const signature = JSON.stringify([body.trim(), note.trim(), wallTime, editor.item?.id, editor.event?.eventId]);
    if (attempt.current?.signature !== signature) {
      const ids = mintMomentIds(services.ids);
      if (editor.event) ids.eventId = editor.event.eventId;
      const milestoneKey = editor.event?.milestoneKey ?? editor.item?.id;
      attempt.current = { signature, command: buildRecordMilestoneCommand({ ids, childId,
        occurredAt: parsed.occurredAt, body: body.trim(), note: note.trim() || null, intentCapturedAtMs: nowMs,
        ...(milestoneKey ? { milestoneKey } : {}),
        ...(editor.event ? { expectedRevisionId: editor.event.revisionId } : {}),
      }) };
    }
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const result = await runtime.commands.dispatch(attempt.current.command);
      if (!result.ok) { setError('Vzpomínku se nepodařilo uložit. Text zůstává vyplněný; zkuste uložení znovu.'); return; }
      setSelected(null); setMemory(null); setEditor(null); setShelf('memories'); setLimit(12);
      setSaved(editor.event ? 'Vzpomínka je upravená a uložená v deníku.' : 'Malý velký okamžik má své místo ve vašem deníku.');
      attempt.current = null;
      await model.reload();
    } catch { setError('Uložení se nepodařilo dokončit. Zkuste to znovu se stejnými údaji.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function openSource(item: MilestoneDefinition) {
    try { await Linking.openURL(item.source.url); }
    catch { setError('Zdroj se nepodařilo otevřít. Zkuste to po připojení k internetu.'); }
  }
  return <View style={styles.root} testID="development-milestones">
    <MilestoneHero />
    <LumiButton title="Přidat vlastní milník" fullWidth variant="secondary" testID="milestones-add-custom"
      leftAdornment={<LumiIcon name="plus" color={colors.onSecondary} size={19} />}
      onPress={() => openEditor(null)} />
    <View style={styles.row}>
      <LumiChip label="Atlas milníků" selected={shelf === 'atlas'} testID="milestones-show-atlas"
        onPress={() => { setShelf('atlas'); setLimit(12); }} />
      <LumiChip label="Naše vzpomínky" selected={shelf === 'memories'} testID="milestones-show-memories"
        onPress={() => { setShelf('memories'); setLimit(12); }} />
    </View>
    {saved ? <LumiText variant="caption" tone="muted" accessibilityLiveRegion="polite" testID="milestones-saved">{saved}</LumiText> : null}
    {model.error ? <LumiCard style={styles.root}><LumiText tone="danger" accessibilityRole="alert">{model.error}</LumiText>
      <LumiButton title="Zkusit znovu" variant="secondary" onPress={() => void model.reload()} /></LumiCard> : null}
    {shelf === 'atlas' ? <>
      <DevelopmentHeading title="Objevujte vlastním tempem" subtitle="52 drobných i velkých objevů od miminka po předškoláka." icon="growth" />
      <LumiInput label="Hledat milník" placeholder="Třeba první slůvka nebo krůčky…" value={query}
        testID="milestones-search" autoCorrect={false} onChangeText={(value) => { setQuery(value); setLimit(12); }} />
      <View style={styles.row}>
        <LumiButton title={`Filtry${filterCount ? ` (${filterCount})` : ''}`}
          variant="outline" testID="milestones-filters" accessibilityState={{ expanded: filtersOpen }}
          onPress={() => setFiltersOpen((value) => !value)} />
        {filterCount ? <LumiButton title="Zrušit filtry" variant="ghost" onPress={() => { setCategory(null); setPeriod('all'); setLimit(12); }} /> : null}
      </View>
      {filtersOpen ? <LumiCard style={styles.root}>
        <LumiText variant="bodyStrong">Co chcete objevovat?</LumiText>
        <View style={styles.row}>
          <LumiChip label="Všechny oblasti" selected={category === null} onPress={() => { setCategory(null); setLimit(12); }} />
          {MILESTONE_CATEGORIES.map((item) => <LumiChip key={item.id} label={item.label} selected={category === item.id}
            testID={`milestones-category-${item.id}`} onPress={() => { setCategory(item.id); setLimit(12); }} />)}
        </View>
        <View style={styles.row}>{PERIODS.map((item) => <LumiChip key={item.id} label={item.label} selected={period === item.id}
          testID={`milestones-period-${item.id}`} onPress={() => { setPeriod(item.id); setLimit(12); }} />)}</View>
        <LumiText variant="caption" tone="muted">Období filtruje atlas podle referenčního věku, ne podle hodnocení dítěte.</LumiText>
        <LumiButton title="Zobrazit milníky" variant="secondary" onPress={() => setFiltersOpen(false)} />
      </LumiCard> : filterCount ? <LumiText variant="caption" tone="muted">
        {[MILESTONE_CATEGORIES.find((item) => item.id === category)?.label,
          period !== 'all' ? PERIODS.find((item) => item.id === period)?.label : undefined].filter(Boolean).join(' · ')}
      </LumiText> : null}
      <LumiText variant="label" testID="milestones-result-count" accessibilityLiveRegion="polite">{milestoneCountLabel(results.length)} k prohlédnutí</LumiText>
      {results.slice(0, limit).map((item) => <MilestoneAtlasCard key={item.id} item={item}
        memory={model.events.find((event) => event.milestoneKey === item.id)}
        onPress={() => { setSelected(item); setError(null); }} />)}
      {results.length === 0 ? <DevelopmentEmpty title="Zkusíme jinou cestu?" description="Upravte hledání nebo zobrazte všechny oblasti a období.">
        <LumiButton title="Zobrazit celý atlas" variant="secondary" onPress={() => { setQuery(''); setCategory(null); setPeriod('all'); setLimit(12); }} />
      </DevelopmentEmpty> : null}
      {results.length > limit ? <LumiButton title={`Další milníky (${results.length - limit})`} variant="outline" fullWidth
        testID="milestones-load-more" onPress={() => setLimit((value) => value + 12)} /> : null}
      <LumiCard variant="soft" style={styles.root}>
        <LumiText variant="bodyStrong">Jak číst orientační věk</LumiText>
        <LumiText variant="caption" tone="muted">{MILESTONE_AGE_EXPLANATION}</LumiText>
      </LumiCard>
    </> : <>
      <DevelopmentHeading title="Vaše kniha malých poprvé" subtitle="Vzpomínky patří jen právě vybranému dítěti." icon="care" />
      {model.loading ? <LumiText variant="caption" tone="muted" accessibilityLiveRegion="polite">Načítám vzpomínky…</LumiText> : null}
      {!model.loading && !model.error ? <LumiText variant="caption" tone="muted">{memoryCountLabel(model.events.length)} v deníku</LumiText> : null}
      {!model.loading && !model.error && model.events.length === 0 ? <DevelopmentEmpty title="První stránka čeká na váš příběh"
        description="Úsměv, nové slůvko nebo něco, čemu rozumíte jen vy. Vyberte milník v atlasu nebo si přidejte vlastní." icon="care">
        <LumiButton title="Prohlédnout atlas" variant="secondary" onPress={() => setShelf('atlas')} />
      </DevelopmentEmpty> : null}
      {model.events.slice(0, limit).map((event) => <MilestoneMemoryCard key={event.eventId} event={event} zone={zone}
        category={byKey.get(event.milestoneKey ?? '')?.category ?? 'connection'} onPress={() => { setMemory(event); setError(null); }} />)}
      {model.events.length > limit ? <LumiButton title="Starší vzpomínky" variant="outline" fullWidth onPress={() => setLimit((value) => value + 12)} /> : null}
    </>}

    <CareActionSheet visible={active && sheetOpen} onClose={closeSheet}
      title={editor ? editor.event ? 'Upravit vzpomínku' : editor.item ? 'Zapsat malý velký okamžik' : 'Váš vlastní milník'
        : memory ? 'Vzpomínka z vašeho deníku' : selected?.title ?? 'Milník'}
      footer={editor ? <LumiButton title="Uložit vzpomínku" fullWidth loading={busy} testID="milestones-save"
        onPress={() => void saveMemory()} /> : selected ? <LumiButton fullWidth
        title={selectedMemories.length ? 'Přidat další vzpomínku' : 'Zapsat tento okamžik'} testID="milestones-record"
        onPress={() => openEditor(selected)} /> : undefined}>
      {editor ? <>
        <LumiText variant="caption" tone="muted">Uložte si to po svém. Zápis se objeví také v Historii a ve vaší záloze deníku.</LumiText>
        <LumiInput label="Název milníku" value={body} onChangeText={setBody} maxLength={120} editable={!busy}
          placeholder="Třeba první slůvko „ahoj“" testID="milestones-title" />
        <DateTimeField label="Kdy se to stalo (RRRR-MM-DD HH:MM)" value={wallTime} onChangeText={setWallTime} disabled={busy} />
        <LumiInput label="Příběh okamžiku (volitelně)" value={note} onChangeText={setNote} maxLength={2000} multiline
          editable={!busy} placeholder="Co zaznělo, kdo byl u toho, co vám udělalo radost…" testID="milestones-note" />
        {!editor.item ? <LumiText variant="caption" tone="muted">Váš vlastní milník nemá předepsaný věk. Patří k vašemu příběhu.</LumiText> : null}
      </> : memory ? <>
        <MilestoneEmblem category={byKey.get(memory.milestoneKey ?? '')?.category ?? 'connection'} size={76} />
        <LumiText variant="h2">{memory.body}</LumiText>
        <LumiText tone="muted">{milestoneMemoryDate(memory, zone)}</LumiText>
        {memory.note ? <LumiText>{memory.note}</LumiText> : null}
        <LumiButton title="Upravit vzpomínku" variant="secondary" testID="milestones-edit"
          onPress={() => openEditor(byKey.get(memory.milestoneKey ?? '') ?? null, memory)} />
        {onOpenEvent ? <LumiButton title="Otevřít záznam v historii" variant="ghost" onPress={() => {
          const id = memory.eventId; closeSheet(); onOpenEvent(id);
        }} /> : null}
      </> : selected ? <>
        <MilestoneEmblem category={selected.category} size={80} />
        <LumiText>{selected.description}</LumiText>
        <LumiCard variant="soft" style={styles.root}>
          <LumiText variant="bodyStrong">{selected.age.label}</LumiText>
          <LumiText variant="caption" tone="muted">{selected.age.explanation}</LumiText>
        </LumiCard>
        <DevelopmentHeading title={selected.id === 'first-tooth' ? 'Jak být nablízku' : 'Jak jemně podpořit objevování'} icon="care" />
        {selected.support.map((tip, index) => <View key={tip} style={styles.tip}>
          <LumiText variant="caption" tone="muted">{String(index + 1).padStart(2, '0')}</LumiText><LumiText style={{ flex: 1 }}>{tip}</LumiText>
        </View>)}
        {selectedMemories.length ? <View style={styles.root}>
          <LumiText variant="bodyStrong">Už má místo ve vašem příběhu</LumiText>
          {selectedMemories.map((event) => <LumiButton key={event.eventId} variant="outline"
            title={milestoneMemoryDate(event, zone)} onPress={() => { setSelected(null); setMemory(event); }} />)}
        </View> : null}
        <LumiText variant="caption" tone="muted">{MILESTONE_SUPPORT_NOTE}</LumiText>
        <LumiButton title={`Zdroj: ${selected.source.label}`} variant="ghost" onPress={() => void openSource(selected)} />
      </> : null}
      {error ? <LumiText tone="danger" accessibilityRole="alert">{error}</LumiText> : null}
    </CareActionSheet>
  </View>;
}
const styles = StyleSheet.create({
  root: { gap: 16 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tip: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
});
