import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { LumiButton, LumiCard, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import type { ChildProfile } from '../../domain';
import { asTimeZoneId, todayInZone } from '../../domain';
import type { DailyRecommendationView } from '../../application';
import {
  buildParentRecommendationContext,
  candidatesFromRevisions,
  ensureDailyRecommendationSet,
  loadReadinessByKey,
} from '../../application';
import {
  LOCAL_LIBRARY_CONTENT_VERSION,
  LOCAL_LIBRARY_REVISIONS,
} from '../../content';
import { useCompositionRoot } from '../../app/providers';
import { usePersonalRuntime } from '../../app/session/BootstrapContext';
import { PRODUCT_COPY } from '../ui';

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
  const { ui } = useLumiTheme();
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
            contentVersion: LOCAL_LIBRARY_CONTENT_VERSION,
            candidates: candidatesFromRevisions(LOCAL_LIBRARY_REVISIONS),
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
    ? LOCAL_LIBRARY_REVISIONS.find((item) => item.revisionId === primary.activityRevisionId)
    : null;

  return (
    <LumiCard>
      <LumiText variant="h2">{PRODUCT_COPY.today.together}</LumiText>
      {view?.set.status === 'hidden' ? (
        <LumiText tone="muted">{PRODUCT_COPY.actions.careOnlyToday}</LumiText>
      ) : null}
      {view?.presentation === 'later' ? (
        <LumiText tone="muted">{PRODUCT_COPY.development.laterBecauseSleep}</LumiText>
      ) : null}
      {revision && primary ? (
        <View style={{ gap: ui.space.sm }}>
          <LumiText>{revision.title}</LumiText>
          <LumiText tone="muted">
            {revision.duration.kind === 'moment'
              ? PRODUCT_COPY.development.filterMoment
              : `${revision.duration.minutes} minut`}
          </LumiText>
          <LumiButton
            title={PRODUCT_COPY.today.showGame}
            fullWidth
            onPress={onOpenDevelopment}
            testID="today-show-game"
          />
        </View>
      ) : (
        <LumiText tone="muted">
          {view?.emptyReasonCodes.includes('missing_birth_date')
            ? PRODUCT_COPY.empty.missingBirthDate
            : view?.emptyReasonCodes.includes('age_out_of_content_window')
              ? PRODUCT_COPY.empty.ageOutOfWindow
              : PRODUCT_COPY.empty.noEligibleActivity}
        </LumiText>
      )}
    </LumiCard>
  );
}
