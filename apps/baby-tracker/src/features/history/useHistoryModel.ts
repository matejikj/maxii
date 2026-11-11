import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  asOperationId, asRevisionId, asTimeZoneId, endOfCalendarDayExclusive, formatCalendarDate,
  parseCalendarDate, startOfCalendarDay, todayInZone,
  type CareEvent, type DeletionMarker, type Draft, type TimelineCursor,
} from '../../domain';
import {
  careEventFromTrashMarker, loadDraftsForChild, loadHistoryDay, loadHistoryPage,
  loadRestorableTrash, rebuildSearchIndex,
} from '../../application';
import type { HistoryTabState } from '../../app/navigation/historyTabState';
import { useBootstrap, usePersonalRuntime } from '../../app/session/BootstrapContext';
import { useCompositionRoot } from '../../app/providers';
import { appendHistoryPage } from './historyPresentation';

const PAGE_SIZE = 40;
type TimelineSnapshot = { key: string; events: CareEvent[]; nextCursor: TimelineCursor | null };
type AuxSnapshot = { childId: string | null; drafts: Draft[]; trash: DeletionMarker[] };

/** Query generations prevent a slow old search/page from replacing a newer child's day. */
export function useHistoryModel(state: HistoryTabState) {
  const { profile } = useBootstrap();
  const runtime = usePersonalRuntime();
  const { services } = useCompositionRoot();
  const zone = asTimeZoneId(profile?.settings.summaryTimeZone ?? 'Europe/Prague');
  const childId = profile?.childId ?? null;
  const todayIso = formatCalendarDate(todayInZone(services.clock.now(), zone));
  const [searchQuery, setSearchQuery] = useState(state.searchQuery);
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(state.searchQuery), 180);
    return () => clearTimeout(timer);
  }, [state.searchQuery]);
  const query = useMemo(() => ({ childId, focusDate: state.focusDate, bucket: state.filter,
    careSubtype: state.careSubtype, searchQuery }), [childId, state.focusDate, state.filter, state.careSubtype, searchQuery]);
  const key = JSON.stringify([query, zone]);
  const [snapshot, setSnapshot] = useState<TimelineSnapshot>({ key: '', events: [], nextCursor: null });
  const [aux, setAux] = useState<AuxSnapshot>({ childId: null, drafts: [], trash: [] });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [auxError, setAuxError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const timelineVersion = useRef(0);
  const auxVersion = useRef(0);
  const olderBusy = useRef(false);
  const actionBusy = useRef(false);

  const loadTimeline = useCallback(async () => {
    const version = ++timelineVersion.current;
    setLoading(true); setLoadingMore(false); setTimelineError(null);
    try {
      if (!query.childId) { setSnapshot({ key, events: [], nextCursor: null }); return; }
      const rows = await runtime.unitOfWork.run(async (uow) => {
        if (query.focusDate) {
          const day = parseCalendarDate(query.focusDate);
          return { events: await loadHistoryDay(uow, { ...query, childId: query.childId!,
            fromSortAtMsInclusive: startOfCalendarDay(day, zone).epochMs,
            toSortAtMsExclusive: endOfCalendarDayExclusive(day, zone).epochMs }), nextCursor: null };
        }
        return loadHistoryPage(uow, { ...query, childId: query.childId!, limit: PAGE_SIZE, before: null });
      });
      if (version === timelineVersion.current) setSnapshot({ key, ...rows });
    } catch {
      if (version === timelineVersion.current) {
        setSnapshot({ key, events: [], nextCursor: null });
        setTimelineError('Záznamy se nepodařilo načíst. Zkuste to znovu.');
      }
    } finally { if (version === timelineVersion.current) setLoading(false); }
  }, [key, query, runtime.unitOfWork, zone]);

  const loadAux = useCallback(async () => {
    const version = ++auxVersion.current;
    setAuxError(null);
    if (!childId) { setAux({ childId, drafts: [], trash: [] }); return; }
    try {
      const next = await runtime.unitOfWork.run(async (uow) => ({
        childId, drafts: await loadDraftsForChild(uow, childId),
        trash: await loadRestorableTrash(uow, services.clock.now().epochMs, childId),
      }));
      if (version === auxVersion.current) setAux(next);
    } catch { if (version === auxVersion.current) setAuxError('Koncepty nebo smazané záznamy se nepodařilo načíst.'); }
  }, [childId, runtime.unitOfWork, services.clock]);

  const invalidateRequests = useCallback(() => { timelineVersion.current++; auxVersion.current++; }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) { void loadTimeline(); void loadAux(); } });
    const unsubscribe = runtime.readModels.subscribe((topics) => {
      if (topics.some((topic) => topic === 'care' || topic === 'drafts' || topic === 'revisions')) {
        void loadTimeline(); void loadAux();
      }
    });
    return () => { cancelled = true; invalidateRequests(); unsubscribe(); };
  }, [invalidateRequests, loadTimeline, loadAux, runtime.readModels]);

  async function loadOlder() {
    if (!childId || !snapshot.nextCursor || snapshot.key !== key || olderBusy.current || loading) return;
    olderBusy.current = true; setLoadingMore(true); setTimelineError(null);
    const version = timelineVersion.current;
    try {
      const page = await runtime.unitOfWork.run((uow) => loadHistoryPage(uow, {
        ...query, childId, limit: PAGE_SIZE, before: snapshot.nextCursor,
      }));
      if (version === timelineVersion.current) setSnapshot((previous) => previous.key === key
        ? { key, events: appendHistoryPage(previous.events, page.events), nextCursor: page.nextCursor } : previous);
    } catch { if (version === timelineVersion.current) setTimelineError('Starší záznamy se nepodařilo načíst. Zkuste to znovu.'); }
    finally { olderBusy.current = false; if (version === timelineVersion.current) setLoadingMore(false); }
  }

  async function mutate(id: string, action: () => Promise<void>) {
    if (actionBusy.current) return;
    actionBusy.current = true; setPendingId(id); setFeedback(null);
    try { await action(); }
    catch { setFeedback({ message: 'Změnu se nepodařilo uložit. Zkuste to znovu.', error: true }); }
    finally { actionBusy.current = false; setPendingId(null); }
  }

  function restoreTrashItem(marker: DeletionMarker) {
    if (!childId || careEventFromTrashMarker(marker)?.childId !== childId) return;
    return mutate(marker.deletionId, async () => {
      const result = await runtime.commands.dispatch({ type: 'restoreCare',
        operationId: asOperationId(services.ids.createId('op')), intentCapturedAt: services.clock.now(),
        eventId: marker.entityId, deletionId: marker.deletionId,
        revisionId: asRevisionId(services.ids.createId('rev')), expectedDeletionRevisionId: marker.revisionId });
      setFeedback({ message: result.ok ? 'Záznam je obnovený v časové ose.' : 'Záznam se nepodařilo obnovit. Zkuste to znovu.', error: !result.ok });
      if (result.ok) { await loadAux(); await loadTimeline(); }
    });
  }

  function discardDraft(draft: Draft) {
    if (draft.childId !== childId) return;
    return mutate(draft.draftId, async () => {
      const result = await runtime.commands.dispatch({ type: 'discardDraft',
        operationId: asOperationId(services.ids.createId('op')), intentCapturedAt: services.clock.now(),
        draftId: draft.draftId, revisionId: asRevisionId(services.ids.createId('rev')) });
      setFeedback({ message: result.ok ? 'Koncept je zahozený.' : 'Koncept se nepodařilo zahodit. Zkuste to znovu.', error: !result.ok });
      if (result.ok) await loadAux();
    });
  }

  function onRebuildSearch() {
    if (!childId) return;
    return mutate('search-index', async () => {
      const count = await runtime.unitOfWork.run((uow) => rebuildSearchIndex(uow, childId));
      setFeedback({ message: `Hledání je obnovené. Zpracováno ${count} záznamů.`, error: false });
      await loadTimeline();
    });
  }

  const searching = state.searchQuery !== searchQuery;
  const current = snapshot.key === key && !searching;
  return {
    childId, zone, todayIso,
    events: current ? snapshot.events : [], nextCursor: current ? snapshot.nextCursor : null,
    drafts: aux.childId === childId ? aux.drafts : [], trash: aux.childId === childId ? aux.trash : [],
    loading: !!childId && (loading || !current), loadingMore, pendingId, feedback,
    error: state.section === 'timeline' ? timelineError : auxError,
    reload: async () => { await Promise.all([loadTimeline(), loadAux()]); },
    loadOlder, restoreTrashItem, discardDraft, onRebuildSearch,
  };
}
