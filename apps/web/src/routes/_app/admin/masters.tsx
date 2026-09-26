import { createFileRoute } from '@tanstack/react-router';
import { MastersPage } from '../../../features/admin/MastersPage';

export const Route = createFileRoute('/_app/admin/masters')({
  component: MastersPage,
});
