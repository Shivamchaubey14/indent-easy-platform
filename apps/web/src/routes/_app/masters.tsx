import { createFileRoute, redirect } from '@tanstack/react-router';
import { MastersLayout } from '../../features/masters/MastersLayout';
import { canUseMasters } from '../../lib/access';
import { meQuery } from '../../lib/me';

// The API checks every operation; this only keeps people without any masters access out.
export const Route = createFileRoute('/_app/masters')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!canUseMasters(me.permissions)) throw redirect({ to: '/' });
  },
  component: MastersLayout,
});
