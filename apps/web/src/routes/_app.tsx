import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { AppShell } from '../components/AppShell';
import { restoreSession } from '../lib/auth';
import { useSessionStore } from '../stores/session';

// Signed-in area. On a fresh page load the session is restored from the refresh cookie first;
// without one the user goes to sign-in and comes back here afterwards.
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location }) => {
    await restoreSession();
    const { status, mustChangePassword } = useSessionStore.getState();
    if (status !== 'signedIn') {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
    if (mustChangePassword) throw redirect({ to: '/change-password' });
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
