import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Alert, ErrorState } from './Alert';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { Field, TextInput } from './Field';
import { Loading } from './Loading';
import { Menu, MenuContent, MenuItem, MenuTrigger } from './Menu';
import { StatusBadge } from './StatusBadge';
import { axeViolations, renderUi } from './test/render';
import { useToast } from './Toast';

describe('Button', () => {
  it('blocks clicks and reports busy while loading', async () => {
    const onClick = vi.fn();
    renderUi(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is not a submit button unless asked', () => {
    renderUi(<Button>Go</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('StatusBadge', () => {
  it('shows the label, with the tone from the status map and a hidden icon', () => {
    renderUi(<StatusBadge status="RETURNED">Returned</StatusBadge>);
    const badge = screen.getByText('Returned');
    expect(badge).toHaveAttribute('data-tone', 'warning');
    expect(badge.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Alert and ErrorState', () => {
  it('announces errors at once and other messages politely', () => {
    renderUi(
      <>
        <Alert tone="danger" title="Failed" />
        <Alert tone="success" title="Saved" />
      </>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });

  it('shows the request ID and retries', async () => {
    const onRetry = vi.fn();
    renderUi(<ErrorState requestId="req-123" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(screen.getByText('Reference: req-123')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('Loading', () => {
  it('is a status with a readable label', () => {
    renderUi(<Loading />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });
});

describe('Field', () => {
  it('labels the control, says "required" in words and links hint and error', async () => {
    renderUi(
      <Field label="Quantity" hint="In the product's base unit" error="Enter a quantity" required>
        {(control) => <TextInput {...control} />}
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Quantity (required)' });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription("In the product's base unit Enter a quantity");
    expect(await axeViolations()).toEqual([]);
  });

  it('is not invalid without an error', () => {
    renderUi(<Field label="Remarks">{(control) => <TextInput {...control} />}</Field>);
    const input = screen.getByRole('textbox', { name: 'Remarks' });
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });
});

function DialogHarness({ onClosed }: { onClosed?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Cancel indent</Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) onClosed?.();
        }}
        title="Cancel this indent?"
        description="The requester is told, and the indent can't be reopened."
        footer={<Button onClick={() => setOpen(false)}>Keep it</Button>}
      />
    </>
  );
}

describe('Dialog', () => {
  it('opens with its title as its name, closes on Esc and returns focus', async () => {
    const onClosed = vi.fn();
    renderUi(<DialogHarness onClosed={onClosed} />);
    const opener = screen.getByRole('button', { name: 'Cancel indent' });
    await userEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Cancel this indent?' });
    expect(dialog).toHaveAccessibleDescription(
      "The requester is told, and the indent can't be reopened.",
    );
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(await axeViolations()).toEqual([]);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onClosed).toHaveBeenCalledOnce();
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('closes from the close button', async () => {
    renderUi(<DialogHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel indent' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Menu', () => {
  it('opens from the keyboard and runs the chosen action', async () => {
    const onSelect = vi.fn();
    renderUi(
      <Menu>
        <MenuTrigger asChild>
          <Button variant="ghost">More actions</Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={onSelect}>Duplicate</MenuItem>
          <MenuItem tone="danger">Cancel</MenuItem>
        </MenuContent>
      </Menu>,
    );
    screen.getByRole('button', { name: 'More actions' }).focus();
    await userEvent.keyboard('{Enter}');
    const menu = await screen.findByRole('menu');
    expect(menu).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(onSelect).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });
});

function ToastButton() {
  const toast = useToast();
  return <Button onClick={() => toast({ title: 'Indent submitted' })}>Submit</Button>;
}

describe('Toast', () => {
  it('shows a confirmation that can be dismissed', async () => {
    renderUi(<ToastButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Indent submitted')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(screen.queryByText('Indent submitted')).not.toBeInTheDocument());
  });
});
