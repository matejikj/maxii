import type { EntityId } from '../../domain';

export type MainTabParamList = {
  Today: undefined;
  Care: undefined;
  Development: undefined;
  History: undefined;
};

/** Child principal tabs — never include care diary or global family search. */
export type ChildShellTabParamList = {
  ChildToday: undefined;
  ChildProjects: undefined;
  ChildPortfolio: undefined;
  ChildDiscover: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  /** Mounted only after verified child shell activation. */
  ChildShell: undefined;
  Welcome: undefined;
  Profile: undefined;
  /** Opaque entity id only — never display names or notes in the path. */
  EventDetail: { eventId: EntityId };
};

export type AppRouteName =
  | keyof MainTabParamList
  | keyof ChildShellTabParamList
  | keyof RootStackParamList;
