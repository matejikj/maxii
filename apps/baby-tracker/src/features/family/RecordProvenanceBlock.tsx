import React from 'react';
import { View } from 'react-native';
import { LumiText, useLumiTheme } from '@lumi/forest-design/native';
import type { AuthorshipLine } from '../../domain/family/conflictPresentation';

type Props = {
  readonly authorship: AuthorshipLine;
};

/** Compact provenance under a care detail — never a full-screen sync alarm. */
export function RecordProvenanceBlock({ authorship }: Props) {
  const { ui } = useLumiTheme();
  return (
    <View style={{ gap: ui.space.xs }}>
      <LumiText tone="muted">Autor: {authorship.originalAuthorLabel}</LumiText>
      {authorship.lastEditorLabel ? (
        <LumiText tone="muted">Poslední úprava: {authorship.lastEditorLabel}</LumiText>
      ) : null}
      {authorship.transferLine ? (
        <LumiText tone="muted">{authorship.transferLine}</LumiText>
      ) : null}
    </View>
  );
}
