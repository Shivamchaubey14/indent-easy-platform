import { createFileRoute, redirect } from '@tanstack/react-router';
import { ChangePasswordPage } from '../features/auth/ChangePasswordPage';
import { restoreSession } from '../lib/auth';

export const Route = createFileRoute('/change-password')({
  beforeLoad: async ({ location }) => {
    if (!(await restoreSession())) {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
  component: ChangePasswordPage,
});
