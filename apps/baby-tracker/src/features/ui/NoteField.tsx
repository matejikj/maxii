import React from 'react';
import { LumiInput } from '@lumi/forest-design/native';
import { PRODUCT_COPY } from './productCopy';

export type NoteFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  disabled?: boolean;
  label?: string;
};

/**
 * Multline system text field. Dictation is only whatever the OS keyboard offers —
 * no custom recording control, voice-service probe, or submit-on-dictation-end.
 */
export function NoteField({
  value,
  onChangeText,
  error,
  disabled = false,
  label = PRODUCT_COPY.fields.note,
}: NoteFieldProps) {
  return (
    <LumiInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      editable={!disabled}
      {...(error !== undefined ? { error } : {})}
      hint={PRODUCT_COPY.fields.noteHint}
      multiline
      // Keep focus through composition/dictation; never auto-submit on blur.
      blurOnSubmit={false}
      returnKeyType="default"
      textAlignVertical="top"
      accessibilityLabel={label}
      testID="care-note-field"
    />
  );
}
