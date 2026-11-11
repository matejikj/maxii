import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LumiIcon, useLumiTheme } from '@lumi/forest-design/native';
import type { LumiIconId } from '@lumi/forest-design/core';
import type { ChildShellSession } from '../../application';
import {
  ChildShellDiscoverScreen,
  ChildShellMyDataScreen,
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

const CHILD_TAB_ICONS: Record<keyof ChildShellTabParamList, LumiIconId> = {
  ChildToday: 'today',
  ChildProjects: 'development',
  ChildPortfolio: 'history',
  ChildDiscover: 'care',
};

/**
 * Four-tab child root. Mounted only for an activated child principal — caregiver
 * care/history tabs are intentionally absent. Profile opens “Moje data”, not a
 * fifth tab and not the caregiver settings surface.
 */
export function ChildShellNavigator(props: {
  readonly session: ChildShellSession;
  readonly childPrivateModeActive: boolean;
  /** Optional gate overrides for harness/tests — production leaves them unset. */
  readonly gateOverrides?: Parameters<typeof ChildShellMyDataScreen>[0]['gateOverrides'];
}) {
  const { colors } = useLumiTheme();
  const [showMyData, setShowMyData] = useState(false);
  const shellProps = {
    session: props.session,
    childPrivateModeActive: props.childPrivateModeActive,
    onOpenProfile: () => setShowMyData(true),
  };

  if (showMyData) {
    return (
      <ChildShellMyDataScreen
        session={props.session}
        childPrivateModeActive={props.childPrivateModeActive}
        gateOverrides={props.gateOverrides}
        onClose={() => setShowMyData(false)}
      />
    );
  }

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.controlBorder },
        tabBarIcon: ({ color, size }) => (
          <LumiIcon name={CHILD_TAB_ICONS[route.name]} color={color} size={size} />
        ),
      })}
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
