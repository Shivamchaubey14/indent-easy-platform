import { createFileRoute, redirect } from '@tanstack/react-router';
import { ADMIN_SECTIONS } from '../../../features/admin/AdminLayout';
import { meQuery } from '../../../lib/me';

// /admin opens the first section this user may use.
export const Route = createFileRoute('/_app/admin/')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    const first = ADMIN_SECTIONS.find((s) => me.permissions.includes(s.permission));
    throw redirect({ to: first?.to ?? '/' });
  },
});
