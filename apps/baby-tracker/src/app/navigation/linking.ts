import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/**
 * Deep links carry only opaque ids. Names, notes, and DOB never appear in URLs.
 */
export const APP_LINK_PREFIXES = ['lumi://', 'https://app.lumi.local'] as const;

export function createAppLinking(): LinkingOptions<RootStackParamList> {
  return {
    prefixes: [...APP_LINK_PREFIXES],
    config: {
      screens: {
        MainTabs: {
          path: '',
          screens: {
            Today: 'today',
            Care: 'care',
            Development: 'development',
            History: 'history',
          },
        },
        Welcome: 'welcome',
        Profile: 'profile',
        EventDetail: 'history/event/:eventId',
      },
    },
    filter: (url) => {
      // Reject query payloads that look like notes or display names.
      if (/[?&](note|name|dob)=/i.test(url)) return false;
      return true;
    },
  };
}

export function isOpaqueEntityId(value: string): boolean {
  // Matches createId(`prefix`) → prefix_ + hex, never human display names.
  return /^[a-z][a-z0-9]*_[0-9a-f]{16,}$/i.test(value);
}

export function safeEventDetailParams(
  params: { eventId?: string } | undefined,
): { eventId: string } | null {
  if (!params?.eventId || !isOpaqueEntityId(params.eventId)) return null;
  return { eventId: params.eventId };
}
