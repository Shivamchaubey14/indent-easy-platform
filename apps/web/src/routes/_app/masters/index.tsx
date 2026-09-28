import { createFileRoute, redirect } from '@tanstack/react-router';
import { MASTER_SECTIONS } from '../../../lib/access';
import { meQuery } from '../../../lib/me';

// /masters opens the first section this user may use.
export const Route = createFileRoute('/_app/masters/')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    const first = MASTER_SECTIONS.find((s) =>
      s.permissions.some((p) => me.permissions.includes(p)),
    );
    throw redirect({ to: first?.to ?? '/' });
  },
});
