import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatusBadge } from './StatusBadge';
import { statusesByTone, type Tone } from './status-map';

const meta = {
  title: 'Data display/StatusBadge',
  component: StatusBadge,
  args: { status: 'PENDING_APPROVAL', children: 'Pending approval' },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const TONES: Tone[] = ['neutral', 'info', 'warning', 'success', 'danger'];
const readable = (code: string) =>
  code.charAt(0) + code.slice(1).toLowerCase().replaceAll('_', ' ');

/** The whole status map: every status code, grouped by the tone it is shown in. */
export const StatusMap: Story = {
  render: () => (
    <div className="space-y-4">
      {TONES.map((tone) => (
        <section key={tone}>
          <h2 className="mb-2 text-h3 font-semibold capitalize">{tone}</h2>
          <div className="flex flex-wrap gap-2">
            {statusesByTone[tone].map((code) => (
              <StatusBadge key={code} status={code}>
                {readable(code)}
              </StatusBadge>
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
};
