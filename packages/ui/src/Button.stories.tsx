import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';

const meta = {
  title: 'Actions/Button',
  component: Button,
  args: { children: 'Submit indent', variant: 'primary', size: 'md', loading: false },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'inline-radio', options: ['md', 'sm'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} variant="primary">
        Submit indent
      </Button>
      <Button {...args} variant="secondary">
        Save draft
      </Button>
      <Button {...args} variant="ghost">
        Discard
      </Button>
      <Button {...args} variant="danger">
        Cancel indent
      </Button>
      <Button {...args} disabled>
        Disabled
      </Button>
    </div>
  ),
};

export const Loading: Story = { args: { loading: true, children: 'Submitting…' } };
