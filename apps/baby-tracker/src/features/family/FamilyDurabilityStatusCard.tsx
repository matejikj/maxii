import React, { useMemo } from 'react';
import { View } from 'react-native';
import { LumiCard, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import {
  resolveRemoteServicesBoundary,
  shouldInitializeRemoteClients,
} from '../../app/remoteServicesBoundary';
import {
  buildFamilyDurabilityPresentation,
  buildSyncTransferPresentation,
  type SyncTransferPresentation,
} from '../../domain/index';

type Props = {
  readonly transfer?: SyncTransferPresentation | null;
  readonly remoteBackupCompletedAtLabel?: string | null;
  readonly portableBackupAvailable?: boolean;
};

/**
 * Parent-facing legend for uloženo / čeká na přenos / synchronizováno / záloha.
 * Shown only when family sync is configured; never claims other offline phones
 * already received this device's pending queue.
 */
export function FamilyDurabilityStatusCard({
  transfer = null,
  remoteBackupCompletedAtLabel = null,
  portableBackupAvailable = false,
}: Props) {
  const boundary = useMemo(() => resolveRemoteServicesBoundary(), []);
  const familySyncEnabled = shouldInitializeRemoteClients(boundary) && boundary.syncConfigured;
  const { ui } = useLumiTheme();

  const resolvedTransfer =
    transfer ??
    (familySyncEnabled
      ? buildSyncTransferPresentation({
          pendingTransferCount: 0,
          inFlight: false,
          lastSuccessfulSyncAt: null,
        })
      : null);

  const presentation = buildFamilyDurabilityPresentation({
    familySyncEnabled,
    transfer: resolvedTransfer,
    backup: {
      remoteCompletedAtLabel: remoteBackupCompletedAtLabel,
      portableAvailable: portableBackupAvailable,
    },
  });

  if (!presentation) return null;

  return (
    <LumiCard>
      <View style={{ gap: ui.space.xs }}>
        <LumiText variant="h3">{presentation.title}</LumiText>
        <LumiText>
          {presentation.primaryLabel}. {presentation.detailLine}
        </LumiText>
        {presentation.rows.map((row) => (
          <LumiText key={row.kind} tone={row.active ? 'default' : 'muted'}>
            {row.active ? '• ' : '○ '}
            {row.label} — {row.explanation}
          </LumiText>
        ))}
        <LumiText tone="muted">{presentation.offlinePeerCaveat}</LumiText>
        <LumiText tone="muted">{presentation.backupDistinctFromSync}</LumiText>
      </View>
    </LumiCard>
  );
}
