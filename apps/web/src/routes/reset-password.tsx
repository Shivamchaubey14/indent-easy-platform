import { createFileRoute } from '@tanstack/react-router';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';

// Opened from the reset e-mail: /reset-password#token=...
export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
});
