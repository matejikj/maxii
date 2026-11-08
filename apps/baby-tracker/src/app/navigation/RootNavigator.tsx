import React from 'react';
import { View } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useLumiTheme } from '@lumi/forest-design/native';
import { CareScreen } from '../../features/care/CareScreen';
import { DevelopmentScreen } from '../../features/development/DevelopmentScreen';
import { EventDetailScreen } from '../../features/history/EventDetailScreen';
import { HistoryScreen } from '../../features/history/HistoryScreen';
import { ProfileScreen } from '../../features/profile/ProfileScreen';
import { CompactActiveSessions } from '../../features/shell/CompactActiveSessions';
import { WelcomeScreen } from '../../features/shell/WelcomeScreen';
import { TodayScreen } from '../../features/today/TodayScreen';
import { useBootstrap } from '../session/BootstrapContext';
import { createAppLinking } from './linking';
import type { MainTabParamList, RootStackParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TabWithCompactSleep({
  children,
  hideCompact,
  onOpenSleep,
}: {
  children: React.ReactNode;
  hideCompact?: boolean;
  onOpenSleep: () => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <CompactActiveSessions hidden={hideCompact === true} onOpenSleep={onOpenSleep} />
      {children}
    </View>
  );
}

function MainTabs() {
  const { colors } = useLumiTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.controlBorder },
      }}
    >
      <Tab.Screen name="Today" options={{ title: 'Dnes' }}>
        {({ navigation }) => (
          <TabWithCompactSleep hideCompact onOpenSleep={() => navigation.navigate('Today')}>
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
          <TabWithCompactSleep onOpenSleep={() => navigation.navigate('Today')}>
            <CareScreen />
          </TabWithCompactSleep>
        )}
      </Tab.Screen>
      <Tab.Screen name="Development" options={{ title: 'Rozvoj' }}>
        {({ navigation }) => (
          <TabWithCompactSleep onOpenSleep={() => navigation.navigate('Today')}>
            <DevelopmentScreen
              onOpenEvent={(eventId) =>
                navigation.getParent()?.navigate('EventDetail', { eventId })
              }
            />
          </TabWithCompactSleep>
        )}
      </Tab.Screen>
      <Tab.Screen name="History" options={{ title: 'Historie' }}>
        {({ navigation }) => (
          <TabWithCompactSleep onOpenSleep={() => navigation.navigate('Today')}>
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

  return (
    <NavigationContainer linking={linking} theme={navTheme}>
      <Stack.Navigator
        initialRouteName={bootstrap.welcomePending ? 'Welcome' : 'MainTabs'}
        screenOptions={{ headerShown: false }}
      >
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
              onOpenProfile={() => navigation.navigate('Profile')}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="Profile" options={{ presentation: 'modal' }}>
          {({ navigation }) => <ProfileScreen onClose={() => navigation.goBack()} />}
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
