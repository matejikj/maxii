import React from 'react';
import { View } from 'react-native';
import { LumiChip, LumiInput, useLumiTheme } from '@lumi/forest-design/native';
import { PRODUCT_COPY } from './productCopy';

export type QuantityUnitOption = 'ml' | 'g' | 'piece';

export type QuantityFieldProps = {
  amount: string;
  unit: QuantityUnitOption;
  onChangeAmount: (value: string) => void;
  onChangeUnit: (unit: QuantityUnitOption) => void;
  error?: string;
  disabled?: boolean;
};

const UNITS: { id: QuantityUnitOption; label: string }[] = [
  { id: 'ml', label: 'ml' },
  { id: 'g', label: 'g' },
  { id: 'piece', label: 'ks' },
];

/** Amount stays distinguishable from “not provided”; empty string means unknown. */
export function QuantityField({
  amount,
  unit,
  onChangeAmount,
  onChangeUnit,
  error,
  disabled = false,
}: QuantityFieldProps) {
  const { ui } = useLumiTheme();
  return (
    <View style={{ gap: ui.space.md }}>
      <LumiInput
        label={PRODUCT_COPY.fields.amount}
        value={amount}
        onChangeText={onChangeAmount}
        editable={!disabled}
        {...(error !== undefined ? { error } : {})}
        hint="Nechte prázdné, pokud množství neznáte. Nula znamená naměřenou prázdnou dávku."
        keyboardType="decimal-pad"
        accessibilityLabel={PRODUCT_COPY.fields.amount}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ui.space.sm }}>
        {UNITS.map((option) => (
          <LumiChip
            key={option.id}
            label={option.label}
            selected={unit === option.id}
            disabled={disabled}
            onPress={() => onChangeUnit(option.id)}
            accessibilityLabel={`${PRODUCT_COPY.fields.unit}: ${option.label}`}
          />
        ))}
      </View>
    </View>
  );
}
