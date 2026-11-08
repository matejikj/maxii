import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { LumiChip, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import {
  asTimeZoneId,
  todayInZone,
  type CareOverviewPeriod,
  type DailyCareOverview,
  type WeeklyCareOverview,
} from '../../domain';
import {
  loadDailyCareOverview,
  loadWeeklyCareOverview,
  type CareOverviewCache,
} from '../../application';
import { useBootstrap, usePersonalRuntime } from '../../app/session/BootstrapContext';
import { useCompositionRoot } from '../../app/providers';
import { presentCareOverview } from './presentCareOverview';

type CareOverviewPanelProps = {
  overviewCache: CareOverviewCache;
};

/**
 * Day / 7-day descriptive totals from the same diary as History. Copy stays on
 * “zaznamenáno”; incomplete inputs never become zero care.
 */
export function CareOverviewPanel({ overviewCache }: CareOverviewPanelProps) {
  const { ui } = useLumiTheme();
  const { profile } = useBootstrap();
  const runtime = usePersonalRuntime();
  const { services } = useCompositionRoot();
  const [period, setPeriod] = useState<CareOverviewPeriod>('day');
  const [overview, setOverview] = useState<DailyCareOverview | WeeklyCareOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const zone = asTimeZoneId(profile?.settings.summaryTimeZone ?? 'Europe/Prague');
  const childId = profile?.childId ?? null;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!childId) {
        setOverview(null);
        return;
      }
      const focus = todayInZone(services.clock.now(), zone);
      const nowEpochMs = services.clock.now().epochMs;
      try {
        const next =
          period === 'day'
            ? await runtime.unitOfWork.run((uow) =>
                loadDailyCareOverview(uow, {
                  childId,
                  day: focus,
                  summaryTimeZone: zone,
                  nowEpochMs,
                  cache: overviewCache,
                }),
              )
            : await runtime.unitOfWork.run((uow) =>
                loadWeeklyCareOverview(uow, {
                  childId,
                  endDay: focus,
                  summaryTimeZone: zone,
                  nowEpochMs,
                  cache: overviewCache,
                }),
              );
        if (!cancelled) {
          setOverview(next);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          overviewCache.invalidate();
          setError('Souhrn se nepodařilo spočítat. Zdrojové záznamy zůstaly beze změny.');
        }
      }
    }
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    const unsubscribe = runtime.readModels.subscribe((topics) => {
      if (
        topics.includes('care') ||
        topics.includes('sessions') ||
        topics.includes('revisions')
      ) {
        overviewCache.invalidate();
        void load();
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [childId, overviewCache, period, runtime.readModels, runtime.unitOfWork, services.clock, zone]);

  const presentation = overview ? presentCareOverview(overview) : null;

  return (
    <View style={{ gap: ui.space.md }} accessibilityRole="summary">
      <LumiText variant="h2">Přehled péče</LumiText>
      <LumiText tone="muted">
        Popisuje jen to, co je v deníku. Nehodnotí zdravotní stav dítěte.
      </LumiText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <LumiChip
          label="Dnes"
          selected={period === 'day'}
          onPress={() => setPeriod('day')}
        />
        <LumiChip
          label="7 dní"
          selected={period === 'week'}
          onPress={() => setPeriod('week')}
        />
      </View>
      {error ? <LumiText tone="muted">{error}</LumiText> : null}
      {presentation ? (
        <View style={{ gap: ui.space.sm }}>
          <LumiText>
            {presentation.periodTitle}
            {overview && overview.period === 'week'
              ? ` (${overview.days[0]} – ${overview.days[overview.days.length - 1]})`
              : ''}
          </LumiText>
          <LumiText tone="muted">{presentation.zoneNote}</LumiText>
          <OverviewLine title="Spánek" body={presentation.sleep} />
          <OverviewLine title="Kojení" body={presentation.nursing} />
          <OverviewLine title="Lahvička" body={presentation.bottles} />
          <OverviewLine title="Jídlo" body={presentation.food} />
          <OverviewLine title="Plenky" body={presentation.diapers} />
          <OverviewLine title="Růst" body={presentation.growth} />
          {presentation.running.map((line) => (
            <LumiText key={line} tone="muted">
              {line}
            </LumiText>
          ))}
        </View>
      ) : (
        <LumiText tone="muted">Až přibudou záznamy, uvidíte tady přehled.</LumiText>
      )}
    </View>
  );
}

function OverviewLine({ title, body }: { title: string; body: string }) {
  return (
    <View>
      <LumiText>{title}</LumiText>
      <LumiText tone="muted">{body}</LumiText>
    </View>
  );
}
