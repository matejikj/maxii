import React from 'react';
import { LumiInput } from '@lumi/forest-design/native';
import { PRODUCT_COPY } from './productCopy';

export type DateTimeFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  /** When true, copy makes clear this is not an automatic “now” stamp. */
  restoredFromDraft?: boolean;
};

/**
 * Explicit event time. Opening a panel never mutates this; callers own the
 * captured instant from the save press or a restored draft.
 */
export function DateTimeField({
  value,
  onChangeText,
  label = PRODUCT_COPY.fields.eventTime,
  error,
  disabled = false,
  restoredFromDraft = false,
}: DateTimeFieldProps) {
  return (
    <LumiInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      editable={!disabled}
      {...(error !== undefined ? { error } : {})}
      hint={
        restoredFromDraft
          ? 'Obnovený čas z rozepsaného zápisu — není to automatické „nyní“.'
          : 'Upravte čas, pokud nejde o právě teď.'
      }
      autoCapitalize="none"
      autoCorrect={false}
      accessibilityLabel={label}
    />
  );
}
