import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LumiIcon, LumiText, useLumiTheme } from '@lumi/forest-design/native';
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
import { CareIconBadge } from './CareVisuals';

type CareOverviewPanelProps = {
  overviewCache: CareOverviewCache;
};

/**
 * Day / 7-day descriptive totals from the same diary as History. Copy stays on
 * “zaznamenáno”; incomplete inputs never become zero care.
 */
export function CareOverviewPanel({ overviewCache }: CareOverviewPanelProps) {
  const { colors, mode, motif } = useLumiTheme();
  const { width, fontScale } = useWindowDimensions();
  const singleColumn = width < 350 || fontScale > 1.25;
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
      if (topics.includes('care') || topics.includes('sessions') || topics.includes('revisions')) {
        overviewCache.invalidate();
        void load();
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [
    childId,
    overviewCache,
    period,
    runtime.readModels,
    runtime.unitOfWork,
    services.clock,
    zone,
  ]);

  const presentation = overview?.period === period ? presentCareOverview(overview) : null;

  return (
    <View style={styles.panel} testID="care-overview">
      <View style={styles.heading}>
        <LumiText variant="h2" accessibilityRole="header">
          Přehled péče
        </LumiText>
        <LumiText variant="caption" tone="muted">
          Malé střípky vašeho dne
        </LumiText>
      </View>
      <View style={[styles.periodSwitch, { backgroundColor: colors.secondary }]}>
        {(['day', 'week'] as const).map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: period === option }}
            accessibilityLabel={option === 'day' ? 'Dnes' : '7 dní'}
            onPress={() => setPeriod(option)}
            testID={`care-period-${option}`}
            style={({ pressed }) => [
              styles.periodOption,
              {
                backgroundColor: period === option ? colors.surface : 'transparent',
                opacity: pressed ? 0.72 : 1,
              },
            ]}
          >
            <LumiText
              variant="label"
              numberOfLines={1}
              style={{
                alignSelf: 'stretch',
                textAlign: 'center',
                color: period === option ? colors.primary : colors.textMuted,
              }}
            >
              {option === 'day' ? 'Dnes' : '7\u00A0dní'}
            </LumiText>
          </Pressable>
        ))}
      </View>
      {error ? (
        <LumiText tone="muted" accessibilityLiveRegion="polite">
          {error}
        </LumiText>
      ) : null}
      {presentation ? (
        <View style={{ gap: 12 }}>
          <View style={styles.dateLine}>
            <LumiIcon name="today" color={colors.textMuted} size={16} />
            <LumiText variant="caption" tone="muted" style={{ flex: 1 }}>
              {presentation.periodTitle}
              {overview ? ` · ${formatDate(overview.meta.focusDate)}` : ''}
              {overview?.period === 'week' ? ` (od ${formatDate(overview.days[0]!)})` : ''}
            </LumiText>
          </View>
          <View style={styles.grid}>
            {presentation.metrics.map((metric) => (
              <View
                key={metric.id}
                testID={`care-metric-${metric.id}`}
                accessible
                accessibilityLabel={`${metric.title}. ${metric.description}`}
                style={[
                  styles.metric,
                  {
                    flexBasis: singleColumn ? '100%' : '47%',
                    backgroundColor: colors.surface,
                    borderColor: mode === 'dark' || motif !== 'forest' ? colors.border : '#E2E7DD',
                  },
                ]}
              >
                <View style={styles.metricHeading}>
                  <CareIconBadge name={metric.id} size={38} />
                  <LumiText variant="label" tone="muted" style={{ flexShrink: 1 }}>
                    {metric.title}
                  </LumiText>
                </View>
                <LumiText
                  style={[
                    styles.metricValue,
                    { color: metric.hasRecords ? colors.text : colors.textMuted },
                  ]}
                >
                  {metric.value}
                </LumiText>
                <LumiText variant="caption" tone="muted" style={styles.metricDetail}>
                  {metric.detail}
                </LumiText>
              </View>
            ))}
          </View>
          {presentation.running.length > 0 ? (
            <View style={[styles.running, { backgroundColor: colors.surfaceSubtle }]}>
              {presentation.running.map((line) => (
                <LumiText key={line} variant="caption" tone="muted">
                  {line}
                </LumiText>
              ))}
            </View>
          ) : null}
          <LumiText variant="caption" tone="muted">
            {presentation.zoneNote}
          </LumiText>
        </View>
      ) : !error ? (
        <LumiText tone="muted" accessibilityLiveRegion="polite">
          {childId ? 'Načítám přehled z deníku…' : 'Až přibudou záznamy, uvidíte tady přehled.'}
        </LumiText>
      ) : null}
      <LumiText variant="caption" tone="muted" style={{ lineHeight: 19 }}>
        Jen to, co jste zapsali. Přehled nehodnotí zdravotní stav dítěte.
      </LumiText>
    </View>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T12:00:00Z`));
}

const styles = StyleSheet.create({
  panel: { gap: 16 },
  heading: { gap: 3 },
  periodSwitch: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 280,
    padding: 4,
    borderRadius: 18,
  },
  periodOption: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { flexGrow: 1, padding: 15, borderRadius: 23, borderWidth: 1, minHeight: 145, gap: 9 },
  metricHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metricValue: { fontSize: 24, lineHeight: 31, fontWeight: '700', letterSpacing: -0.5 },
  metricDetail: { fontSize: 12, lineHeight: 18 },
  running: { padding: 14, borderRadius: 16, gap: 6 },
});
