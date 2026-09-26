import { createFileRoute } from '@tanstack/react-router';
import { UserPage } from '../../../features/admin/UserPage';

export const Route = createFileRoute('/_app/admin/users/$userId')({
  component: function EditUser() {
    const { userId } = Route.useParams();
    return <UserPage userId={userId} />;
  },
});
