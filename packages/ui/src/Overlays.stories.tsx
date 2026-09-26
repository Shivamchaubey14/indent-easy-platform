import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { Field, TextInput } from './Field';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from './Menu';

const meta = {
  title: 'Overlays/Dialog and Menu',
  component: Dialog,
  args: { open: false, onOpenChange: () => undefined, title: '' },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

function ConfirmDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Cancel indent
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Cancel IND-2026-00042?"
        description="The requester is told, and a cancelled indent can’t be reopened."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={() => setOpen(false)}>
              Cancel indent
            </Button>
          </>
        }
      />
    </>
  );
}

/** Confirmation for an irreversible action. Esc, the close button or a click outside dismiss it. */
export const Confirmation: Story = { render: () => <ConfirmDemo /> };

function FormDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Return for changes</Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Return for changes"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Back
            </Button>
            <Button onClick={() => setOpen(false)}>Return indent</Button>
          </>
        }
      >
        <Field label="What should change?" required>
          {(control) => <TextInput {...control} />}
        </Field>
      </Dialog>
    </>
  );
}

export const WithForm: Story = { render: () => <FormDemo /> };

export const ActionsMenu: Story = {
  render: () => (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="secondary">More actions</Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem>Duplicate</MenuItem>
        <MenuItem>Download PDF</MenuItem>
        <MenuItem disabled>Send to vendor</MenuItem>
        <MenuSeparator />
        <MenuItem tone="danger">Cancel indent</MenuItem>
      </MenuContent>
    </Menu>
  ),
};

/** The dialog already open, for reviewing its layout. */
export const Opened: Story = {
  args: {
    open: true,
    title: 'Cancel IND-2026-00042?',
    description: 'The requester is told, and a cancelled indent can’t be reopened.',
  },
  render: (args) => (
    <Dialog
      {...args}
      footer={
        <>
          <Button variant="secondary">Keep it</Button>
          <Button variant="danger">Cancel indent</Button>
        </>
      }
    />
  ),
};
