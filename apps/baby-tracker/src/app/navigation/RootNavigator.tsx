import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BlurTargetView } from 'expo-blur';
import { LumiIcon, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import type { LumiIconId } from '@lumi/forest-design/core';
import { resolveActiveRootShell } from '../../application';
import { CareScreen } from '../../features/care/CareScreen';
import { DevelopmentScreen } from '../../features/development/DevelopmentScreen';
import { EventDetailScreen } from '../../features/history/EventDetailScreen';
import { HistoryScreen } from '../../features/history/HistoryScreen';
import { ProfileScreen } from '../../features/profile/ProfileScreen';
import {
  CompactActiveSessions,
  CompactActiveSessionsVisibleContext,
} from '../../features/shell/CompactActiveSessions';
import { WelcomeScreen } from '../../features/shell/WelcomeScreen';
import { TodayScreen } from '../../features/today/TodayScreen';
import { useBootstrap } from '../session/BootstrapContext';
import { createAppLinking } from './linking';
import type { MainTabParamList, RootStackParamList } from './types';
import {
  ForestDockButton,
  ForestGlassNavigationBar,
  ForestGlassSurface,
  useGlassAccessibility,
  type ForestBlurTarget,
} from './ForestGlassTabBar';
import { forestDockMetrics, forestGlassColors } from './forestGlass';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const MAIN_TAB_ICONS: Record<keyof MainTabParamList, LumiIconId> = {
  Today: 'today',
  Care: 'care',
  Development: 'development',
  History: 'history',
};

function TabWithCompactSleep({
  children,
  hideCompact,
  onOpenSleep,
  blurTarget,
}: {
  children: React.ReactNode;
  hideCompact?: boolean;
  onOpenSleep: () => void;
  blurTarget: ForestBlurTarget;
}) {
  const [stripVisible, setStripVisible] = React.useState(false);
  return (
    <BlurTargetView ref={blurTarget} collapsable={false} style={{ flex: 1 }}>
      <CompactActiveSessionsVisibleContext.Provider value={stripVisible}>
        <CompactActiveSessions
          hidden={hideCompact === true}
          onOpenSleep={onOpenSleep}
          onVisibilityChange={setStripVisible}
        />
        {children}
      </CompactActiveSessionsVisibleContext.Provider>
    </BlurTargetView>
  );
}

function MainTabs() {
  const { colors, mode, motif } = useLumiTheme();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const metrics = forestDockMetrics(width, fontScale, insets);
  const material = forestGlassColors(colors, mode, motif);
  const accessibility = useGlassAccessibility();
  const targets = React.useMemo(
    () => ({
      Today: React.createRef<React.ComponentRef<typeof View>>(),
      Care: React.createRef<React.ComponentRef<typeof View>>(),
      Development: React.createRef<React.ComponentRef<typeof View>>(),
      History: React.createRef<React.ComponentRef<typeof View>>(),
    }),
    [],
  );
  return (
    <Tab.Navigator
      tabBar={(props) => <ForestGlassNavigationBar {...props} />}
      safeAreaInsets={{ bottom: 0, left: 0, right: 0 }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarLabelPosition: 'below-icon',
        tabBarAllowFontScaling: true,
        tabBarIconStyle: { width: 28, height: 28 },
        tabBarActiveTintColor: material.activeInk,
        tabBarInactiveTintColor: material.inactiveInk,
        tabBarActiveBackgroundColor: 'transparent',
        tabBarStyle: {
          position: 'absolute',
          start: metrics.left,
          end: metrics.right,
          bottom: metrics.bottom,
          height: metrics.height,
          borderRadius: metrics.radius,
          borderCurve: 'continuous',
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          paddingTop: 3,
          paddingBottom: 3,
          paddingHorizontal: 4,
          elevation: 0,
          boxShadow: [
            { offsetX: 0, offsetY: 9, blurRadius: 28, spreadDistance: 0, color: material.shadow },
          ],
        },
        tabBarItemStyle: { marginHorizontal: 3, marginVertical: 5, borderRadius: 29 },
        tabBarBackground: () => (
          <ForestGlassSurface
            target={targets[route.name]}
            reducedTransparency={accessibility.reducedTransparency}
            radius={metrics.radius}
          />
        ),
        tabBarButton: (props) => (
          <ForestDockButton {...props} reducedMotion={accessibility.reducedMotion} />
        ),
        tabBarButtonTestID: `forest-tab-${route.name.toLowerCase()}`,
        tabBarLabel: ({ color, children }) => (
          <LumiText
            variant="caption"
            style={{
              color,
              fontSize: 11,
              lineHeight: 15,
              fontWeight: '600',
              textAlign: 'center',
              alignSelf: 'stretch',
              marginTop: 2,
            }}
          >
            {children}
          </LumiText>
        ),
        tabBarIcon: ({ color, focused }) => (
          <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
            <LumiIcon
              name={MAIN_TAB_ICONS[route.name]}
              color={color}
              size={26}
              accentColor={focused ? material.accent : color}
            />
          </View>
        ),
      })}
    >
      <Tab.Screen name="Today" options={{ title: 'Dnes' }}>
        {({ navigation }) => (
          <TabWithCompactSleep
            blurTarget={targets.Today}
            hideCompact
            onOpenSleep={() => navigation.navigate('Today')}
          >
            <TodayScreen
              onOpenProfile={() => navigation.getParent()?.navigate('Profile')}
              onOpenHistoryToday={() => navigation.navigate('History')}
              onOpenDevelopment={() => navigation.navigate('Development')}
              onOpenEvent={(eventId) =>
                navigation.getParent()?.navigate('EventDetail', { eventId })
              }
            />
          </TabWithCompactSleep>
        )}
      </Tab.Screen>
      <Tab.Screen name="Care" options={{ title: 'Péče' }}>
        {({ navigation }) => (
          <TabWithCompactSleep
            blurTarget={targets.Care}
            onOpenSleep={() => navigation.navigate('Today')}
          >
            <CareScreen />
          </TabWithCompactSleep>
        )}
      </Tab.Screen>
      <Tab.Screen name="Development" options={{ title: 'Rozvoj' }}>
        {({ navigation }) => (
          <TabWithCompactSleep
            blurTarget={targets.Development}
            onOpenSleep={() => navigation.navigate('Today')}
          >
            <DevelopmentScreen
              onOpenProfile={() =>
                navigation.getParent()?.navigate('Profile', { section: 'children' })
              }
              onOpenEvent={(eventId) =>
                navigation.getParent()?.navigate('EventDetail', { eventId })
              }
            />
          </TabWithCompactSleep>
        )}
      </Tab.Screen>
      <Tab.Screen name="History" options={{ title: 'Historie' }}>
        {({ navigation }) => (
          <TabWithCompactSleep
            blurTarget={targets.History}
            onOpenSleep={() => navigation.navigate('Today')}
          >
            <HistoryScreen
              onOpenEvent={(eventId) =>
                navigation.getParent()?.navigate('EventDetail', { eventId })
              }
            />
          </TabWithCompactSleep>
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { mode, colors } = useLumiTheme();
  const bootstrap = useBootstrap();
  const linking = React.useMemo(() => createAppLinking(), []);
  // Personal builds keep the caregiver shell until every child gate is proven.
  const rootShell = resolveActiveRootShell();
  const navTheme =
    mode === 'dark'
      ? {
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
            background: colors.background,
            card: colors.surface,
            text: colors.text,
            border: colors.controlBorder,
            primary: colors.primary,
          },
        }
      : {
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            background: colors.background,
            card: colors.surface,
            text: colors.text,
            border: colors.controlBorder,
            primary: colors.primary,
          },
        };

  const homeRoute = bootstrap.welcomePending
    ? 'Welcome'
    : rootShell === 'child'
      ? 'ChildShell'
      : 'MainTabs';

  return (
    <NavigationContainer linking={linking} theme={navTheme}>
      <Stack.Navigator initialRouteName={homeRoute} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome">
          {({ navigation }) => (
            <WelcomeScreen
              childName={bootstrap.profile?.displayName ?? 'Miminko'}
              onContinue={() => {
                void bootstrap.skipWelcome().then(() => navigation.replace('MainTabs'));
              }}
              onSkip={() => {
                void bootstrap.skipWelcome().then(() => navigation.replace('MainTabs'));
              }}
              onOpenProfile={() => navigation.navigate('Profile', { section: 'children' })}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="ChildShell">
          {() => {
            // Production gates keep resolveActiveRootShell on caregiver, so this
            // route falls back instead of inventing a fake private session.
            // A real session store lands with verified identity; until then stay
            // on the caregiver shell rather than a disguised private UI.
            return <MainTabs />;
          }}
        </Stack.Screen>
        <Stack.Screen name="Profile" options={{ presentation: 'modal' }}>
          {({ navigation, route }) => (
            <ProfileScreen
              initialSection={route.params?.section}
              onClose={() => navigation.goBack()}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="EventDetail">
          {({ navigation, route }) => (
            <EventDetailScreen
              eventId={route.params?.eventId}
              onClose={() => navigation.goBack()}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
