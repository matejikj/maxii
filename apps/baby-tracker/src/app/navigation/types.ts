import type { EntityId } from '../../domain';

export type MainTabParamList = {
  Today: undefined;
  Care: undefined;
  Development: undefined;
  History: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  Welcome: undefined;
  Profile: undefined;
  /** Opaque entity id only — never display names or notes in the path. */
  EventDetail: { eventId: EntityId };
};

export type AppRouteName =
  | keyof MainTabParamList
  | keyof RootStackParamList;
