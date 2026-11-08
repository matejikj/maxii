import type { ReminderPreferences } from '../../application/personalSettings';

export type ReminderPermissionState = 'unknown' | 'granted' | 'denied' | 'unsupported';

export type ReminderCapabilities = {
  /** OS local notifications for a closed app. */
  osLocalNotifications: boolean;
  /** Push while the browser tab is closed — never claimed in v1 web. */
  closedBrowserPush: boolean;
  platform: string;
};

export type ReminderScheduler = {
  getCapabilities(): ReminderCapabilities;
  getPermissionState(): Promise<ReminderPermissionState>;
  /**
   * Requests OS permission only after the caregiver explicitly enables a
   * reminder. Never called during cold start.
   */
  requestPermission(): Promise<ReminderPermissionState>;
  /** Idempotent reschedule; cancels removed reminders and avoids duplicates. */
  syncSchedules(prefs: ReminderPreferences): Promise<void>;
  cancelAll(): Promise<void>;
  /** Web / in-app weekly glance when OS push is unsupported. */
  peekInAppGlance(nowMs: number): Promise<'weekly_glance' | null>;
  acknowledgeInAppGlance(nowMs: number): Promise<void>;
};

type MemoryState = {
  permission: ReminderPermissionState;
  prefs: ReminderPreferences | null;
  lastGlanceAckMs: number | null;
  schedules: Array<{ id: string; kind: string; fireAtMs: number }>;
};

/**
 * Deterministic scheduler for tests and for platforms without a native module.
 * Stores intent without claiming a closed-browser push channel.
 */
export function createMemoryReminderScheduler(
  options: { platform?: string; osLocalNotifications?: boolean } = {},
): ReminderScheduler & { readonly state: MemoryState } {
  const state: MemoryState = {
    permission: 'unknown',
    prefs: null,
    lastGlanceAckMs: null,
    schedules: [],
  };
  const platform = options.platform ?? 'test';
  const osLocal = options.osLocalNotifications ?? platform !== 'web';

  return {
    state,
    getCapabilities() {
      return {
        osLocalNotifications: osLocal,
        closedBrowserPush: false,
        platform,
      };
    },
    async getPermissionState() {
      if (!osLocal) return 'unsupported';
      return state.permission;
    },
    async requestPermission() {
      if (!osLocal) {
        state.permission = 'unsupported';
        return 'unsupported';
      }
      // Tests flip this via state; production adapters replace the whole object.
      if (state.permission === 'unknown') state.permission = 'granted';
      return state.permission;
    },
    async syncSchedules(prefs) {
      state.prefs = prefs;
      state.schedules = [];
      if (!prefs.dailyTogetherEnabled && !prefs.weeklyGlanceEnabled) return;
      if (osLocal && state.permission !== 'granted') return;
      if (prefs.dailyTogetherEnabled) {
        state.schedules.push({
          id: 'daily_together',
          kind: 'daily_together',
          fireAtMs: prefs.dailyTogetherHour * 60 + prefs.dailyTogetherMinute,
        });
      }
      if (prefs.weeklyGlanceEnabled) {
        state.schedules.push({
          id: 'weekly_glance',
          kind: 'weekly_glance',
          fireAtMs: prefs.weeklyGlanceWeekday,
        });
      }
    },
    async cancelAll() {
      state.schedules = [];
      state.prefs = null;
    },
    async peekInAppGlance(nowMs) {
      if (!state.prefs?.weeklyGlanceEnabled) return null;
      if (state.lastGlanceAckMs != null && nowMs - state.lastGlanceAckMs < 6 * 24 * 60 * 60 * 1000) {
        return null;
      }
      const day = new Date(nowMs).getDay();
      if (day !== state.prefs.weeklyGlanceWeekday) return null;
      return 'weekly_glance';
    },
    async acknowledgeInAppGlance(nowMs) {
      state.lastGlanceAckMs = nowMs;
    },
  };
}

/**
 * Synchronous fallback used by pure Node tests. Production bootstrap awaits
 * `createPlatformReminderSchedulerAsync` so native builds bind expo-notifications.
 */
export function createPlatformReminderScheduler(): ReminderScheduler {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Platform } = require('react-native') as { Platform: { OS: string } };
  if (Platform.OS === 'web') {
    return createMemoryReminderScheduler({ platform: 'web', osLocalNotifications: false });
  }
  // Without the native module, claim no closed-app delivery rather than fake it.
  return createMemoryReminderScheduler({
    platform: Platform.OS,
    osLocalNotifications: false,
  });
}

export { createPlatformReminderSchedulerAsync } from './expoReminderScheduler';
