import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-native';
import { LumiEmptyState } from '@lumi/forest-design';
const meta = { title: 'Feedback/EmptyState', component: LumiEmptyState,
  args: { title: 'Žádné záznamy', description: 'Zachyťte první krásný okamžik.' } } satisfies Meta<typeof LumiEmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
