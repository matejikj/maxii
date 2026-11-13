import type { Meta, StoryObj } from '@storybook/react-native';
import { LumiTimeline } from '@lumi/forest-design';
const items = [
  { id: '1', title: 'První úsměv', time: '10. 5.', status: 'complete' as const },
  { id: '2', title: 'První příkrm', time: '20. 9.', status: 'current' as const },
  { id: '3', title: 'První krůčky', time: 'Jednou…', status: 'upcoming' as const },
];
const meta = { title: 'Data/Timeline', component: LumiTimeline, args: { items } } satisfies Meta<
  typeof LumiTimeline
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
