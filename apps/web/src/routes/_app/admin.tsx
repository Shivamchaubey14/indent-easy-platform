import { createFileRoute, redirect } from '@tanstack/react-router';
import { AdminLayout, canAdminister } from '../../features/admin/AdminLayout';
import { meQuery } from '../../lib/me';

// The API checks every operation; this only keeps people without admin rights out of the screens.
export const Route = createFileRoute('/_app/admin')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!canAdminister(me.permissions)) throw redirect({ to: '/' });
  },
  component: AdminLayout,
});
