import React from 'react';
import { View } from 'react-native';
import { LumiChartContainer, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import {
  cmToDisplay,
  formatDisplayMeasure,
  kgToDisplay,
  type GrowthSeries,
  type LengthDisplayUnit,
  type WeightDisplayUnit,
} from '../../domain';

export type GrowthChartProps = {
  series: GrowthSeries;
  weightUnit: WeightDisplayUnit;
  lengthUnit: LengthDisplayUnit;
  formatDate: (epochMs: number) => string;
};

/**
 * Own measurements only. A single point is labelled as such — never drawn as a
 * trend — and missing series stay empty instead of zero-filled.
 */
export function GrowthChart({
  series,
  weightUnit,
  lengthUnit,
  formatDate,
}: GrowthChartProps) {
  const { colors, ui } = useLumiTheme();
  if (series.points.length === 0) {
    return (
      <LumiText tone="muted">Zatím není žádné uložené měření růstu.</LumiText>
    );
  }

  const weightValues = series.points
    .map((point) => point.weightKg)
    .filter((value): value is number => value != null);
  const maxWeight = weightValues.length > 0 ? Math.max(...weightValues) : 0;

  const table = series.points.map((point) => {
    const parts = [
      point.weightKg != null
        ? `${formatDisplayMeasure(kgToDisplay(point.weightKg, weightUnit))} ${weightUnit}`
        : null,
      point.lengthCm != null
        ? `${formatDisplayMeasure(cmToDisplay(point.lengthCm, lengthUnit))} ${lengthUnit}`
        : null,
      point.headCm != null
        ? `hlava ${formatDisplayMeasure(cmToDisplay(point.headCm, lengthUnit))} ${lengthUnit}`
        : null,
    ].filter(Boolean);
    return {
      label: formatDate(point.measuredAtMs),
      value: parts.join(' · ') || '—',
    };
  });

  const summary = series.singlePoint
    ? 'Jedno naměřené místo. To ještě není trend; chybějící hodnoty nedoplňujeme.'
    : `Vlastních měření: ${series.points.length}. Mezery mezi body nejsou odhadnuté hodnoty.`;

  return (
    <LumiChartContainer title="Vlastní měření" summary={summary} table={table}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: ui.space.sm,
          minHeight: 120,
          paddingHorizontal: ui.space.sm,
        }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {series.points.map((point) => {
          const ratio =
            point.weightKg != null && maxWeight > 0 ? point.weightKg / maxWeight : 0;
          const height = point.weightKg == null ? 8 : Math.max(12, Math.round(ratio * 100));
          return (
            <View
              key={point.eventId}
              style={{
                flex: 1,
                height,
                borderRadius: 6,
                backgroundColor:
                  point.weightKg == null ? colors.controlBorder : colors.primary,
                opacity: point.weightKg == null ? 0.35 : 1,
              }}
            />
          );
        })}
      </View>
      {!series.hasWeight ? (
        <LumiText tone="muted" variant="caption">
          Sloupce ukazují hmotnost, když je zadaná. Délku a obvod hlavy najdete v tabulce.
        </LumiText>
      ) : null}
    </LumiChartContainer>
  );
}
