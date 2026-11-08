import type { LengthDisplayUnit, UnitOfWorkFactory, WeightDisplayUnit } from '../../domain';

const META_KEY = 'growth_display_units_v1';

export type GrowthDisplayUnits = {
  weightUnit: WeightDisplayUnit;
  lengthUnit: LengthDisplayUnit;
};

const DEFAULT_UNITS: GrowthDisplayUnits = {
  weightUnit: 'kg',
  lengthUnit: 'cm',
};

export function normalizeGrowthDisplayUnits(raw: unknown): GrowthDisplayUnits {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_UNITS };
  const record = raw as Record<string, unknown>;
  const weightUnit =
    record.weightUnit === 'lb' || record.weightUnit === 'kg'
      ? record.weightUnit
      : DEFAULT_UNITS.weightUnit;
  const lengthUnit =
    record.lengthUnit === 'in' || record.lengthUnit === 'cm'
      ? record.lengthUnit
      : DEFAULT_UNITS.lengthUnit;
  return { weightUnit, lengthUnit };
}

export async function loadGrowthDisplayUnits(
  unitOfWork: UnitOfWorkFactory,
): Promise<GrowthDisplayUnits> {
  const raw = await unitOfWork.run((uow) => uow.meta.get(META_KEY));
  if (!raw) return { ...DEFAULT_UNITS };
  try {
    return normalizeGrowthDisplayUnits(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_UNITS };
  }
}

export async function saveGrowthDisplayUnits(
  unitOfWork: UnitOfWorkFactory,
  units: GrowthDisplayUnits,
): Promise<GrowthDisplayUnits> {
  const normalized = normalizeGrowthDisplayUnits(units);
  await unitOfWork.run((uow) => uow.meta.set(META_KEY, JSON.stringify(normalized)));
  return normalized;
}
