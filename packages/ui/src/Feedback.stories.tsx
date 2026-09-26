import type { Meta, StoryObj } from '@storybook/react-vite';
import { Alert, ErrorState } from './Alert';
import { Button } from './Button';
import { Card } from './Card';
import { Loading, Skeleton } from './Loading';
import { useToast } from './Toast';

const meta = {
  title: 'Feedback/Messages',
  component: Alert,
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Alerts: Story = {
  render: () => (
    <div className="max-w-xl space-y-3">
      <Alert tone="info" title="Approval routing changed">
        Indents over ₹50,000 now also go to the finance head.
      </Alert>
      <Alert tone="success" title="GRN posted">
        Stock at Mathura BMC was updated.
      </Alert>
      <Alert tone="warning" title="Received more than ordered">
        The excess needs approval before the GRN can be posted.
      </Alert>
      <Alert tone="danger" title="The PO could not be sent">
        The vendor has no e-mail address on file.
      </Alert>
    </div>
  ),
};

export const ErrorWithRetry: Story = {
  render: () => <ErrorState requestId="01J9Z6T2V8Q4X3" onRetry={() => undefined} />,
};

export const LoadingStates: Story = {
  render: () => (
    <Card className="max-w-md space-y-4" aria-label="Indent summary">
      <Loading label="Loading indents…" />
      <div className="space-y-2">
        <Skeleton className="w-3/4" />
        <Skeleton />
        <Skeleton className="w-1/2" />
      </div>
    </Card>
  ),
};

function ToastDemo() {
  const toast = useToast();
  return (
    <div className="flex gap-3">
      <Button onClick={() => toast({ title: 'Indent IND-2026-00042 submitted' })}>
        Show a confirmation
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          toast({
            tone: 'info',
            title: 'Sync finished',
            description: '3 offline changes were uploaded.',
          })
        }
      >
        Show information
      </Button>
    </div>
  );
}

/** Toasts are for confirmations only; errors that need action stay inline. */
export const Toasts: Story = { render: () => <ToastDemo /> };
