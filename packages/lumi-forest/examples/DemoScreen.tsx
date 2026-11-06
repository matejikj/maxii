import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { LumiBackground, LumiCard, LumiThemeProvider, useLumiTheme } from '../src';

function GrowthDashboard() {
  const theme = useLumiTheme();
  return (
    <View style={{ flex: 1 }}>
      <LumiBackground scene="growth" density="quiet" seed="locally-created-anonymous-token" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 64, paddingBottom: 160 }}>
        <Text style={{ ...theme.tokens.typography.h1, color: theme.semantic.text }}>Růst</Text>
        <LumiCard style={{ marginTop: 24 }}>
          <Text style={{ color: theme.semantic.text }}>Poslední měření</Text>
          <Text style={{ ...theme.tokens.typography.h2, color: theme.semantic.text }}>Ukázková data</Text>
        </LumiCard>
      </ScrollView>
    </View>
  );
}
export default function DemoScreen() {
  return <LumiThemeProvider scene="growth"><GrowthDashboard /></LumiThemeProvider>;
}
