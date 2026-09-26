import { Outlet, createFileRoute } from '@tanstack/react-router';
import { AppShell } from '../components/AppShell';

// Signed-in area. The authentication guard (beforeLoad → /login) arrives with Phase 1.
export const Route = createFileRoute('/_app')({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
