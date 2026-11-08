import React, { useMemo } from 'react';
import { View } from 'react-native';
import { LumiCard, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import {
  resolveRemoteServicesBoundary,
  shouldInitializeRemoteClients,
} from '../../app/remoteServicesBoundary';
import { presentRemoteBackupStatus } from '../../domain/family/remoteBackupPresentation';

type Props = {
  readonly lastCompletedAtLabel?: string | null;
  readonly lastAttemptStatus?: 'idle' | 'running' | 'completed' | 'failed';
  readonly scope?: 'ops_host' | 'family_archive' | 'none';
};

/**
 * Optional remote backup strip. Personal installs without sync config stay cold.
 */
export function RemoteBackupStatusCard({
  lastCompletedAtLabel = null,
  lastAttemptStatus = 'idle',
  scope = 'none',
}: Props) {
  const boundary = useMemo(() => resolveRemoteServicesBoundary(), []);
  const enabled = shouldInitializeRemoteClients(boundary) && boundary.syncConfigured;
  const { ui } = useLumiTheme();
  const presentation = presentRemoteBackupStatus({
    enabled,
    lastCompletedAtLabel,
    lastAttemptStatus,
    scope,
  });

  if (!presentation) return null;

  return (
    <LumiCard>
      <View style={{ gap: ui.space.xs }}>
        <LumiText variant="h3">{presentation.title}</LumiText>
        <LumiText>{presentation.statusLine}</LumiText>
        <LumiText tone="muted">{presentation.scopeLine}</LumiText>
        <LumiText tone="muted">
          Synchronizace šíří i omyly; historická vzdálená kopie je oddělená funkce.
        </LumiText>
      </View>
    </LumiCard>
  );
}
