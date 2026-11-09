import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useLumiTheme } from '@lumi/forest-design/native';
import type { ChildShellSession } from '../../application';
import {
  ChildShellDiscoverScreen,
  ChildShellPortfolioScreen,
  ChildShellProjectsScreen,
  ChildShellTodayScreen,
} from './ChildShellScreens';

export type ChildShellTabParamList = {
  ChildToday: undefined;
  ChildProjects: undefined;
  ChildPortfolio: undefined;
  ChildDiscover: undefined;
};

const Tab = createBottomTabNavigator<ChildShellTabParamList>();

/**
 * Four-tab child root. Mounted only for an activated child principal — caregiver
 * care/history tabs are intentionally absent.
 */
export function ChildShellNavigator(props: {
  readonly session: ChildShellSession;
  readonly childPrivateModeActive: boolean;
  readonly onOpenProfile: () => void;
}) {
  const { colors } = useLumiTheme();
  const shellProps = {
    session: props.session,
    childPrivateModeActive: props.childPrivateModeActive,
    onOpenProfile: props.onOpenProfile,
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.controlBorder },
      }}
    >
      <Tab.Screen name="ChildToday" options={{ title: 'Dnes' }}>
        {() => <ChildShellTodayScreen {...shellProps} />}
      </Tab.Screen>
      <Tab.Screen name="ChildProjects" options={{ title: 'Projekty' }}>
        {() => <ChildShellProjectsScreen {...shellProps} />}
      </Tab.Screen>
      <Tab.Screen name="ChildPortfolio" options={{ title: 'Portfolio' }}>
        {() => <ChildShellPortfolioScreen {...shellProps} />}
      </Tab.Screen>
      <Tab.Screen name="ChildDiscover" options={{ title: 'Objevování' }}>
        {() => <ChildShellDiscoverScreen {...shellProps} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
