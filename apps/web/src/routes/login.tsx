import { createFileRoute, redirect } from '@tanstack/react-router';
import { LoginPage } from '../features/auth/LoginPage';
import { restoreSession } from '../lib/auth';

/** Only paths inside this app: never an absolute or protocol-relative URL (open redirect). */
const safePath = (value: unknown): string | undefined =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : undefined;

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const path = safePath(search['redirect']);
    return path ? { redirect: path } : {};
  },
  beforeLoad: async ({ search }) => {
    if (await restoreSession()) throw redirect({ to: search.redirect ?? '/' });
  },
  component: function Login() {
    const { redirect: to } = Route.useSearch();
    return <LoginPage redirectTo={to} />;
  },
});
