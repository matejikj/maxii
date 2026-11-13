import React from 'react';
import { View } from 'react-native';
import type { Preview } from '@storybook/react-native';
import { LumiThemeProvider, resolveLumiTheme } from '@lumi/forest-design';
const preview: Preview = {
  decorators: [
    (Story) => (
      <LumiThemeProvider mode="light">
        <View
          style={{
            flex: 1,
            padding: 20,
            backgroundColor: resolveLumiTheme('home', 'light').colors.background,
          }}
        >
          <Story />
        </View>
      </LumiThemeProvider>
    ),
  ],
  parameters: { controls: { expanded: true } },
};
export default preview;
