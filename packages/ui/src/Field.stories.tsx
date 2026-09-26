import type { Meta, StoryObj } from '@storybook/react-vite';
import { Field, TextInput } from './Field';

const meta = {
  title: 'Forms/Field',
  component: Field,
  args: {
    label: 'Quantity',
    hint: 'In the product’s base unit (kg)',
    required: true,
    children: (control) => <TextInput {...control} inputMode="decimal" />,
  },
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithError: Story = {
  args: { error: 'Enter a quantity greater than zero.' },
};

export const Optional: Story = {
  args: {
    label: 'Remarks',
    hint: undefined,
    required: false,
    children: (control) => (
      <TextInput {...control} placeholder="Anything the approver should know" />
    ),
  },
};
