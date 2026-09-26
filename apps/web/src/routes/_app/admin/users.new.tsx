import { createFileRoute } from '@tanstack/react-router';
import { UserPage } from '../../../features/admin/UserPage';

export const Route = createFileRoute('/_app/admin/users/new')({
  component: () => <UserPage />,
});
