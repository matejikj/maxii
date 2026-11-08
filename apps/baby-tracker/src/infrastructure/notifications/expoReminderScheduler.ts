import type { ReminderPreferences } from '../../application/personalSettings';
import {
  createMemoryReminderScheduler,
  type ReminderCapabilities,
  type ReminderPermissionState,
  type ReminderScheduler,
} from './reminderScheduler';

const DAILY_ID = 'lumi.reminder.daily_together';
const WEEKLY_ID = 'lumi.reminder.weekly_glance';

type NotificationsModule = typeof import('expo-notifications');

/**
 * OS-backed local notifications. Titles stay generic so a locked screen never
 * shows notes or other care details. Push tokens and remote servers are unused.
 */
export function createExpoReminderScheduler(
  notifications: NotificationsModule,
  platform: string,
): ReminderScheduler {
  let lastGlanceAckMs: number | null = null;
  let prefs: ReminderPreferences | null = null;

  async function mapPermission(): Promise<ReminderPermissionState> {
    const current = await notifications.getPermissionsAsync();
    if (current.granted) return 'granted';
    if (!current.canAskAgain && current.status === 'denied') return 'denied';
    if (current.status === 'denied') return 'denied';
    return 'unknown';
  }

  return {
    getCapabilities(): ReminderCapabilities {
      return {
        osLocalNotifications: true,
        closedBrowserPush: false,
        platform,
      };
    },
    getPermissionState: mapPermission,
    async requestPermission() {
      const existing = await mapPermission();
      if (existing === 'granted' || existing === 'denied') return existing;
      const asked = await notifications.requestPermissionsAsync();
      if (asked.granted) return 'granted';
      return 'denied';
    },
    async syncSchedules(next) {
      prefs = next;
      await notifications.cancelScheduledNotificationAsync(DAILY_ID).catch(() => undefined);
      await notifications.cancelScheduledNotificationAsync(WEEKLY_ID).catch(() => undefined);
      if (!next.dailyTogetherEnabled && !next.weeklyGlanceEnabled) return;
      const permission = await mapPermission();
      if (permission !== 'granted') return;

      if (next.dailyTogetherEnabled) {
        await notifications.scheduleNotificationAsync({
          identifier: DAILY_ID,
          content: {
            title: 'Společná chvilka',
            body: 'Když budete chtít, otevřete LUMI a zvolte krátkou aktivitu.',
            // Locked-screen banners must stay free of diary notes or names.
            sound: false,
          },
          trigger: {
            type: notifications.SchedulableTriggerInputTypes.DAILY,
            hour: next.dailyTogetherHour,
            minute: next.dailyTogetherMinute,
          },
        });
      }
      if (next.weeklyGlanceEnabled) {
        await notifications.scheduleNotificationAsync({
          identifier: WEEKLY_ID,
          content: {
            title: 'Týdenní ohlédnutí',
            body: 'V LUMI najdete shrnutí společných chvilek za týden.',
            sound: false,
          },
          trigger: {
            type: notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: next.weeklyGlanceWeekday + 1,
            hour: 10,
            minute: 0,
          },
        });
      }
    },
    async cancelAll() {
      prefs = null;
      await notifications.cancelAllScheduledNotificationsAsync();
    },
    async peekInAppGlance(nowMs) {
      if (!prefs?.weeklyGlanceEnabled) return null;
      if (lastGlanceAckMs != null && nowMs - lastGlanceAckMs < 6 * 24 * 60 * 60 * 1000) {
        return null;
      }
      const day = new Date(nowMs).getDay();
      if (day !== prefs.weeklyGlanceWeekday) return null;
      return 'weekly_glance';
    },
    async acknowledgeInAppGlance(nowMs) {
      lastGlanceAckMs = nowMs;
    },
  };
}

/**
 * Prefer the OS scheduler on native. Fall back to an honest in-app scheduler
 * when the native module is missing (for example bare Node contract tests).
 */
export async function createPlatformReminderSchedulerAsync(): Promise<ReminderScheduler> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Platform } = require('react-native') as { Platform: { OS: string } };
  if (Platform.OS === 'web') {
    return createMemoryReminderScheduler({ platform: 'web', osLocalNotifications: false });
  }
  try {
    const notifications = await import('expo-notifications');
    await notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    return createExpoReminderScheduler(notifications, Platform.OS);
  } catch {
    return createMemoryReminderScheduler({
      platform: Platform.OS,
      osLocalNotifications: false,
    });
  }
}
