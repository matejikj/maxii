import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { LumiButton, useLumiTheme } from '@lumi/forest-design/native';
import { PRODUCT_COPY } from './productCopy';

export type DiaperDirectKind = 'wet' | 'dirty' | 'both';

export type DirectCareActionsProps = {
  disabled?: boolean;
  pending?: boolean;
  onRecord: (kind: DiaperDirectKind) => void | Promise<void>;
  onOpenDetailed: () => void;
};

/**
 * Direct “Zapsat mokrou” actions commit on press. They are visually and verbally
 * distinct from the detailed form’s single “Uložit” button. Double-press is
 * ignored while a write is pending.
 */
export function DirectCareActions({
  disabled = false,
  pending = false,
  onRecord,
  onOpenDetailed,
}: DirectCareActionsProps) {
  const { ui } = useLumiTheme();
  const [inflight, setInflight] = useState(false);
  const locked = useRef(false);
  const busy = disabled || pending || inflight;

  async function run(kind: DiaperDirectKind) {
    if (locked.current || busy) return;
    locked.current = true;
    setInflight(true);
    try {
      await onRecord(kind);
    } finally {
      locked.current = false;
      setInflight(false);
    }
  }

  return (
    <View style={{ gap: ui.space.sm }}>
      <LumiButton
        title={PRODUCT_COPY.actions.recordWet}
        onPress={() => void run('wet')}
        disabled={busy}
        loading={inflight}
        fullWidth
        testID="direct-wet"
      />
      <LumiButton
        title={PRODUCT_COPY.actions.recordDirty}
        variant="secondary"
        onPress={() => void run('dirty')}
        disabled={busy}
        fullWidth
      />
      <LumiButton
        title={PRODUCT_COPY.actions.recordBoth}
        variant="secondary"
        onPress={() => void run('both')}
        disabled={busy}
        fullWidth
      />
      <LumiButton
        title={PRODUCT_COPY.actions.otherTimeOrNote}
        variant="ghost"
        onPress={onOpenDetailed}
        disabled={busy}
        fullWidth
      />
    </View>
  );
}

export type FormSaveButtonProps = {
  onSave: () => void | Promise<void>;
  disabled?: boolean;
  pending?: boolean;
  label?: string;
};

/** Detailed form confirmation — never used as a disguised direct write. */
export function FormSaveButton({
  onSave,
  disabled = false,
  pending = false,
  label = PRODUCT_COPY.actions.save,
}: FormSaveButtonProps) {
  const [inflight, setInflight] = useState(false);
  const locked = useRef(false);
  const busy = disabled || pending || inflight;

  return (
    <LumiButton
      title={label}
      onPress={() => {
        if (locked.current || busy) return;
        locked.current = true;
        setInflight(true);
        void Promise.resolve(onSave()).finally(() => {
          locked.current = false;
          setInflight(false);
        });
      }}
      disabled={busy}
      loading={inflight || pending}
      fullWidth
      testID="form-save"
      accessibilityHint="Potvrdí vyplněný podrobný záznam"
    />
  );
}
