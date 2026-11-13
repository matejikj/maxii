import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { LumiButton, LumiCard, LumiIcon, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import type { ChildProfile } from '../../domain';
import { asTimeZoneId, todayInZone } from '../../domain';
import type { DailyRecommendationView } from '../../application';
import {
  buildParentRecommendationContext,
  candidatesFromRevisions,
  ensureDailyRecommendationSet,
  loadReadinessByKey,
} from '../../application';
import { PRODUCT_PUBLISHED_CONTENT_VERSION, PRODUCT_PUBLISHED_REVISIONS } from '../../content';
import { useCompositionRoot } from '../../app/providers';
import { usePersonalRuntime } from '../../app/session/BootstrapContext';
import { PRODUCT_COPY } from '../ui';
import { ForestIconBadge, forestTone } from '../ui/ForestIconBadge';

type TodayTogetherCardProps = {
  profile: ChildProfile;
  sleepRunning: boolean;
  onOpenDevelopment: () => void;
};

/** Shared daily offer with Development — never a second independent shuffle. */
export function TodayTogetherCard({
  profile,
  sleepRunning,
  onOpenDevelopment,
}: TodayTogetherCardProps) {
  const { ui, colors, mode, motif } = useLumiTheme();
  const tone = forestTone(mode, 'experience', motif);
  const { services } = useCompositionRoot();
  const runtime = usePersonalRuntime();
  const [view, setView] = useState<DailyRecommendationView | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      void (async () => {
        if (!runtime.unitOfWork) return;
        const zone = asTimeZoneId(profile.settings.summaryTimeZone);
        const localDay = todayInZone(services.clock.now(), zone);
        const readinessByKey = await loadReadinessByKey(runtime.unitOfWork, profile.childId);
        const context = buildParentRecommendationContext(profile, localDay, {
          sleepRunning,
          withoutMaterialsOnly: false,
          readinessByKey,
        });
        const next = await ensureDailyRecommendationSet(runtime.unitOfWork, {
          childId: profile.childId,
          localDay,
          context,
          catalog: {
            contentVersion: PRODUCT_PUBLISHED_CONTENT_VERSION,
            candidates: candidatesFromRevisions([...PRODUCT_PUBLISHED_REVISIONS]),
          },
          nowSeed: `today-${localDay.year}${localDay.month}${localDay.day}`,
        });
        if (!cancelled) setView(next);
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [profile, runtime.unitOfWork, services.clock, sleepRunning]);

  const primary = view?.set.offers[0];
  const revision = primary
    ? PRODUCT_PUBLISHED_REVISIONS.find((item) => item.revisionId === primary.activityRevisionId)
    : null;

  return (
    <LumiCard
      padding="none"
      style={{
        padding: 20,
        borderRadius: 26,
        gap: 14,
        backgroundColor: tone.background,
        borderColor: motif === 'forest' && mode === 'light' ? '#E9DEC5' : colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <ForestIconBadge name="experience" size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <LumiText variant="overline" tone="muted" style={{ fontSize: 10, letterSpacing: 1.5 }}>
            CHVILKA PRO VÁS
          </LumiText>
          <LumiText variant="h2" accessibilityRole="header">
            {PRODUCT_COPY.today.together}
          </LumiText>
        </View>
        <LumiIcon name="development" color={tone.ink} accentColor={tone.accent} size={27} />
      </View>
      {view?.set.status === 'hidden' ? (
        <LumiText tone="muted">{PRODUCT_COPY.actions.careOnlyToday}</LumiText>
      ) : null}
      {view?.presentation === 'later' ? (
        <LumiText tone="muted">{PRODUCT_COPY.development.laterBecauseSleep}</LumiText>
      ) : null}
      {revision && primary ? (
        <View style={{ gap: ui.space.sm }}>
          <LumiText variant="bodyStrong">{revision.title}</LumiText>
          <LumiText tone="muted" variant="caption">
            {PRODUCT_COPY.development.filterMoment}
          </LumiText>
          <LumiButton
            title={PRODUCT_COPY.today.showGame}
            fullWidth
            onPress={onOpenDevelopment}
            testID="today-show-game"
            rightAdornment={<LumiIcon name="arrow-right" color={colors.onPrimary} size={18} />}
          />
        </View>
      ) : (
        <LumiText tone="muted" variant="caption">
          {view?.emptyReasonCodes.includes('missing_birth_date')
            ? PRODUCT_COPY.empty.missingBirthDate
            : view?.emptyReasonCodes.includes('age_out_of_content_window')
              ? PRODUCT_COPY.empty.ageOutOfWindow
              : PRODUCT_COPY.empty.noEligibleActivity}
        </LumiText>
      )}
      {!revision ? (
        <LumiButton
          title="Otevřít Rozvoj"
          variant="outline"
          fullWidth
          onPress={onOpenDevelopment}
          testID="today-explore-development"
          rightAdornment={<LumiIcon name="arrow-right" color={colors.text} size={18} />}
        />
      ) : null}
    </LumiCard>
  );
}
