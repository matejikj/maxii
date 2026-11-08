import { AppError } from '../errors';

export type WeightDisplayUnit = 'kg' | 'lb';
export type LengthDisplayUnit = 'cm' | 'in';

const LB_PER_KG = 2.2046226218;
const IN_PER_CM = 0.3937007874;

/**
 * Canonical storage is always kg/cm. Display conversion never rewrites stored
 * history — only the value shown or typed in the active unit.
 */
export function kgToDisplay(weightKg: number, unit: WeightDisplayUnit): number {
  return unit === 'kg' ? weightKg : weightKg * LB_PER_KG;
}

export function displayToKg(value: number, unit: WeightDisplayUnit): number {
  return unit === 'kg' ? value : value / LB_PER_KG;
}

export function cmToDisplay(lengthCm: number, unit: LengthDisplayUnit): number {
  return unit === 'cm' ? lengthCm : lengthCm * IN_PER_CM;
}

export function displayToCm(value: number, unit: LengthDisplayUnit): number {
  return unit === 'cm' ? value : value / IN_PER_CM;
}

/** Accept Czech decimal comma; empty means “not provided”, not zero. */
export function parseDecimalInput(
  raw: string,
): { ok: true; value: number | null } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  const normalized = trimmed.replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return {
      ok: false,
      message: 'Zadejte číslo. Desetinná čárka je v pořádku.',
    };
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, message: 'Měření musí být kladné číslo.' };
  }
  return { ok: true, value };
}

export function formatDisplayMeasure(value: number, digits = 2): string {
  // Drop trailing zeros without inventing more precision than the measure needs.
  return String(Number(value.toFixed(digits)));
}

export function assertPositiveMeasure(label: string, value: number | null): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value <= 0) {
    throw new AppError('VALIDATION', `${label} must be a positive number when provided`, {
      details: { reason: 'growth_measure' },
    });
  }
  return value;
}
